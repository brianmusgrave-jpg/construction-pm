import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }
  const count = await db.notification.count({
    where: { userId: session.user.id, read: false },
  });
  return NextResponse.json({ count });
}
