export const runtime = "nodejs";

import { getWorkerManager } from "@/lib/email-worker/worker-manager";

export async function POST() {
  const manager = getWorkerManager();
  manager.stop();
  return Response.json({ ok: true, status: manager.getStatus() });
}
