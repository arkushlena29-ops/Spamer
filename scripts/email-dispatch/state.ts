// ─────────────────────────────────────────────────────────────────────────────
// state.ts — Atomic read/write of progress.json
//
// RESUMABILITY MECHANISM:
//   After every successful send, saveState() writes the current row index to
//   data/progress.json using an atomic rename:
//     1. Write new state → progress.json.tmp
//     2. fs.renameSync(tmp → progress.json)   ← atomic on Linux/macOS/Windows
//   If the process crashes between steps 1 and 2, the old progress.json is
//   still intact — zero data loss.  If it crashes after step 2, the index is
//   already advanced — no duplicate send.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { resolve } from "path";
import type { DispatchState } from "./types";

const DATA_DIR = resolve(process.cwd(), "data");
const STATE_FILE = resolve(DATA_DIR, "progress.json");
const STATE_FILE_TMP = resolve(DATA_DIR, "progress.json.tmp");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export const INITIAL_STATE: DispatchState = {
  lastProcessedIndex: -1, // nothing sent yet
  totalSent: 0,
  totalFailed: 0,
  startedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
};

/**
 * Load persisted state from disk.
 * Returns INITIAL_STATE when no file exists (first run).
 */
export function loadState(): DispatchState {
  if (!existsSync(STATE_FILE)) {
    console.log("[State] No progress.json found — starting fresh.");
    return { ...INITIAL_STATE };
  }

  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const state = JSON.parse(raw) as DispatchState;

    console.log(
      `[State] Resuming: last sent index=${state.lastProcessedIndex}, ` +
        `totalSent=${state.totalSent}, totalFailed=${state.totalFailed}`
    );
    return state;
  } catch {
    // Corrupted file — back it up and start over
    const backup = STATE_FILE.replace(".json", `_corrupt_${Date.now()}.json`);
    renameSync(STATE_FILE, backup);
    console.warn(`[State] progress.json was corrupt — backed up to ${backup}, starting fresh.`);
    return { ...INITIAL_STATE };
  }
}

/**
 * Atomically persist state to disk.
 * Called after every successful send so the index is always up to date.
 */
export function saveState(state: DispatchState): void {
  ensureDataDir();
  const updated: DispatchState = {
    ...state,
    lastUpdatedAt: new Date().toISOString(),
  };

  // Step 1 — write to a temp file
  writeFileSync(STATE_FILE_TMP, JSON.stringify(updated, null, 2), "utf8");

  // Step 2 — atomic rename (replaces progress.json in one OS-level operation)
  renameSync(STATE_FILE_TMP, STATE_FILE);
}

/**
 * Delete (or back up) progress.json so the next run starts from row 0.
 * Called when EMAIL_RESET=true is set.
 */
export function resetState(): void {
  if (existsSync(STATE_FILE)) {
    const backup = STATE_FILE.replace(".json", `_backup_${Date.now()}.json`);
    renameSync(STATE_FILE, backup);
    console.log(`[State] Reset requested. Old state backed up to ${backup}`);
  } else {
    console.log("[State] Reset requested but no progress.json found — nothing to reset.");
  }
}
