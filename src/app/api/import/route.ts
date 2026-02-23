import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";

interface CsvProject {
  name: string;
  description?: string;
  status?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  phases?: string; // comma-separated phase names
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      // Simple CSV parse (handles quoted fields with commas)
      const values: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { values.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      values.push(cur.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    });
}

const VALID_STATUSES = ["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "txt"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return NextResponse.json({ error: "No data rows found" }, { status: 400 });
  if (rows.length > 100) return NextResponse.json({ error: "Maximum 100 projects per import" }, { status: 400 });

  const errors: string[] = [];
  const created: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    const name = row["name"] || row["Name"] || row["project_name"] || row["Project Name"];
    if (!name) { errors.push(`Row ${rowNum}: missing project name`); continue; }

    const rawStatus = (row["status"] || row["Status"] || "PLANNING").toUpperCase().replace(/\s+/g, "_");
    const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "PLANNING";

    const budgetRaw = row["budget"] || row["Budget"] || row["budget_usd"];
    const budget = budgetRaw ? parseFloat(budgetRaw.replace(/[^0-9.]/g, "")) : null;

    try {
      const project = await (db as any).project.create({
        data: {
          name,
          description: row["description"] || row["Description"] || null,
          status,
          location: row["location"] || row["Location"] || row["address"] || null,
          startDate: row["start_date"] || row["Start Date"] || row["startDate"] ? new Date(row["start_date"] || row["Start Date"] || row["startDate"]) : null,
          endDate: row["end_date"] || row["End Date"] || row["endDate"] ? new Date(row["end_date"] || row["End Date"] || row["endDate"]) : null,
          budget: budget ?? null,
          members: {
            create: { userId: session.user.id, role: "PM" },
          },
        },
      });

      // Create phases if provided
      const phasesRaw = row["phases"] || row["Phases"] || "";
      if (phasesRaw.trim()) {
        const phaseNames = phasesRaw.split(";").map((p: string) => p.trim()).filter(Boolean);
        for (let pi = 0; pi < phaseNames.length; pi++) {
          await (db as any).phase.create({
            data: {
              name: phaseNames[pi],
              projectId: project.id,
              sortOrder: pi,
              status: "PLANNING",
            },
          });
        }
      }

      created.push(project.id);
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : "Failed to create project"}`);
    }
  }

  return NextResponse.json({
    created: created.length,
    errors,
    total: rows.length,
  });
}
