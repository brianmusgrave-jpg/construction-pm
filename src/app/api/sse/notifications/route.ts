/**
 * @file src/app/api/sse/notifications/route.ts
 * @description Server-Sent Events stream for real-time notification delivery.
 * Sends an initial unread count and polls every 30 seconds; cleans up on abort
 * signal. Uses force-dynamic and Node.js runtime.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Send initial unread count immediately
      const count = await db.notification.count({
        where: { userId, read: false },
      });
      send({ type: "unread_count", count });

      // Poll every 15s and push updates
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          const latest = await db.notification.count({
            where: { userId, read: false },
          });
          send({ type: "unread_count", count: latest });
        } catch {
          clearInterval(interval);
          closed = true;
        }
      }, 30_000);

      // Clean up if client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
