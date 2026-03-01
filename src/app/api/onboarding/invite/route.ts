/**
 * @file /api/onboarding/invite
 * @description Send team invitations during onboarding (Sprint 17).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const dbc = db as any;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invites } = await req.json();
  const orgId = (session.user as any).orgId;
  if (!orgId || !Array.isArray(invites)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const results: Array<{ email: string; status: string }> = [];

  for (const inv of invites) {
    if (!inv.email || !inv.email.includes("@")) continue;

    try {
      // Create an AccountInvitation record
      await dbc.accountInvitation.create({
        data: {
          email: inv.email.toLowerCase().trim(),
          role: inv.role || "VIEWER",
          orgId,
          invitedById: session.user.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      results.push({ email: inv.email, status: "invited" });
    } catch (err: any) {
      // Likely duplicate — skip silently
      results.push({ email: inv.email, status: "skipped" });
    }
  }

  return NextResponse.json({ success: true, results });
}
