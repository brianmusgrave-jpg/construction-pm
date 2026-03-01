/**
 * @file /api/onboarding/company
 * @description Update org company info during onboarding (Sprint 17).
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

  const { name, address, phone } = await req.json();
  const orgId = (session.user as any).orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  await dbc.organization.update({
    where: { id: orgId },
    data: {
      name: name || undefined,
    },
  });

  // Update or create OrgSettings with address/phone
  await dbc.orgSettings.upsert({
    where: { orgId },
    create: {
      orgId,
      companyAddress: address || null,
      companyPhone: phone || null,
    },
    update: {
      companyAddress: address || undefined,
      companyPhone: phone || undefined,
    },
  });

  return NextResponse.json({ success: true });
}
