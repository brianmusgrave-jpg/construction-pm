import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      orgId?: string;
      orgPlan?: string;
      isOrgOwner?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    orgId?: string;
    orgPlan?: string;
    isOrgOwner?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    orgId?: string;
    orgPlan?: string;
    isOrgOwner?: boolean;
  }
}
