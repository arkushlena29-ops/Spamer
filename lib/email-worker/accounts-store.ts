// ─────────────────────────────────────────────────────────────────────────────
// accounts-store.ts
//
// STORAGE SPLIT (survives git pulls, fresh clones, and dev reloads):
//
//   data/smtp-accounts.json   ← account metadata (email, host, port…)
//                                committed to git — never lost
//
//   .env.local                ← one shared password: SMTP_PASSWORD=xxx
//                                gitignored — stays on this machine
//
// Passwords are read directly from .env.local at runtime so changes take
// effect immediately without restarting the dev server.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import type { SmtpAccount } from "../../scripts/email-dispatch/types";

const DATA_DIR  = resolve(process.cwd(), "data");
const JSON_PATH = resolve(DATA_DIR, "smtp-accounts.json");
const JSON_TMP  = resolve(DATA_DIR, "smtp-accounts.json.tmp");
const ENV_PATH  = resolve(process.cwd(), ".env.local");
const PASS_KEY  = "SMTP_PASSWORD";

// ─── JSON (metadata) ─────────────────────────────────────────────────────────

interface AccountsFile { accounts: SmtpAccount[] }

function readJson(): AccountsFile {
  if (!existsSync(JSON_PATH)) return { accounts: [] };
  try { return JSON.parse(readFileSync(JSON_PATH, "utf8")) as AccountsFile; }
  catch { return { accounts: [] }; }
}

function writeJson(data: AccountsFile): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(JSON_TMP, JSON.stringify(data, null, 2), "utf8");
  renameSync(JSON_TMP, JSON_PATH);
}

// ─── .env.local (shared password) ────────────────────────────────────────────

/** Read a single key from .env.local, bypassing the process.env cache. */
function readEnvKey(key: string): string {
  if (!existsSync(ENV_PATH)) return "";
  for (const raw of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.startsWith(key + "=")) return line.slice(key.length + 1).trim();
  }
  return "";
}

/** Write or replace a single key in .env.local. */
function writeEnvKey(key: string, value: string): void {
  const content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  const updated = re.test(content)
    ? content.replace(re, `${key}=${value}`)
    : content.trimEnd() + `\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, updated, "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAccounts(): SmtpAccount[] {
  return readJson().accounts;
}

/** The shared SMTP password read directly from .env.local. */
export function getPassword(): string {
  return readEnvKey(PASS_KEY);
}

export function setPassword(password: string): void {
  writeEnvKey(PASS_KEY, password);
}

export function createAccount(data: Omit<SmtpAccount, "id">): SmtpAccount {
  const file = readJson();
  const account: SmtpAccount = { ...data, id: randomUUID() };
  file.accounts.push(account);
  writeJson(file);
  return account;
}

export function updateAccount(
  id: string,
  data: Partial<Omit<SmtpAccount, "id">>
): SmtpAccount {
  const file = readJson();
  const idx = file.accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error(`Account ${id} not found`);
  file.accounts[idx] = { ...file.accounts[idx], ...data };
  writeJson(file);
  return file.accounts[idx];
}

export function deleteAccount(id: string): void {
  const file = readJson();
  const next = file.accounts.filter((a) => a.id !== id);
  if (next.length === file.accounts.length) throw new Error(`Account ${id} not found`);
  writeJson({ accounts: next });
}
