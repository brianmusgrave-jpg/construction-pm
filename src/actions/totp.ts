"use server";

/**
 * @file actions/totp.ts
 * @description Server actions for TOTP-based two-factor authentication (2FA).
 *
 * Implements RFC 6238 TOTP using `otplib`. The flow is:
 *   1. `setupTotp()` — generate a secret and QR code; save as unverified.
 *   2. `verifyAndEnableTotp(code)` — confirm the user's authenticator app
 *      by checking a TOTP code; marks the secret as verified.
 *   3. `validateTotpCode(userId, code)` — called by the auth middleware on
 *      every sign-in attempt; returns true (allow) if 2FA is not active.
 *   4. `disableTotp()` — delete the TotpSecret record, removing 2FA entirely.
 *
 * Both `otplib` and `qrcode` are loaded via dynamic imports to prevent build
 * failures if the packages are not yet installed. The secret is stored in the
 * `TotpSecret` table (in the generated Prisma types, available via db-types).
 *
 * All mutations require an authenticated session.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";

// ── Dynamic import helpers ──
// Dynamic imports prevent hard build failures when the optional packages are
// not yet installed. After `npm install`, these resolve to the real modules.

/**
 * Lazily load the otplib authenticator.
 * Used for secret generation and TOTP code validation.
 */
async function getOtplib() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authenticator } = await import("otplib");
  return authenticator;
}

/**
 * Lazily load the qrcode library.
 * Handles both default-export (CJS) and named-export (ESM) shapes.
 */
async function getQrcode() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qrcode = await import("qrcode");
  return qrcode.default ?? qrcode; // CJS interop: pick .default if present
}

// ── Queries ──

/**
 * Return the current user's 2FA state without exposing the secret.
 *
 * @returns `{ enabled: false, verified: false }` for unauthenticated users
 *          or when no TotpSecret row exists.
 */
export async function getTotpStatus(): Promise<{ enabled: boolean; verified: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { enabled: false, verified: false };
  const secret = await db.totpSecret.findUnique({ where: { userId: session.user.id } });
  return { enabled: !!secret, verified: !!secret?.verified };
}

// ── Mutations ──

/**
 * Begin the 2FA enrollment flow by generating a new TOTP secret.
 *
 * Builds the `otpauth://totp/…` URI, encodes it as a QR code data URL,
 * and saves the secret (unverified) to the database. If the user had a
 * prior incomplete setup, the old secret is replaced.
 *
 * The caller should display the QR code to the user and prompt them to
 * scan it with an authenticator app, then call `verifyAndEnableTotp`.
 *
 * @returns The raw secret, the otpauth URI, and a base64 QR code data URL.
 * @throws  "Unauthenticated" if no session.
 */
export async function setupTotp(): Promise<{ secret: string; otpAuthUrl: string; qrCodeDataUrl: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const authenticator = await getOtplib();
  const qrcode = await getQrcode();

  const secret = authenticator.generateSecret();
  // Label includes both issuer and account for compatibility with most apps.
  const label = encodeURIComponent(session.user.email ?? session.user.id);
  const issuer = encodeURIComponent("ConstructionPM");
  const otpAuthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
  const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

  // Upsert so that repeated calls to setupTotp (e.g. user loses their phone)
  // replace any previous unverified attempt without leaving orphaned rows.
  await db.totpSecret.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, secret, verified: false },
    update: { secret, verified: false },
  });

  return { secret, otpAuthUrl, qrCodeDataUrl };
}

/**
 * Confirm the user's authenticator app by validating their first TOTP code.
 * On success the secret is marked as `verified: true`, enabling 2FA for
 * all future sign-ins.
 *
 * Must be preceded by `setupTotp` — will error if no pending secret exists.
 *
 * @param code - 6-digit TOTP code from the authenticator app.
 * @returns `{ success: true }` or `{ success: false, error: string }`.
 */
export async function verifyAndEnableTotp(code: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthenticated" };

  const record = await db.totpSecret.findUnique({ where: { userId: session.user.id } });
  if (!record) return { success: false, error: "No 2FA setup in progress" };

  const authenticator = await getOtplib();
  const isValid = authenticator.check(code, record.secret);
  if (!isValid) return { success: false, error: "Invalid code. Try again." };

  await db.totpSecret.update({ where: { userId: session.user.id }, data: { verified: true } });
  return { success: true };
}

/**
 * Validate a TOTP code during sign-in. Called by the auth middleware.
 *
 * Uses an allow-by-default policy: returns `true` (grant access) when the
 * user has not enabled 2FA, so callers don't need to branch on 2FA status.
 *
 * @param userId - The user ID whose secret to look up.
 * @param code   - 6-digit TOTP code provided at sign-in.
 * @returns `true` if the code is valid OR if 2FA is not enabled.
 */
export async function validateTotpCode(userId: string, code: string): Promise<boolean> {
  const record = await db.totpSecret.findUnique({ where: { userId } });
  // Allow-by-default: if 2FA is not enabled or not yet verified, pass through.
  if (!record || !record.verified) return true;

  const authenticator = await getOtplib();
  return authenticator.check(code, record.secret);
}

/**
 * Remove 2FA from the current user's account by deleting their TotpSecret.
 * After this call, sign-in no longer requires a TOTP code.
 *
 * @throws "Unauthenticated" if no session.
 */
export async function disableTotp(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  await db.totpSecret.delete({ where: { userId: session.user.id } });
}
