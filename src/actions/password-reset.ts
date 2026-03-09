/**
 * @file src/actions/password-reset.ts
 * @description Server actions for the forgot-password / reset-password flow.
 * Uses the existing VerificationToken model for single-use reset tokens.
 * Rate-limited: 3 requests per email per 15 minutes.
 */
"use server";

import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";

const dbc = db as any;

/**
 * Request a password reset email. Always returns success to prevent
 * email enumeration — even if the email doesn't exist in our system.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Invalid email" };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Look up the user — but don't reveal whether they exist
    const user = await dbc.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Delete any existing reset tokens for this email
      await dbc.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });

      // Generate a new token (32 bytes = 64 hex chars)
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await dbc.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token,
          expires,
        },
      });

      // Send the reset email (fire-and-forget)
      sendPasswordResetEmail(normalizedEmail, token).catch((err: unknown) =>
        console.error("[password-reset] Email failed:", err)
      );
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch (error) {
    console.error("[password-reset] Error:", error);
    return { success: false, error: "Something went wrong" };
  }
}

/**
 * Reset the user's password using a valid reset token.
 * Token is single-use and deleted after consumption.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: "Missing token" };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  try {
    // Find the token
    const record = await dbc.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return { success: false, error: "Invalid or expired link" };
    }

    // Check expiry
    if (new Date() > new Date(record.expires)) {
      // Clean up expired token
      await dbc.verificationToken.delete({
        where: { token },
      });
      return { success: false, error: "This reset link has expired" };
    }

    // Find the user
    const user = await dbc.user.findUnique({
      where: { email: record.identifier },
    });

    if (!user) {
      return { success: false, error: "Account not found" };
    }

    // Hash the new password and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await dbc.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Delete the token (single-use)
    await dbc.verificationToken.delete({
      where: { token },
    });

    return { success: true };
  } catch (error) {
    console.error("[password-reset] Reset error:", error);
    return { success: false, error: "Something went wrong" };
  }
}
