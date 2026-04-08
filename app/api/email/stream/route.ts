// SSE endpoint — local use only. Not suitable for serverless deployment
// because the stream never closes while a client is connected.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getWorkerManager } from "@/lib/email-worker/worker-manager";
import type { StreamEvent } from "@/scripts/email-dispatch/types";

export async function GET() {
  const manager = getWorkerManager();
  const encoder = new TextEncoder();

  /** Encode one SSE frame */
  const frame = (event: StreamEvent): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // ── Backfill: send all buffered logs so a reconnecting client
      //    doesn't lose history.
      for (const entry of manager.getLogs()) {
        controller.enqueue(frame({ type: "log", data: entry }));
      }
      // Send current status immediately
      controller.enqueue(frame({ type: "status", data: manager.getStatus() }));

      // ── Subscribe for future events
      unsubscribe = manager.subscribe((event) => {
        try {
          controller.enqueue(frame(event));
        } catch {
          // Controller already closed (client disconnected) — ignore
        }
      });
    },
    cancel() {
      // Client disconnected — clean up the subscription
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Disable Nginx proxy buffering if running behind a reverse proxy
      "X-Accel-Buffering": "no",
      // Tell browsers to reconnect quickly on disconnect
      "retry": "1000",
    },
  });
}
