/**
 * @file /api/onboarding/project
 * @description Create first project during onboarding (Sprint 17).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, address, startDate } = await req.json();
  const orgId = (session.user as any).orgId;
  if (!orgId || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const dbc2 = db as any;
  const project = await dbc2.project.create({
    data: {
      name,
      address: address || null,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: "ACTIVE",
      orgId,
    },
  });

  // Add the creator as a project member (ADMIN)
  const dbc = db as any;
  await dbc.projectMember.create({
    data: {
      projectId: project.id,
      userId: session.user.id,
      role: "ADMIN",
      isOwner: true,
    },
  });

  return NextResponse.json({ success: true, projectId: project.id });
}
