/**
 * @file api/impersonate/route.ts
 * @description Impersonation callback endpoint for SYSTEM_ADMIN God Mode.
 *
 * Flow:
 *   1. Admin clicks "Impersonate" in the system-admin panel
 *   2. `createImpersonationToken()` generates a 30-min single-use token
 *   3. Admin is redirected to `/api/impersonate?token=<hex>`
 *   4. This route validates the token, sets an `impersonating` cookie with the
 *      target user's ID and the admin's ID, then redirects to /dashboard
 *   5. The middleware reads the cookie and shows the ImpersonationBanner
 *   6. "Exit" clears the cookie and redirects back to /system-admin
 *
 * Security:
 *   - Token is single-use (marked usedAt on consumption)
 *   - Token expires after 30 minutes
 *   - Cookie is httpOnly, secure, SameSite=Strict
 *   - The impersonation cookie stores JSON: { adminId, targetUserId, targetUserName }
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeImpersonationToken } from "@/actions/system-admin";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const exit = req.nextUrl.searchParams.get("exit");

  // ── Exit impersonation ──
  if (exit === "1") {
    const res = NextResponse.redirect(new URL("/system-admin", req.url));
    res.cookies.delete("impersonating");
    return res;
  }

  // ── Start impersonation ──
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await consumeImpersonationToken(token);
  if (!result || !result.targetUser) {
    return NextResponse.json(
      { error: "Invalid, expired, or already-used impersonation token" },
      { status: 403 }
    );
  }

  const { targetUser, adminId } = result;

  // Set impersonation cookie — the middleware and layout will use this to
  // show the warning banner and optionally override the session context
  const cookieValue = JSON.stringify({
    adminId,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name ?? targetUser.email,
    targetUserRole: targetUser.role,
    targetUserOrgId: targetUser.orgId,
  });

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("impersonating", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60, // 30 minutes, matching the token expiry
    path: "/",
  });

  return res;
}
