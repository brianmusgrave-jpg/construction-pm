"use server";

/**
 * @file actions/staff.ts
 * @description Server actions for the staff/contact directory.
 *
 * Staff records represent people and companies that work on projects:
 * internal team members, subcontractors, vendors, and inspectors.
 * They live in a flat directory and are assigned to phases via PhaseAssignment.
 *
 * Contact types: TEAM | SUBCONTRACTOR | VENDOR | INSPECTOR
 *
 * Bulk operations:
 *   - bulkDeleteStaff: delete multiple records in a single DB call
 *   - bulkUpdateStaffType: reclassify multiple records at once
 *
 * Export:
 *   - exportStaffCsv: returns a CSV string for download, ordered by type then name
 *
 * Auth: create/update/delete require the corresponding `can()` permission.
 * Read operations (used in assignment pickers) are handled by page-level queries,
 * not exposed here.
 *
 * Note: `updateStaff` normalizes empty strings to null before writing — the UI
 * sends empty string for cleared optional fields, which must not overwrite
 * existing DB values with "".
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schemas ──

/** Full staff creation schema. */
const CreateStaffSchema = z.object({
  name:        z.string().min(1, "Name is required").max(200),
  company:     z.string().max(200).optional(),
  role:        z.string().max(200).optional(),
  contactType: z.enum(["TEAM", "SUBCONTRACTOR", "VENDOR", "INSPECTOR"]),
  email:       z.string().email("Invalid email").max(200).optional().or(z.literal("")),
  phone:       z.string().max(30).optional(),
  location:    z.string().max(200).optional(),
  notes:       z.string().max(2000).optional(),
});

/** All fields optional for partial update, plus required `id`. */
const UpdateStaffSchema = CreateStaffSchema.partial().extend({
  id: z.string().min(1),
});

// ── Mutations ──

/**
 * Create a new staff/contact record in the directory.
 * Records the creating user for audit purposes.
 *
 * Requires: "create staff" permission (ADMIN or PROJECT_MANAGER).
 */
export async function createStaff(data: {
  name: string;
  company?: string;
  role?: string;
  contactType: "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "staff"))
    throw new Error("Forbidden");

  const parsed = CreateStaffSchema.parse(data);

  const staff = await db.staff.create({
    data: {
      orgId: session.user.orgId!,
      name:        parsed.name,
      company:     parsed.company || null,
      role:        parsed.role || null,
      contactType: parsed.contactType,
      email:       parsed.email || null,
      phone:       parsed.phone || null,
      location:    parsed.location || null,
      notes:       parsed.notes || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard/directory");
  return staff;
}

/**
 * Update an existing staff record with partial field changes.
 * Empty strings submitted from cleared form fields are normalized to null
 * to prevent overwriting existing values with empty strings.
 * Fields omitted from `data` are left unchanged.
 *
 * Requires: "update staff" permission.
 */
export async function updateStaff(data: {
  id: string;
  name?: string;
  company?: string;
  role?: string;
  contactType?: "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  const parsed = UpdateStaffSchema.parse(data);
  const { id, ...updates } = parsed;

  // Normalize empty strings → null so cleared optional fields don't persist as ""
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    cleaned[key] = value === "" ? null : value;
  }

  const staff = await db.staff.update({
    where: { id },
    data: cleaned,
  });

  revalidatePath("/dashboard/directory");
  return staff;
}

/**
 * Delete a single staff record.
 * Phase assignments referencing this staff will cascade-delete per schema.
 *
 * Requires: "delete staff" permission.
 */
export async function deleteStaff(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "staff"))
    throw new Error("Forbidden");

  await db.staff.delete({ where: { id } });
  revalidatePath("/dashboard/directory");
}

/**
 * Delete multiple staff records in a single DB call.
 * Returns the count of deleted records.
 * No-ops gracefully on an empty id array.
 *
 * Requires: "delete staff" permission.
 */
export async function bulkDeleteStaff(ids: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "staff"))
    throw new Error("Forbidden");
  if (ids.length === 0) return { deleted: 0 };

  const result = await db.staff.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/dashboard/directory");
  return { deleted: result.count };
}

/**
 * Reclassify multiple staff records to a new contact type in a single call.
 * Used by the bulk-edit toolbar in the directory table.
 * Returns the count of updated records.
 *
 * Requires: "update staff" permission.
 */
export async function bulkUpdateStaffType(ids: string[], contactType: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");
  if (ids.length === 0) return { updated: 0 };

  const validTypes = ["TEAM", "SUBCONTRACTOR", "VENDOR", "INSPECTOR"];
  if (!validTypes.includes(contactType)) throw new Error("Invalid type");

  const result = await db.staff.updateMany({
    where: { id: { in: ids } },
    data: { contactType: contactType as never },
  });
  revalidatePath("/dashboard/directory");
  return { updated: result.count };
}

// ── Bulk Import ──

/** A single row from the import wizard, already mapped to staff fields. */
const ImportRowSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  contactType: z
    .enum(["TEAM", "SUBCONTRACTOR", "VENDOR", "INSPECTOR"])
    .optional()
    .default("SUBCONTRACTOR"),
  email: z
    .string()
    .email()
    .max(200)
    .optional()
    .or(z.literal("")),
  phone: z.string().max(30).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Bulk-import contacts from a spreadsheet.
 * Accepts an array of mapped rows, validates each, creates all valid rows
 * in a single transaction, and returns a summary with per-row errors.
 *
 * Duplicate detection: if `skipDuplicateEmails` is true, rows whose email
 * matches an existing staff record (case-insensitive) are skipped rather
 * than inserted.
 *
 * Requires: "create staff" permission (ADMIN or PROJECT_MANAGER).
 */
export async function bulkImportStaff(
  rows: Record<string, string>[],
  options?: { skipDuplicateEmails?: boolean }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "staff"))
    throw new Error("Forbidden");

  const skipDupes = options?.skipDuplicateEmails ?? true;
  const errors: { row: number; message: string }[] = [];
  const skipped: { row: number; reason: string }[] = [];

  // If deduping, fetch existing emails for this org
  let existingEmails = new Set<string>();
  if (skipDupes) {
    const existing = await db.staff.findMany({
      where: { orgId: session.user.orgId! },
      select: { email: true },
    });
    existingEmails = new Set(
      existing
        .map((s) => s.email?.toLowerCase())
        .filter((e): e is string => !!e)
    );
  }

  // Normalize contact type strings from spreadsheets
  function normalizeType(
    raw: string | undefined
  ): "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR" {
    if (!raw) return "SUBCONTRACTOR";
    const upper = raw.toUpperCase().trim();
    if (upper.includes("TEAM") || upper.includes("INTERNAL") || upper.includes("EMPLOYEE"))
      return "TEAM";
    if (upper.includes("SUB") || upper.includes("CONTRACTOR") || upper.includes("TRADE"))
      return "SUBCONTRACTOR";
    if (upper.includes("VENDOR") || upper.includes("SUPPLIER") || upper.includes("MATERIAL"))
      return "VENDOR";
    if (upper.includes("INSPECT") || upper.includes("ENGINEER") || upper.includes("CONSULT"))
      return "INSPECTOR";
    return "SUBCONTRACTOR";
  }

  // Validate and prepare rows
  const validRows: z.infer<typeof ImportRowSchema>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;

    // Normalize contact type before validation
    if (raw.contactType) {
      raw.contactType = normalizeType(raw.contactType);
    }

    // Clean empty strings to undefined for optional fields
    const cleaned: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(raw)) {
      cleaned[k] = v?.trim() || undefined;
    }
    // Name is required — keep as-is even if empty (validation will catch it)
    cleaned.name = raw.name?.trim() || "";

    const result = ImportRowSchema.safeParse(cleaned);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      errors.push({ row: rowNum, message: msg || "Invalid data" });
      continue;
    }

    // Duplicate check
    const email = result.data.email?.toLowerCase();
    if (skipDupes && email && existingEmails.has(email)) {
      skipped.push({ row: rowNum, reason: `Email ${result.data.email} already exists` });
      continue;
    }

    // Track email for intra-batch deduplication
    if (email) existingEmails.add(email);

    validRows.push(result.data);
  }

  // Bulk create in a transaction
  let created = 0;
  if (validRows.length > 0) {
    await db.$transaction(
      validRows.map((row) =>
        db.staff.create({
          data: {
            orgId: session.user.orgId!,
            name: row.name,
            company: row.company || null,
            role: row.role || null,
            contactType: row.contactType || "SUBCONTRACTOR",
            email: row.email || null,
            phone: row.phone || null,
            location: row.location || null,
            notes: row.notes || null,
            createdById: session.user.id,
          },
        })
      )
    );
    created = validRows.length;
  }

  revalidatePath("/dashboard/directory");
  return { created, errors, skipped, total: rows.length };
}

/**
 * Export the full staff directory as a CSV string for download.
 * Ordered by contact type then name. All fields are double-quote escaped.
 * Returns a plain CSV string (the API route writes the Content-Disposition header).
 *
 * Requires: authenticated session.
 */
export async function exportStaffCsv() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    where: { orgId: session.user.orgId! },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });

  const header = "Name,Company,Role,Type,Email,Phone,Location,Notes";
  const rows = staff.map((s) =>
    [s.name, s.company, s.role, s.contactType, s.email, s.phone, (s as Record<string, unknown>).location as string || "", s.notes]
      .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}
