"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";

// We use dynamic imports so the build doesn't fail if otplib isn't installed yet.
// After running `npm install`, these will resolve correctly.

async function getOtplib() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authenticator } = await import("otplib");
  return authenticator;
}

async function getQrcode() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qrcode = await import("qrcode");
  return qrcode.default ?? qrcode;
}

export async function getTotpStatus(): Promise<{ enabled: boolean; verified: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { enabled: false, verified: false };
  const secret = await db.totpSecret.findUnique({ where: { userId: session.user.id } });
  return { enabled: !!secret, verified: !!secret?.verified };
}

export async function setupTotp(): Promise<{ secret: string; otpAuthUrl: string; qrCodeDataUrl: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const authenticator = await getOtplib();
  const qrcode = await getQrcode();

  const secret = authenticator.generateSecret();
  const label = encodeURIComponent(session.user.email ?? session.user.id);
  const issuer = encodeURIComponent("ConstructionPM");
  const otpAuthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
  const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

  // Save unverified secret (replaces any previous attempt)
  await db.totpSecret.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, secret, verified: false },
    update: { secret, verified: false },
  });

  return { secret, otpAuthUrl, qrCodeDataUrl };
}

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

export async function validateTotpCode(userId: string, code: string): Promise<boolean> {
  const record = await db.totpSecret.findUnique({ where: { userId } });
  if (!record || !record.verified) return true; // 2FA not enabled — allow

  const authenticator = await getOtplib();
  return authenticator.check(code, record.secret);
}

export async function disableTotp(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  await db.totpSecret.delete({ where: { userId: session.user.id } });
}
