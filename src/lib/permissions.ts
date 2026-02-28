export type Action = "view" | "create" | "update" | "delete" | "manage";
export type Resource =
  | "project"
  | "phase"
  | "document"
  | "photo"
  | "staff"
  | "checklist"
  | "member"
  | "notification";

type PermissionMap = Record<string, Record<Resource, Action[]>>;

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
    phase: ["view", "update"], // Only assigned phases
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
    staff: [],
    checklist: ["view"],
    member: [],
    notification: ["view", "update"],
  },
};

export function can(role: string, action: Action, resource: Resource): boolean {
  return permissions[role]?.[resource]?.includes(action) ?? false;
}

export function canAny(
  role: string,
  actions: Action[],
  resource: Resource
): boolean {
  return actions.some((action) => can(role, action, resource));
}

export function canCreateProject(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}

export function canManagePhase(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}

export function canReviewPhase(role: string): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}
