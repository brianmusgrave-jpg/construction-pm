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
