// ─────────────────────────────────────────────────────────────────────────────
// usage-store.ts — Per-account daily send counters
//
// Stored in data/smtp-usage.json (gitignored — runtime state).
// Counter resets automatically when the calendar date changes.
// Writes use write-to-tmp + rename for atomicity.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const DATA_DIR  = resolve(process.cwd(), "data");
const USAGE_PATH = resolve(DATA_DIR, "smtp-usage.json");
const USAGE_TMP  = resolve(DATA_DIR, "smtp-usage.json.tmp");

interface UsageFile {
  /** ISO date string YYYY-MM-DD — when this changes all counters reset. */
  date: string;
  /** Map of account id → emails sent today. */
  sent: Record<string, number>;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFile(): UsageFile {
  try {
    const data = JSON.parse(readFileSync(USAGE_PATH, "utf8")) as UsageFile;
    // New calendar day → drop all counters
    if (data.date !== todayStr()) return { date: todayStr(), sent: {} };
    return data;
  } catch {
    return { date: todayStr(), sent: {} };
  }
}

function writeFile(data: UsageFile): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USAGE_TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(USAGE_TMP, USAGE_PATH);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns today's sent counts keyed by account id. Resets if day has changed. */
export function getDailyUsage(): Record<string, number> {
  return readFile().sent;
}

/** Increment the sent counter for one account. Called after each successful send. */
export function recordSent(accountId: string): void {
  const data = readFile();
  data.sent[accountId] = (data.sent[accountId] ?? 0) + 1;
  writeFile(data);
}

/** How many emails this account has sent today. */
export function getSentToday(accountId: string): number {
  return readFile().sent[accountId] ?? 0;
}

/** Returns true if the account is still allowed to send (sent < dailyLimit). */
export function isUnderLimit(accountId: string, dailyLimit: number): boolean {
  return getSentToday(accountId) < dailyLimit;
}
