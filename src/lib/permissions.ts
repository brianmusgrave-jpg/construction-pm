/**
 * @file permissions.ts
 * @description Role-based access control (RBAC) for Construction PM.
 *
 * Role hierarchy (highest → lowest access):
 *   ADMIN > PROJECT_MANAGER > CONTRACTOR > STAKEHOLDER > VIEWER
 *
 * Permissions are project-scoped: a user's role is stored on ProjectMember,
 * not globally. Always pass the role from the relevant ProjectMember record.
 *
 * Usage:
 *   import { can } from "@/lib/permissions";
 *   if (!can(memberRole, "update", "phase")) throw new Error("Forbidden");
 *
 * IMPORTANT: Only use Action values defined below. Using "edit" instead of
 * "update" is a TypeScript error that causes Vercel build failures.
 */

/** All mutation and read actions that can be granted on a resource. */
export type Action = "view" | "create" | "update" | "delete" | "manage";

/** All resource types covered by the permission system. */
export type Resource =
  | "project"
  | "phase"
  | "document"
  | "photo"
  | "staff"
  | "checklist"
  | "member"
  | "notification";

/** Internal permission lookup table: role → resource → allowed actions. */
type PermissionMap = Record<string, Record<Resource, Action[]>>;

/**
 * Static permission matrix. Each role gets a defined set of actions per resource.
 *
 * CONTRACTOR note: phase "update" is further constrained to assigned phases only —
 * that scoping logic lives in individual server actions, not here.
 */
const permissions: PermissionMap = {
  ADMIN: {
    project: ["view", "create", "update", "delete", "manage"],
    phase: ["view", "create", "update", "delete", "manage"],
    document: ["view", "create", "update", "delete"],
    photo: ["view", "create", "delete"],
    staff: ["view", "create", "update", "delete"],
    checklist: ["view", "create", "update", "delete"],
    member: ["view", "create", "update", "delete"],
    notification: ["view", "update"],
  },
  PROJECT_MANAGER: {
    project: ["view", "create", "update"],
    phase: ["view", "create", "update", "manage"],
    document: ["view", "create", "update"],
    photo: ["view", "create"],
    staff: ["view", "create", "update"],
    checklist: ["view", "create", "update"],
    member: ["view", "create", "update"],
    notification: ["view", "update"],
  },
  CONTRACTOR: {
    project: ["view"],
    phase: ["view", "update"], // Only assigned phases — enforced in server actions
    document: ["view", "create"],
    photo: ["view", "create"],
    staff: ["view"],
    checklist: ["view", "update"],
    member: ["view"],
    notification: ["view", "update"],
  },
  STAKEHOLDER: {
    project: ["view"],
    phase: ["view"],
    document: ["view"],
    photo: ["view"],
    staff: ["view"],
    checklist: ["view"],
    member: ["view"],
    notification: ["view", "update"],
  },
  VIEWER: {
    project: ["view"],
    phase: ["view"],
    document: ["view"],
    photo: ["view"],
    staff: [], // VIEWERs cannot see staff directory
    checklist: ["view"],
    member: [], // VIEWERs cannot see member list
    notification: ["view", "update"],
  },
};

/**
 * Check whether a role has permission to perform an action on a resource.
 * Returns false for unknown roles (safe default: deny).
 *
 * @param role - The user's project-level role (e.g. "PROJECT_MANAGER")
 * @param action - The action to check (e.g. "update")
 * @param resource - The resource type (e.g. "phase")
 */
export function can(role: string, action: Action, resource: Resource): boolean {
  return permissions[role]?.[resource]?.includes(action) ?? false;
}

/**
 * Check whether a role has permission for ANY of the given actions on a resource.
 * Useful for rendering UI that requires at least one of several capabilities.
 *
 * @param role - The user's project-level role
 * @param actions - Array of actions to test (OR logic)
 * @param resource - The resource type
 */
export function canAny(
  role: string,
  actions: Action[],
  resource: Resource
): boolean {
  return actions.some((action) => can(role, action, resource));
}

// ── Project Membership Verification (Security Sprint 36) ──
//
// These helpers enforce that users can only access resources in projects
// they belong to, closing the IDOR vulnerability where global role alone
// was used for authorization.

import { db } from "@/lib/db";

/**
 * Map ProjectMember MemberRole → permission system role string.
 * MemberRole (OWNER, MANAGER, CONTRACTOR, STAKEHOLDER, VIEWER) doesn't match
 * the role keys used by the `can()` function above.
 */
const memberRoleToPermRole: Record<string, string> = {
  OWNER: "ADMIN",
  MANAGER: "PROJECT_MANAGER",
  CONTRACTOR: "CONTRACTOR",
  STAKEHOLDER: "STAKEHOLDER",
  VIEWER: "VIEWER",
};

/**
 * Verify a user is a member of a project and return their project-level role.
 * Throws if the user is not a member. SYSTEM_ADMIN users bypass the check.
 *
 * @param userId - The authenticated user's ID
 * @param projectId - The project to check membership for
 * @param globalRole - The user's global role (for SYSTEM_ADMIN bypass)
 * @returns The permission role string (mapped from MemberRole)
 */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
  globalRole?: string
): Promise<string> {
  // SYSTEM_ADMIN can access any project (God Mode)
  if (globalRole === "SYSTEM_ADMIN") return "ADMIN";

  const member = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });

  if (!member) {
    throw new Error("You are not a member of this project");
  }

  return memberRoleToPermRole[member.role] || "VIEWER";
}

/**
 * Verify project access when you only have a phaseId.
 * Looks up the phase → project, then checks membership.
 *
 * @returns { projectId, role } — the project ID and the user's permission role
 */
export async function verifyProjectAccessViaPhase(
  userId: string,
  phaseId: string,
  globalRole?: string
): Promise<{ projectId: string; role: string }> {
  const phase = await db.phase.findUnique({
    where: { id: phaseId },
    select: { projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  const role = await verifyProjectAccess(userId, phase.projectId, globalRole);
  return { projectId: phase.projectId, role };
}

/**
 * Verify project access and check that the project belongs to the user's org.
 * Double-gate: membership check + org isolation.
 */
export async function verifyOrgProjectAccess(
  userId: string,
  orgId: string,
  projectId: string,
  globalRole?: string
): Promise<string> {
  // SYSTEM_ADMIN bypasses org check
  if (globalRole === "SYSTEM_ADMIN") return "ADMIN";

  // Verify the project belongs to the user's org
  const dbc = db as any;
  const project = await dbc.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project) throw new Error("Project not found");
  if (project.orgId !== orgId) {
    throw new Error("Project does not belong to your organization");
  }

  return verifyProjectAccess(userId, projectId, globalRole);
}

/**
 * Shortcut: can this role create new projects?
 * Only ADMINs and PROJECT_MANAGERs can initiate projects.
 */
export function canCreateProject(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}

/**
 * Shortcut: can this role manage (create, update, reorder) phases?
 * Used to gate the phase builder and Gantt drag-and-drop.
 */
export function canManagePhase(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}

/**
 * Shortcut: can this role request or complete a phase review?
 * Used to gate review workflow buttons on phase detail pages.
 */
export function canReviewPhase(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}
