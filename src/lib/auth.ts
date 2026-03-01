/**
 * @file auth.ts
 * @description NextAuth v5 configuration for Construction PM.
 *
 * Auth strategy: JWT sessions (no DB session table required).
 * The JWT stores user.id, user.role, and org context (orgId, orgPlan, isOrgOwner)
 * so server actions can check permissions and tenant scope without a DB roundtrip.
 *
 * Providers:
 *   1. Google OAuth — optional, only active when GOOGLE_CLIENT_ID is set.
 *   2. Credentials (email + optional password):
 *      - If user has a passwordHash: requires correct password (bcrypt verify)
 *      - If user has no passwordHash: email-only login still works (legacy accounts)
 *      This allows existing admin/seed accounts to keep working while new
 *      invited users must use the password they set during account activation.
 *
 * Custom pages:
 *   /login — used for both sign-in and auth errors.
 *
 * Exported:
 *   handlers — GET/POST route handlers for /api/auth/[...nextauth]
 *   auth     — getServerSession equivalent for App Router server components
 *   signIn / signOut — programmatic auth triggers
 */

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const dbc = db as any;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // PrismaAdapter handles User, Account, Session, VerificationToken tables.
  adapter: PrismaAdapter(db),

  providers: [
    // Google OAuth — conditionally included based on env vars.
    // If GOOGLE_CLIENT_ID is missing, Google login is simply not offered.
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    // Email + password credentials login.
    // Backward compatible: users without a passwordHash can still log in with
    // email only (legacy seed/admin accounts). New invited users set a password
    // during account activation and must provide it to log in.
    Credentials({
      name: "Email Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email as string;
        const password = (credentials.password as string) || "";

        // Look up the user by email, include org info for JWT
        const user = await dbc.user.findUnique({
          where: { email },
          include: { org: true },
        });
        if (!user) return null;

        // If the user has a password hash, verify the provided password
        if (user.passwordHash) {
          if (!password) return null; // Password required but not provided
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
        }
        // If no passwordHash, allow login with just email (legacy accounts)

        // Attach org context for the JWT callback
        return {
          ...user,
          orgPlan: user.org?.plan || null,
        };
      },
    }),
  ],

  session: {
    // JWT strategy: session data is stored in a signed cookie, not the DB.
    // This avoids a DB hit on every request while still allowing role checks.
    strategy: "jwt",
  },

  callbacks: {
    /**
     * jwt callback: runs when the JWT is created or refreshed.
     * Copies user.id, user.role, and org context from the DB user record
     * into the token so they're available in the session without DB queries.
     *
     * SYSTEM_ADMIN users have no orgId — they operate across all orgs.
     */
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.id = user.id!;
        token.role = u.role || "VIEWER";
        token.orgId = u.orgId || undefined;
        token.orgPlan = u.orgPlan || undefined;
        token.isOrgOwner = u.isOrgOwner || false;
      }
      return token;
    },

    /**
     * session callback: runs when session() is called in a server component.
     * Copies id, role, and org context from the JWT token into the session
     * object so client-side code and server actions can access them.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.orgId = token.orgId as string | undefined;
        session.user.orgPlan = token.orgPlan as string | undefined;
        session.user.isOrgOwner = token.isOrgOwner as boolean | undefined;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login", // Custom login page
    error: "/login",  // Auth errors redirect to login (error param appended)
  },
});
