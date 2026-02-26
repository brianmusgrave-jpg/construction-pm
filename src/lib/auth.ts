/**
 * @file auth.ts
 * @description NextAuth v5 configuration for Construction PM.
 *
 * Auth strategy: JWT sessions (no DB session table required).
 * The JWT stores user.id and user.role so server actions can check
 * permissions without a DB roundtrip.
 *
 * Providers:
 *   1. Google OAuth — optional, only active when GOOGLE_CLIENT_ID is set.
 *   2. Credentials (email-only) — looks up user by email, no password.
 *      Relies on invite-token flow to create accounts before login.
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
import { db } from "@/lib/db";

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

    // Email-only credentials login. No password — users must be invited first.
    // The authorize function returns the User record or null (rejected).
    Credentials({
      name: "Email Login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email as string;
        // Look up the user by email; return null if not found (login rejected).
        const user = await db.user.findUnique({ where: { email } });
        if (user) return user;
        return null;
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
     * Copies user.id and user.role from the DB user record into the token
     * so they're available in the session without additional DB queries.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "VIEWER"; // Default to lowest role
      }
      return token;
    },

    /**
     * session callback: runs when session() is called in a server component.
     * Copies id and role from the JWT token into the session object so
     * client-side code and server actions can access them via session.user.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login", // Custom login page
    error: "/login",  // Auth errors redirect to login (error param appended)
  },
});
