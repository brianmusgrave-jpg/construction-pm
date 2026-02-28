import { NextResponse } from "next/server";

// Seed endpoint removed — data has been seeded
export async function POST() {
  return NextResponse.json({ error: "This endpoint has been removed" }, { status: 410 });
}
