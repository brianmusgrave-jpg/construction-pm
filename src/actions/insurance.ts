"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CertificateSchema = z.object({
  staffId: z.string().min(1),
  carrier: z.string().min(1).max(200),
  policyNumber: z.string().max(100).optional(),
  coverageType: z.enum([
    "GENERAL_LIABILITY",
    "WORKERS_COMP",
    "AUTO",
    "UMBRELLA",
    "PROFESSIONAL",
    "BUILDERS_RISK",
    "OTHER",
  ]),
  effectiveDate: z.string().min(1),
  expiryDate: z.string().min(1),
  coverageAmount: z.number().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createCertificate(data: {
  staffId: string;
  carrier: string;
  policyNumber?: string;
  coverageType: string;
  effectiveDate: string;
  expiryDate: string;
  coverageAmount?: number;
  documentUrl?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "staff"))
    throw new Error("Forbidden");

  const parsed = CertificateSchema.parse(data);

  const now = new Date();
  const expiry = new Date(parsed.expiryDate);
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" = "ACTIVE";
  if (daysUntilExpiry <= 0) status = "EXPIRED";
  else if (daysUntilExpiry <= 30) status = "EXPIRING_SOON";

  const cert = await db.insuranceCertificate.create({
    data: {
      staffId: parsed.staffId,
      carrier: parsed.carrier,
      policyNumber: parsed.policyNumber || null,
      coverageType: parsed.coverageType as never,
      effectiveDate: new Date(parsed.effectiveDate),
      expiryDate: new Date(parsed.expiryDate),
      coverageAmount: parsed.coverageAmount || null,
      documentUrl: parsed.documentUrl || null,
      notes: parsed.notes || null,
      status: status as never,
    },
  });

  revalidatePath("/dashboard/directory");
  return cert;
}

export async function updateCertificate(data: {
  id: string;
  carrier?: string;
  policyNumber?: string;
  coverageType?: string;
  effectiveDate?: string;
  expiryDate?: string;
  coverageAmount?: number;
  documentUrl?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  const { id, ...updates } = data;
  const cleaned: Record<string, unknown> = {};

  if (updates.carrier !== undefined) cleaned.carrier = updates.carrier;
  if (updates.policyNumber !== undefined)
    cleaned.policyNumber = updates.policyNumber || null;
  if (updates.coverageType !== undefined)
    cleaned.coverageType = updates.coverageType;
  if (updates.effectiveDate !== undefined)
    cleaned.effectiveDate = new Date(updates.effectiveDate);
  if (updates.expiryDate !== undefined) {
    const expiry = new Date(updates.expiryDate);
    cleaned.expiryDate = expiry;
    const now = new Date();
    const days = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 0) cleaned.status = "EXPIRED";
    else if (days <= 30) cleaned.status = "EXPIRING_SOON";
    else cleaned.status = "ACTIVE";
  }
  if (updates.coverageAmount !== undefined)
    cleaned.coverageAmount = updates.coverageAmount || null;
  if (updates.documentUrl !== undefined)
    cleaned.documentUrl = updates.documentUrl || null;
  if (updates.notes !== undefined) cleaned.notes = updates.notes || null;

  const cert = await db.insuranceCertificate.update({
    where: { id },
    data: cleaned,
  });

  revalidatePath("/dashboard/directory");
  return cert;
}

export async function deleteCertificate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "staff"))
    throw new Error("Forbidden");

  await db.insuranceCertificate.delete({ where: { id } });
  revalidatePath("/dashboard/directory");
}

export async function setUmbrellaOverride(data: {
  staffId: string;
  uninsuredOverride: boolean;
  umbrellaPolicyId: string | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "staff"))
    throw new Error("Forbidden");

  await db.staff.update({
    where: { id: data.staffId },
    data: {
      uninsuredOverride: data.uninsuredOverride,
      umbrellaPolicyId: data.umbrellaPolicyId,
    },
  });

  revalidatePath("/dashboard/directory");
}

export async function updateStaffRating(staffId: string, rating: number | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userRole = session.user.role || "VIEWER";
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER")
    throw new Error("Forbidden - PM only");

  if (rating !== null && (rating < 1 || rating > 5))
    throw new Error("Rating must be 1-5");

  await db.staff.update({
    where: { id: staffId },
    data: { rating },
  });

  revalidatePath("/dashboard/directory");
}

export async function getInsuranceComplianceReport() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    include: {
      certificates: {
        orderBy: { expiryDate: "asc" },
      },
      umbrellaPolicy: true,
    },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });

  return staff;
}

export async function exportInsuranceCsv() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    include: {
      certificates: {
        orderBy: { expiryDate: "asc" },
      },
      umbrellaPolicy: true,
    },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });

  const header =
    "Contact Name,Company,Type,Role,Coverage Type,Carrier,Policy #,Effective Date,Expiry Date,Coverage Amount,Status,Uninsured Override,Umbrella Policy";
  const rows: string[] = [];

  for (const s of staff) {
    if (s.certificates.length === 0) {
      rows.push(
        [
          s.name,
          s.company || "",
          s.contactType,
          s.role || "",
          "",
          "",
          "",
          "",
          "",
          "",
          s.uninsuredOverride ? "Covered Under Umbrella" : "NO COVERAGE",
          s.uninsuredOverride ? "Yes" : "No",
          s.umbrellaPolicy?.carrier || "",
        ]
          .map((v) => `"${v.toString().replace(/"/g, '""')}"`)
          .join(",")
      );
    } else {
      for (const c of s.certificates) {
        rows.push(
          [
            s.name,
            s.company || "",
            s.contactType,
            s.role || "",
            c.coverageType,
            c.carrier,
            c.policyNumber || "",
            c.effectiveDate.toISOString().split("T")[0],
            c.expiryDate.toISOString().split("T")[0],
            c.coverageAmount?.toString() || "",
            c.status,
            s.uninsuredOverride ? "Yes" : "No",
            s.umbrellaPolicy?.carrier || "",
          ]
            .map((v) => `"${v.toString().replace(/"/g, '""')}"`)
            .join(",")
        );
      }
    }
  }

  return [header, ...rows].join("\n");
}
