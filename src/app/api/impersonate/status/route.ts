/**
 * @file api/impersonate/status/route.ts
 * @description Lightweight endpoint that returns the current impersonation state.
 *
 * The ImpersonationBanner component calls this on mount to determine if the
 * current session is impersonated. The httpOnly cookie can't be read client-side,
 * so this server route reads it and returns the safe-to-display fields.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("impersonating");
  if (!cookie?.value) {
    return NextResponse.json({ impersonating: false });
  }

  try {
    const data = JSON.parse(cookie.value);
    return NextResponse.json({
      impersonating: true,
      targetUserName: data.targetUserName,
      targetUserRole: data.targetUserRole,
    });
  } catch {
    return NextResponse.json({ impersonating: false });
  }
}
