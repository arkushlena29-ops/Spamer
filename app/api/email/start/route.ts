export const runtime = "nodejs";

import { getWorkerManager } from "@/lib/email-worker/worker-manager";
import type { RunConfig } from "@/scripts/email-dispatch/runner";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<RunConfig>;

    const manager = getWorkerManager();
    manager.start(body);

    return Response.json({ ok: true, status: manager.getStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isConflict = message === "Worker is already running";
    return Response.json({ ok: false, error: message }, { status: isConflict ? 409 : 500 });
  }
}
