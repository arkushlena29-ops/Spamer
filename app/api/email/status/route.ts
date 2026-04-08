export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getWorkerManager } from "@/lib/email-worker/worker-manager";

export async function GET() {
  const manager = getWorkerManager();
  return Response.json({
    status: manager.getStatus(),
    // Send the last 100 log lines for initial UI population
    logs: manager.getLogs().slice(-100),
  });
}
