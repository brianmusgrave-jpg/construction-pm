"use server";

/**
 * @file actions/userInvitations.ts
 * @description Server actions for global user invitation and account activation flow.
 *
 * Flow:
 *   1. Admin calls inviteGlobalUser(email, role) → creates AccountInvitation record
 *      with a secure random token → returns the invite URL for sharing
 *   2. Invitee visits /invite/activate/[token] → sees name + password form
 *   3. Invitee submits → activateAccount(token, name, password) is called
 *      → creates or updates User record with bcrypt passwordHash → marks invite used
 *
 * Security:
 *   - invite tokens are 32-byte hex (cryptographically random)
 *   - tokens expire after 7 days
 *   - tokens are single-use (used flag)
 *   - passwords are hashed with bcrypt (cost factor 12)
 *   - only ADMIN role can call inviteGlobalUser
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const dbc = db as any;

// ── Helpers ──

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function getInviteUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
  return `${base}/invite/activate/${token}`;
}

// ── Actions ──

/**
 * Invite a new user to the workspace (global, not project-scoped).
 * Creates an AccountInvitation with a 7-day expiry token.
 * Returns the invite URL so the admin can share it manually.
 * Requires ADMIN role.
 */
export async function inviteGlobalUser(
  email: string,
  role: string
): Promise<{ success: boolean; inviteUrl?: string; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const currentUser = await dbc.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!currentUser || currentUser.role !== "ADMIN") {
    return { success: false, error: "Only admins can invite users" };
  }

  // Normalise email
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists and is active
  const existing = await dbc.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return {
      success: false,
      error: "A user with this email already exists in the system",
    };
  }

  // Invalidate any previous unused invites for this email
  await dbc.accountInvitation.updateMany({
    where: { email: normalizedEmail, used: false },
    data: { used: true },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await dbc.accountInvitation.create({
    data: {
      email: normalizedEmail,
      role,
      token,
      expiresAt,
      invitedById: session.user.id,
    },
  });

  const inviteUrl = getInviteUrl(token);
  return { success: true, inviteUrl };
}

/**
 * Look up an AccountInvitation by token.
 * Returns the invite data (email, role) or null if not found / expired / used.
 */
export async function getAccountInvitationByToken(token: string): Promise<{
  id: string;
  email: string;
  role: string;
  expiresAt: string;
} | null> {
  const invite = await dbc.accountInvitation.findUnique({
    where: { token },
  });

  if (!invite) return null;
  if (invite.used) return null;
  if (new Date(invite.expiresAt) < new Date()) return null;

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

/**
 * Activate a new account from an invite token.
 * Creates the User record (or updates if somehow created already), hashes the
 * password, and marks the invitation as used.
 * Returns success/error — caller should then call signIn() client-side.
 */
export async function activateAccount(
  token: string,
  name: string,
  password: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  // Look up invite
  const invite = await dbc.accountInvitation.findUnique({
    where: { token },
  });

  if (!invite) return { success: false, error: "Invalid invitation link" };
  if (invite.used) return { success: false, error: "This invitation has already been used" };
  if (new Date(invite.expiresAt) < new Date()) {
    return { success: false, error: "This invitation has expired" };
  }

  // Validate inputs
  if (!name.trim()) return { success: false, error: "Name is required" };
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user already exists (edge case: race condition or Google OAuth user)
  const existing = await dbc.user.findUnique({
    where: { email: invite.email },
  });

  if (existing) {
    // Update existing user with password and name if they don't have one
    await dbc.user.update({
      where: { email: invite.email },
      data: {
        name: existing.name || name.trim(),
        passwordHash,
        role: invite.role,
      },
    });
  } else {
    // Create new user
    await dbc.user.create({
      data: {
        email: invite.email,
        name: name.trim(),
        role: invite.role,
        passwordHash,
        emailVerified: new Date(), // Treat invite acceptance as email verification
      },
    });
  }

  // Mark invite as used
  await dbc.accountInvitation.update({
    where: { token },
    data: { used: true },
  });

  return { success: true, email: invite.email };
}
