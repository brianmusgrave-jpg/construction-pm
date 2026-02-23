"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { SubcontractorBid } from "@/lib/db-types";

async function requireMember(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const phase = await (db as any).phase.findUnique({
    where: { id: phaseId },
    include: { project: { include: { members: { where: { userId: session.user.id } } } } },
  });
  if (!phase) throw new Error("Phase not found");
  const member = phase.project.members[0];
  if (!member) throw new Error("Not a project member");
  return { userId: session.user.id, member, projectId: phase.projectId };
}

export async function getSubcontractorBids(phaseId: string): Promise<SubcontractorBid[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const bids = await db.subcontractorBid.findMany({
    where: { phaseId },
    orderBy: { submittedAt: "desc" },
  });
  return bids.map((b: any) => ({ ...b, amount: Number(b.amount) }));
}

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

export async function awardBid(bidId: string, awarded: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const bid = await db.subcontractorBid.findUnique({
    where: { id: bidId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!bid) throw new Error("Bid not found");
  const member = bid.phase.project.members[0];
  if (!member || !["PM", "ADMIN"].includes(member.role)) throw new Error("Insufficient permissions");

  await db.subcontractorBid.update({ where: { id: bidId }, data: { awarded } });
  revalidatePath(`/dashboard/projects/${bid.phase.projectId}`);
}

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
