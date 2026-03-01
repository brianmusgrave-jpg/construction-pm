/**
 * @file src/lib/org-context.ts
 * @description Helper to extract organization context from the authenticated session.
 * Used by all server actions to scope queries to the current user's org.
 *
 * SYSTEM_ADMIN users have no orgId — they must specify an org when needed.
 * Regular users always have an orgId after Sprint 12 migration.
 */

import { auth } from "@/lib/auth";

export interface OrgContext {
  userId: string;
  role: string;
  orgId: string;
  orgPlan: string;
  isOrgOwner: boolean;
  isSystemAdmin: boolean;
}

/**
 * Get the current user's org context from the session.
 * Throws if not authenticated or if a non-SYSTEM_ADMIN user has no orgId.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const role = session.user.role || "VIEWER";
  const isSystemAdmin = role === "SYSTEM_ADMIN";

  // SYSTEM_ADMIN users don't have an orgId — they operate across all orgs
  if (isSystemAdmin) {
    return {
      userId: session.user.id,
      role,
      orgId: "", // Empty — system admins must specify org explicitly
      orgPlan: "",
      isOrgOwner: false,
      isSystemAdmin: true,
    };
  }

  const orgId = session.user.orgId;
  if (!orgId) {
    throw new Error("User has no organization assigned");
  }

  return {
    userId: session.user.id,
    role,
    orgId,
    orgPlan: session.user.orgPlan || "STARTER",
    isOrgOwner: session.user.isOrgOwner || false,
    isSystemAdmin: false,
  };
}

/**
 * Get orgId for use in Prisma where clauses.
 * Shorthand for the most common pattern in server actions.
 */
export async function requireOrgId(): Promise<string> {
  const ctx = await getOrgContext();
  if (!ctx.orgId) {
    throw new Error("Organization context required for this operation");
  }
  return ctx.orgId;
}
