"use server";

/**
 * @file actions/invitations.ts
 * @description Server actions for project membership — invitations, role management,
 * and member removal.
 *
 * Invitation lifecycle:
 *   1. `createInvitation`      — Generates a 7-day single-use token, emails it,
 *                                and notifies existing project members.
 *   2. `getInvitationByToken`  — Public lookup (no auth) used by the accept page
 *                                to display project/role info before sign-in.
 *   3. `acceptInvitation`      — Atomically creates the ProjectMember row and
 *                                deletes the invitation in a single transaction.
 *   4. `cancelInvitation`      — Hard-deletes a pending invite.
 *
 * Member management:
 *   - `updateMemberRole` — Change a member's project-level role; guards against
 *                          demoting the last OWNER.
 *   - `removeMember`     — Remove a member from the project; guards against
 *                          removing the last OWNER.
 *
 * Duplicate guards:
 *   - `createInvitation` checks for an existing ProjectMember row AND an unexpired
 *     Invitation row before creating a new one — prevents duplicate email spam.
 *
 * Fire-and-forget operations:
 *   - Activity log writes (.catch(() => {})) — never block the response.
 *   - `sendInvitationEmail` — email delivery is best-effort.
 *   - `notify` — SSE notification delivery is best-effort.
 *
 * Role requirements:
 *   - create/cancel invitation: `can(role, "create", "member")`
 *   - update member role:       `can(role, "update", "member")`
 *   - remove member:            `can(role, "delete", "member")`
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notify, getProjectMemberIds } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { sendInvitationEmail } from "@/lib/email";

// ── Create Invitation ──

/**
 * Invite a user by email to join a project with a specific role.
 *
 * Guards:
 *   - User must not already be a project member.
 *   - No unexpired invitation may exist for the same email + project.
 *
 * On success:
 *   - Creates an Invitation record with a 7-day expiry token.
 *   - Sends an invitation email (fire-and-forget).
 *   - Logs MEMBER_INVITED to the project activity log (fire-and-forget).
 *   - Notifies all current project members via SSE.
 *
 * @param projectId - Project to invite the user to.
 * @param email     - Invitee's email address (normalised to lowercase).
 * @param role      - Project-level role to assign on acceptance (default CONTRACTOR).
 * @returns Invitation metadata including the raw token for link generation.
 */
export async function createInvitation(
  projectId: string,
  email: string,
  role: "OWNER" | "MANAGER" | "CONTRACTOR" | "STAKEHOLDER" | "VIEWER" = "CONTRACTOR"
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "create", "member")) throw new Error("Forbidden");

  const normalizedEmail = email.toLowerCase().trim();

  // Guard: user is already a member
  const existingMember = await db.projectMember.findFirst({
    where: {
      projectId,
      user: { email: normalizedEmail },
    },
  });
  if (existingMember) throw new Error("User is already a member of this project");

  // Guard: active (unexpired) invitation already exists for this email
  const existingInvite = await db.invitation.findFirst({
    where: {
      projectId,
      email: normalizedEmail,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) throw new Error("An invitation has already been sent to this email");

  // Generate a 64-char hex token (256 bits of entropy)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry window

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

  // Activity log — fire-and-forget (never block response on this write)
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "MEMBER_INVITED",
      message: `Invited ${normalizedEmail} as ${role.toLowerCase()}`,
      projectId,
      userId: session.user.id,
      data: { email: normalizedEmail, role },
    },
  }).catch(() => {});

  // Invitation email — fire-and-forget (email delivery is best-effort)
  sendInvitationEmail(
    normalizedEmail,
    invitation.project.name,
    role,
    token,
    session.user.name || session.user.email || "A team member"
  ).catch(() => {});

  // Notify all current project members via SSE
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

// ── Query Invitations ──

/**
 * Fetch all invitations (pending and expired) for a project.
 * Ordered newest first. Used to populate the pending invitations list in the
 * project members panel.
 */
export async function getProjectInvitations(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.invitation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Public token lookup — no auth required.
 * Called by the `/invite/[token]` page before the user signs in, so the page
 * can display the project name, role, and expiry status without a session.
 *
 * @returns Invitation preview object, or `null` if the token does not exist.
 */
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

// ── Accept / Cancel Invitation ──

/**
 * Accept an invitation and join the project.
 *
 * Requires the user to be signed in (redirects to sign-in if not).
 * Uses a DB transaction to atomically create the ProjectMember row and
 * delete the invitation — prevents double-acceptance race conditions.
 *
 * Already-a-member case: if the user accepted a duplicate invite or was
 * added manually in the meantime, the invitation is quietly deleted and
 * `alreadyMember: true` is returned so the UI can show an appropriate message.
 *
 * @param token - The raw invitation token from the URL.
 * @returns `{ success, projectId, projectName, alreadyMember }`
 */
export async function acceptInvitation(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.expiresAt < new Date()) throw new Error("Invitation has expired");

  const session = await auth();
  if (!session?.user) throw new Error("Please sign in to accept this invitation");

  // Check if already a member (e.g. added manually after invitation was sent)
  const existingMember = await db.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: invitation.projectId,
      },
    },
  });

  if (existingMember) {
    // Clean up the stale invitation without adding a duplicate member row
    await db.invitation.delete({ where: { id: invitation.id } });
    return {
      success: true,
      projectId: invitation.projectId,
      projectName: invitation.project.name,
      alreadyMember: true,
    };
  }

  // Atomic: create membership + consume (delete) invitation in one transaction
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

  // Activity log — fire-and-forget
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "MEMBER_JOINED",
      message: `${session.user.name || session.user.email} joined as ${invitation.role.toLowerCase()}`,
      projectId: invitation.projectId,
      userId: session.user.id,
    },
  }).catch(() => {});

  // Notify existing project members
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

/**
 * Hard-delete a pending invitation (cannot be undone).
 * The invitee's token link will return "Invitation not found" after cancellation.
 *
 * Requires: `can(role, "create", "member")` — same permission as creating invitations.
 */
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

// ── Member Role Management ──

/**
 * Change a project member's role.
 *
 * Last-owner guard: if the target member is the last OWNER on the project,
 * their role cannot be changed — prevents projects from becoming ownerless.
 *
 * @param memberId - ProjectMember row ID.
 * @param projectId - Used to validate the member belongs to this project.
 * @param newRole   - Role to assign.
 */
export async function updateMemberRole(
  memberId: string,
  projectId: string,
  newRole: "OWNER" | "MANAGER" | "CONTRACTOR" | "STAKEHOLDER" | "VIEWER"
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "update", "member")) throw new Error("Forbidden");

  const member = await db.projectMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!member) throw new Error("Member not found");
  if (member.projectId !== projectId) throw new Error("Member not in this project");

  // Prevent demoting the last OWNER — the project must always have at least one
  if (member.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await db.projectMember.count({
      where: { projectId, role: "OWNER" },
    });
    if (ownerCount <= 1) throw new Error("Cannot change role of the only project owner");
  }

  await db.projectMember.update({
    where: { id: memberId },
    data: { role: newRole as never },
  });

  // Activity log — fire-and-forget
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "MEMBER_UPDATED",
      message: `Changed ${member.user.name || member.user.email} role to ${newRole.toLowerCase()}`,
      projectId,
      userId: session.user.id,
      data: { memberId, oldRole: member.role, newRole },
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

/**
 * Remove a member from a project entirely.
 *
 * Last-owner guard: the last OWNER cannot be removed — they must first transfer
 * ownership to another member before they can leave or be removed.
 *
 * Requires: `can(role, "delete", "member")`.
 */
export async function removeMember(memberId: string, projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role, "delete", "member")) throw new Error("Forbidden");

  const member = await db.projectMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!member) throw new Error("Member not found");

  // Prevent removing the last OWNER
  if (member.role === "OWNER") {
    const ownerCount = await db.projectMember.count({
      where: { projectId, role: "OWNER" },
    });
    if (ownerCount <= 1) throw new Error("Cannot remove the only project owner");
  }

  await db.projectMember.delete({ where: { id: memberId } });

  // Activity log — fire-and-forget
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "MEMBER_REMOVED",
      message: `Removed ${member.user.name || member.user.email} from project`,
      projectId,
      userId: session.user.id,
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
