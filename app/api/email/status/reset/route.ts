export const runtime = "nodejs";

import { getWorkerManager } from "@/lib/email-worker/worker-manager";

export async function POST() {
	try {
		const manager = getWorkerManager();

		// Reset the worker status to initial state
		manager.resetStatus({
			totalRows: 0,
			lastProcessedIndex: -1,
			totalSent: 0,
			totalFailed: 0,
			startedAt: null,
		});

		return Response.json({
			success: true,
			message: "Worker status reset successfully",
		});
	} catch (err) {
		console.error("Error resetting worker status:", err);
		return Response.json({ error: (err as Error).message }, { status: 500 });
	}
}
