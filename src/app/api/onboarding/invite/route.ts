/**
 * @file /api/onboarding/invite
 * @description Send team invitations during onboarding (Sprint 17).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitHeaders } from "@/lib/rate-limit";

const dbc = db as any;

/** Roles that can be assigned via invitation (no privilege escalation). */
const ALLOWED_INVITE_ROLES = ["VIEWER", "STAKEHOLDER", "CONTRACTOR", "PROJECT_MANAGER"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 invite batches per minute
  const rl = await rateLimitHeaders(`invite:${session.user.id}`, 20, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many invite requests. Please try again later." },
      { status: 429, headers: rl.headers }
    );
  }

  // Only ADMIN users can send invitations
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "PROJECT_MANAGER" && userRole !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: "Only admins and PMs can send invitations" }, { status: 403 });
  }

  const { invites } = await req.json();
  const orgId = (session.user as any).orgId;
  if (!orgId || !Array.isArray(invites)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Cap batch size to prevent abuse
  if (invites.length > 50) {
    return NextResponse.json({ error: "Maximum 50 invitations per batch" }, { status: 400 });
  }

  const results: Array<{ email: string; status: string }> = [];

  for (const inv of invites) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inv.email || !emailRegex.test(inv.email.trim())) {
      results.push({ email: inv.email || "", status: "invalid_email" });
      continue;
    }

    // Validate invited role — prevent ADMIN/SYSTEM_ADMIN privilege escalation
    const inviteRole = inv.role || "VIEWER";
    if (!ALLOWED_INVITE_ROLES.includes(inviteRole)) {
      results.push({ email: inv.email, status: "invalid_role" });
      continue;
    }

    try {
      // Create an AccountInvitation record
      await dbc.accountInvitation.create({
        data: {
          email: inv.email.toLowerCase().trim(),
          role: inviteRole,
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
