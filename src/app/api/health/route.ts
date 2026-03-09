/**
 * @file src/app/api/health/route.ts
 * @description Health check endpoint for uptime monitoring.
 * Returns 200 with status, timestamp, version, and DB connectivity.
 * Public — no auth required (added to middleware public paths).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const dbc = db as any;

export async function GET() {
  let dbStatus = "disconnected";

  try {
    await dbc.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: "4.27",
      database: dbStatus,
    },
    {
      status: dbStatus === "connected" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
