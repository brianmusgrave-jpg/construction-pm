"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notify, getProjectMemberIds } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

// ── Create Invitation ──

export async function createInvitation(
  projectId: string,
  email: string,
  role: "OWNER" | "MANAGER" | "CONTRACTOR" | "STAKEHOLDER" | "VIEWER" = "CONTRACTOR"
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "create", "member")) throw new Error("Forbidden");

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user is already a member
  const existingMember = await db.projectMember.findFirst({
    where: {
      projectId,
      user: { email: normalizedEmail },
    },
  });
  if (existingMember) throw new Error("User is already a member of this project");

  // Check for pending invitation
  const existingInvite = await db.invitation.findFirst({
    where: {
      projectId,
      email: normalizedEmail,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) throw new Error("An invitation has already been sent to this email");

  // Generate unique token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  const invitation = await db.invitation.create({
    data: {
      email: normalizedEmail,
      token,
      role: role as never, // Prisma enum cast
      projectId,
      expiresAt,
    },
    include: {
      project: { select: { name: true } },
    },
  });

  // Log activity
  db.activityLog.create({
    data: {
      action: "MEMBER_INVITED",
      message: `Invited ${normalizedEmail} as ${role.toLowerCase()}`,
      projectId,
      userId: session.user.id,
      data: { email: normalizedEmail, role },
    },
  }).catch(() => {});

  // Notify existing project members
  const memberIds = await getProjectMemberIds(projectId);
  notify({
    type: "MEMBER_INVITED",
    title: `New team member invited`,
    message: `${normalizedEmail} was invited to ${invitation.project.name} as ${role.toLowerCase()}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);

  return {
    id: invitation.id,
    email: normalizedEmail,
    role,
    token,
    expiresAt,
  };
}

// ── Get Project Invitations ──

export async function getProjectInvitations(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.invitation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

// ── Cancel Invitation ──

export async function cancelInvitation(invitationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "create", "member")) throw new Error("Forbidden");

  const invitation = await db.invitation.delete({
    where: { id: invitationId },
  });

  revalidatePath(`/dashboard/projects/${invitation.projectId}`);
  return { success: true };
}

// ── Accept Invitation ──

export async function acceptInvitation(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.expiresAt < new Date()) throw new Error("Invitation has expired");

  const session = await auth();
  if (!session?.user) throw new Error("Please sign in to accept this invitation");

  // Check if already a member
  const existingMember = await db.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: invitation.projectId,
      },
    },
  });

  if (existingMember) {
    // Already a member — just clean up the invitation
    await db.invitation.delete({ where: { id: invitation.id } });
    return {
      success: true,
      projectId: invitation.projectId,
      projectName: invitation.project.name,
      alreadyMember: true,
    };
  }

  // Create project membership and delete invitation
  await db.$transaction([
    db.projectMember.create({
      data: {
        userId: session.user.id,
        projectId: invitation.projectId,
        role: invitation.role,
      },
    }),
    db.invitation.delete({ where: { id: invitation.id } }),
  ]);

  // Log activity
  db.activityLog.create({
    data: {
      action: "MEMBER_JOINED",
      message: `${session.user.name || session.user.email} joined as ${invitation.role.toLowerCase()}`,
      projectId: invitation.projectId,
      userId: session.user.id,
    },
  }).catch(() => {});

  // Notify existing members
  const memberIds = await getProjectMemberIds(invitation.projectId);
  notify({
    type: "MEMBER_INVITED",
    title: `New team member joined`,
    message: `${session.user.name || session.user.email} joined ${invitation.project.name}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: invitation.projectId },
  });

  revalidatePath(`/dashboard/projects/${invitation.projectId}`);

  return {
    success: true,
    projectId: invitation.projectId,
    projectName: invitation.project.name,
    alreadyMember: false,
  };
}

// ── Get invitation details by token (public, no auth needed) ──

export async function getInvitationByToken(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { project: { select: { name: true, address: true } } },
  });

  if (!invitation) return null;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    projectName: invitation.project.name,
    projectAddress: invitation.project.address,
    expiresAt: invitation.expiresAt,
    expired: invitation.expiresAt < new Date(),
  };
}

// ── Remove member from project ──

export async function removeMember(memberId: string, projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "delete", "member")) throw new Error("Forbidden");

  // Don't allow removing yourself if you're the only owner
  const member = await db.projectMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!member) throw new Error("Member not found");

  if (member.role === "OWNER") {
    const ownerCount = await db.projectMember.count({
      where: { projectId, role: "OWNER" },
    });
    if (ownerCount <= 1) throw new Error("Cannot remove the only project owner");
  }

  await db.projectMember.delete({ where: { id: memberId } });

  db.activityLog.create({
    data: {
      action: "MEMBER_REMOVED",
      message: `Removed ${member.user.name || member.user.email} from project`,
      projectId,
      userId: session.user.id,
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
