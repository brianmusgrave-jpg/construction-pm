/**
 * @file src/app/api/import-contacts/route.ts
 * @description Parses uploaded XLSX/CSV files for the contacts import wizard.
 *
 * POST: accepts FormData with a file, returns parsed headers + sample rows
 * so the client can build a column-mapping UI.
 *
 * Supports: .xlsx, .xls, .csv, .tsv
 * Max rows: 500 contacts per import
 * Auth: requires authenticated session with "create staff" permission.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const userRole = session.user.role || "VIEWER";
  if (!can(userRole, "create", "staff"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv", "tsv"].includes(ext ?? ""))
    return NextResponse.json(
      { error: "Unsupported file type. Use .xlsx, .xls, .csv, or .tsv" },
      { status: 400 }
    );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON array of objects
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rawRows.length === 0)
      return NextResponse.json({ error: "No data rows found" }, { status: 400 });
    if (rawRows.length > 500)
      return NextResponse.json(
        { error: "Maximum 500 contacts per import" },
        { status: 400 }
      );

    // Extract headers from first row keys
    const headers = Object.keys(rawRows[0]);

    // Convert all values to strings for the preview
    const rows = rawRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, String(v ?? "").trim()])
      )
    );

    // Auto-detect column mappings by fuzzy header matching
    const mappings = autoDetectMappings(headers);

    return NextResponse.json({
      headers,
      rows,
      totalRows: rows.length,
      mappings,
      fileName: file.name,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse file. Make sure it's a valid spreadsheet." },
      { status: 400 }
    );
  }
}

/** Staff fields that can be mapped to */
const STAFF_FIELDS = [
  "name",
  "company",
  "role",
  "contactType",
  "email",
  "phone",
  "location",
  "notes",
] as const;

type StaffField = (typeof STAFF_FIELDS)[number];

/** Fuzzy patterns for auto-detecting column→field mappings */
const FIELD_PATTERNS: Record<StaffField, RegExp> = {
  name: /^(full\s*)?name|contact(\s*name)?|person$/i,
  company: /^company|org(anization)?|business|firm$/i,
  role: /^role|trade|title|job(\s*title)?|position|specialty$/i,
  contactType: /^(contact\s*)?type|category|classification$/i,
  email: /^e[\s-]?mail(\s*address)?$/i,
  phone: /^phone(\s*(number|#))?|tel(ephone)?|mobile|cell$/i,
  location: /^location|city|address|area|region$/i,
  notes: /^notes?|comments?|remarks?|description$/i,
};

function autoDetectMappings(headers: string[]): Record<string, StaffField | ""> {
  const result: Record<string, StaffField | ""> = {};
  const used = new Set<StaffField>();

  for (const header of headers) {
    const normalized = header.trim();
    let matched: StaffField | "" = "";

    for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (!used.has(field as StaffField) && pattern.test(normalized)) {
        matched = field as StaffField;
        used.add(matched);
        break;
      }
    }

    result[header] = matched;
  }

  return result;
}
