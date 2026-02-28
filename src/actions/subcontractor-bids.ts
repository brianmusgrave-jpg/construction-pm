"use server";

/**
 * @file actions/subcontractor-bids.ts
 * @description Server actions for subcontractor bid management on project phases.
 *
 * Tracks competitive bids submitted by subcontractors for a phase scope of work.
 * One bid is typically awarded via `awardBid`; the rest are declined.
 *
 * NOTABLE DIFFERENCE FROM OTHER ACTION FILES:
 *   Imports `db` from `@/lib/db-types`, not `@/lib/db`. The SubcontractorBid
 *   model IS in the generated Prisma types (db-types export), so no `db as any`
 *   cast is needed here. This is the only action file that imports from db-types
 *   directly. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Authorization pattern: project-scoped rather than global role checks.
 *   - `requireMember` verifies the caller is a project member.
 *   - `awardBid` and `deleteSubcontractorBid` check ProjectMember.role against
 *     ["PM", "ADMIN"] — these are project-level roles, not the global User.role.
 *   - Note: the role strings "PM" and "ADMIN" differ from the global role enum
 *     values "PROJECT_MANAGER" and "ADMIN" — check the ProjectMember schema.
 *
 * `getSubcontractorBids`: returns [] for unauthenticated callers (not throwing).
 * `amount` is a Prisma Decimal — coerced to Number before returning.
 *
 * Revalidates the specific project path (not `/dashboard/projects`) — bids
 * are scoped to the project detail page.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { SubcontractorBid } from "@/lib/db-types";

// ── Internal Helpers ──

/**
 * Verify the current user is a member of the project containing `phaseId`.
 *
 * Traverses: Phase → Project → ProjectMembers (filtered by userId).
 * Used to gate write operations without requiring a global role — any project
 * member can create bids; only PM/ADMIN members can award or delete.
 *
 * @param phaseId - Phase ID to look up the parent project from.
 * @returns Object with userId, the ProjectMember record, and projectId.
 * @throws "Unauthenticated" | "Phase not found" | "Not a project member"
 */
async function requireMember(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phase = await (db as any).phase.findUnique({
    where: { id: phaseId },
    include: { project: { include: { members: { where: { userId: session.user.id } } } } },
  });
  if (!phase) throw new Error("Phase not found");
  const member = phase.project.members[0];
  if (!member) throw new Error("Not a project member");
  return { userId: session.user.id, member, projectId: phase.projectId };
}

// ── Queries ──

/**
 * Fetch all bids for a phase, ordered by submission date (newest first).
 *
 * Returns [] for unauthenticated callers (not throwing) — safe for server
 * components rendering empty state.
 *
 * `amount` is coerced from Prisma Decimal to Number for client serialisation.
 *
 * @param phaseId - The phase to fetch bids for.
 * @returns Array of SubcontractorBid records with coerced amount, or [].
 */
export async function getSubcontractorBids(phaseId: string): Promise<SubcontractorBid[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const bids = await db.subcontractorBid.findMany({
    where: { phaseId },
    orderBy: { submittedAt: "desc" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return bids.map((b: any) => ({ ...b, amount: Number(b.amount) }));
}

// ── Mutations ──

/**
 * Submit a new subcontractor bid on a phase.
 *
 * Any project member may submit a bid (no role restriction beyond membership).
 * Revalidates the specific project path rather than the generic dashboard path.
 *
 * @param data.phaseId      - Phase the bid is for.
 * @param data.companyName  - Bidding company name.
 * @param data.contactName  - Contact person (optional).
 * @param data.email        - Contact email (optional).
 * @param data.phone        - Contact phone (optional).
 * @param data.amount       - Bid amount.
 * @param data.notes        - Optional notes.
 * @throws "Not a project member" if caller is not a member of the project.
 */
export async function createSubcontractorBid(data: {
  phaseId: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  amount: number;
  notes?: string;
}): Promise<void> {
  const { projectId } = await requireMember(data.phaseId);
  await db.subcontractorBid.create({
    data: {
      phaseId: data.phaseId,
      companyName: data.companyName,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      amount: data.amount,
      notes: data.notes ?? null,
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

/**
 * Award or un-award a bid.
 *
 * Permission check: caller must be a project member with role "PM" or "ADMIN".
 * Note these are ProjectMember role values, not the global User role enum.
 * Typically only one bid should be awarded at a time (enforced by UI only).
 *
 * @param bidId   - Bid to award/un-award.
 * @param awarded - True to award, false to un-award.
 * @throws "Insufficient permissions" if caller is not PM or ADMIN on this project.
 */
export async function awardBid(bidId: string, awarded: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const bid = await db.subcontractorBid.findUnique({
    where: { id: bidId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!bid) throw new Error("Bid not found");
  const member = bid.phase.project.members[0];
  // ProjectMember.role check (not global User.role) — "PM" and "ADMIN" are project-scoped.
  if (!member || !["PM", "ADMIN"].includes(member.role)) throw new Error("Insufficient permissions");

  await db.subcontractorBid.update({ where: { id: bidId }, data: { awarded } });
  revalidatePath(`/dashboard/projects/${bid.phase.projectId}`);
}

/**
 * Permanently delete a bid.
 *
 * Permission check: caller must be a project member with role "PM" or "ADMIN".
 *
 * @param bidId - Bid to delete.
 * @throws "Insufficient permissions" if caller is not PM or ADMIN on this project.
 */
export async function deleteSubcontractorBid(bidId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const bid = await db.subcontractorBid.findUnique({
    where: { id: bidId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!bid) throw new Error("Bid not found");
  const member = bid.phase.project.members[0];
  if (!member || !["PM", "ADMIN"].includes(member.role)) throw new Error("Insufficient permissions");

  await db.subcontractorBid.delete({ where: { id: bidId } });
  revalidatePath(`/dashboard/projects/${bid.phase.projectId}`);
}
