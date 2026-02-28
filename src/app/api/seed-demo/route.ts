/**
 * @file src/app/api/seed-demo/route.ts
 * @description Removed demo seed endpoint. Returns 410 Gone to indicate this
 * route is no longer available.
 */
import { NextResponse } from "next/server";

// Seed endpoint removed — data has been seeded
export async function POST() {
  return NextResponse.json({ error: "This endpoint has been removed" }, { status: 410 });
}
