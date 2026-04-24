export const runtime = "nodejs";

import * as fs from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(process.cwd(), "data");
const STATE_FILE = resolve(DATA_DIR, "progress.json");
const GLOBAL_KEY = "__emailWorkerManager__";

export async function POST() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const state = {
    lastProcessedIndex: -1,
    totalSent: 0,
    totalFailed: 0,
    startedAt: null,
    lastUpdatedAt: null,
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");

  const usagePath = resolve(DATA_DIR, "smtp-usage.json");
  if (fs.existsSync(usagePath)) {
    fs.unlinkSync(usagePath);
  }

  // Clear in-memory worker state
  if (globalThis[GLOBAL_KEY]) {
    const manager = globalThis[GLOBAL_KEY] as any;
    manager.status = {
      running: false,
      stopping: false,
      done: false,
      error: null,
      totalRows: 0,
      lastProcessedIndex: -1,
      totalSent: 0,
      totalFailed: 0,
      startedAt: null,
    };
    manager.logs = [];
  }

  return Response.json({ ok: true });
}