"use server";

/**
 * @file actions/search.ts
 * @description Global search action powering the Command Palette (Cmd+K).
 *
 * Searches four entity types simultaneously via Promise.all:
 *   - Projects  (name, description, address)
 *   - Phases    (name, detail) — linked to their parent project
 *   - Documents (name, notes) — linked through phase to project
 *   - Staff     (name, company, role, email)
 *
 * Returns up to 5 results per entity type (20 total max) as a flat
 * `SearchResult[]` array in display order: projects → phases → documents → staff.
 *
 * Each result includes a pre-built `href` for immediate navigation on selection.
 *
 * Type note: `SearchResult` is defined in `@/lib/search-types` (not here) to
 * work around the Next.js "use server" restriction that prevents exporting
 * non-async values from server action files.
 *
 * Early return: queries with < 2 characters are rejected immediately to avoid
 * full-table scans on every keystroke.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { semanticSearch } from "@/lib/embeddings";

// Type lives in lib/ to satisfy the "use server" export restriction
import type { SearchResult } from "@/lib/search-types";
export type { SearchResult } from "@/lib/search-types";

/**
 * Full-text search across projects, phases, documents, and staff.
 * All four queries run in parallel. Results are capped at 5 per entity type
 * to keep the Command Palette snappy.
 *
 * @param query - Search string. Returns [] if shorter than 2 characters.
 * @returns Flat array of SearchResult objects, ordered by entity type.
 *
 * Requires: authenticated session.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!query.trim() || query.trim().length < 2) return [];

  const q = query.trim();
  const contains = { contains: q, mode: "insensitive" as const };

  const [projects, phases, documents, staff] = await Promise.all([
    // Projects: search name, description, and site address
    db.project.findMany({
      where: { orgId: session.user.orgId!,
        OR: [{ name: contains }, { description: contains }, { address: contains }],
      },
      select: { id: true, name: true, status: true, address: true },
      take: 5,
    }),

    // Phases: search name and detail text, include parent project for subtitle/href
    db.phase.findMany({
      where: {
        OR: [{ name: contains }, { detail: contains }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
      take: 5,
    }),

    // Documents: search name and notes, navigate to phase detail panel
    db.document.findMany({
      where: {
        OR: [{ name: contains }, { notes: contains }],
      },
      select: {
        id: true,
        name: true,
        category: true,
        phase: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      take: 5,
    }),

    // Staff: search name, company, role, and email
    db.staff.findMany({
      where: {
        orgId: session.user.orgId!,
        OR: [
          { name: contains },
          { company: contains },
          { role: contains },
          { email: contains },
        ],
      },
      select: { id: true, name: true, role: true, company: true },
      take: 5,
    }),
  ]);

  // Build flat result array in priority order: projects → phases → documents → staff
  const results: SearchResult[] = [];

  for (const p of projects) {
    results.push({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: p.address || p.status.replace("_", " "),
      href: `/dashboard/projects/${p.id}`,
    });
  }

  for (const ph of phases) {
    results.push({
      type: "phase",
      id: ph.id,
      title: ph.name,
      subtitle: ph.project.name,
      href: `/dashboard/projects/${ph.project.id}/phases/${ph.id}`,
    });
  }

  for (const d of documents) {
    results.push({
      type: "document",
      id: d.id,
      title: d.name,
      subtitle: `${d.phase.project.name} → ${d.phase.name}`,
      href: `/dashboard/projects/${d.phase.project.id}/phases/${d.phase.id}`,
    });
  }

  for (const s of staff) {
    results.push({
      type: "staff",
      id: s.id,
      title: s.name,
      subtitle: [s.role, s.company].filter(Boolean).join(" · "),
      href: `/dashboard/directory`,
    });
  }

  // Semantic search for voice notes/memos (Sprint 22 — #69)
  try {
    const semanticResults = await semanticSearch(
      q,
      ["voice_note", "voice_memo"],
      5
    );
    const dbc = db as any;
    for (const sr of semanticResults) {
      const snippet = sr.content.slice(0, 80) + (sr.content.length > 80 ? "…" : "");
      if (sr.entityType === "voice_note") {
        // Resolve the voice note's parent phase → project for navigation
        const note = await dbc.voiceNote.findUnique({
          where: { id: sr.entityId },
          select: { label: true, phase: { select: { id: true, name: true, project: { select: { id: true, name: true } } } } },
        }).catch(() => null);
        if (note?.phase) {
          results.push({
            type: "voice_note" as any,
            id: sr.entityId,
            title: note.label || snippet,
            subtitle: `${note.phase.project.name} → ${note.phase.name} (${Math.round(sr.score * 100)}% match)`,
            href: `/dashboard/projects/${note.phase.project.id}/phases/${note.phase.id}`,
          });
        }
      } else if (sr.entityType === "voice_memo") {
        const memo = await dbc.voiceMemo.findUnique({
          where: { id: sr.entityId },
          select: { actionType: true, project: { select: { id: true, name: true } } },
        }).catch(() => null);
        if (memo) {
          results.push({
            type: "voice_memo" as any,
            id: sr.entityId,
            title: snippet,
            subtitle: `${memo.project?.name || "General"} · ${(memo.actionType || "note").replace("_", " ")} (${Math.round(sr.score * 100)}% match)`,
            href: memo.project ? `/dashboard/projects/${memo.project.id}` : `/dashboard`,
          });
        }
      }
    }
  } catch {
    // Semantic search is best-effort — DB search results are always returned
  }

  return results;
}
