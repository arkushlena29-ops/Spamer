// ─────────────────────────────────────────────────────────────────────────────
// accounts-store.ts
//
// Passwords are stored in data/smtp-accounts.json alongside account metadata.
// This file should be gitignored or passwords should be removed before committing.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import type { SmtpAccount } from "../../scripts/email-dispatch/types";

const DATA_DIR  = resolve(process.cwd(), "data");
const JSON_PATH = resolve(DATA_DIR, "smtp-accounts.json");
const JSON_TMP  = resolve(DATA_DIR, "smtp-accounts.json.tmp");

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

export function getAccounts(): SmtpAccount[] {
  return readJson().accounts;
}

export function createAccount(data: Omit<SmtpAccount, "id"> & { password?: string }): SmtpAccount {
  const file = readJson();
  const { password, ...accountData } = data;
  const account: SmtpAccount = { ...accountData, id: randomUUID() };
  if (password) {
    (account as SmtpAccount & { _password?: string })._password = password;
    const allAccounts = [...file.accounts, account];
    writeJson({ accounts: allAccounts });
    const updated = allAccounts.map(a => {
      if (a.id === account.id) {
        return { ...a, password: password };
      }
      return a;
    });
    writeJson({ accounts: updated });
  } else {
    file.accounts.push(account);
    writeJson(file);
  }
  return account;
}

export function updateAccount(
  id: string,
  data: Partial<Omit<SmtpAccount, "id"> & { password?: string }>
): SmtpAccount {
  const file = readJson();
  const idx = file.accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error(`Account ${id} not found`);
  
  const { password, ...accountData } = data;
  file.accounts[idx] = { ...file.accounts[idx], ...accountData };
  
  if (password !== undefined) {
    file.accounts[idx] = { ...file.accounts[idx], password };
  }
  
  writeJson(file);
  return file.accounts[idx];
}

export function deleteAccount(id: string): void {
  const file = readJson();
  const next = file.accounts.filter((a) => a.id !== id);
  if (next.length === file.accounts.length) throw new Error(`Account ${id} not found`);
  writeJson({ accounts: next });
}

export function hasPassword(id: string): boolean {
  const file = readJson();
  const acc = file.accounts.find(a => a.id === id);
  return !!(acc as SmtpAccount & { password?: string })?.password;
}

export function getAccountPassword(id: string): string {
  const file = readJson();
  const acc = file.accounts.find(a => a.id === id);
  return (acc as SmtpAccount & { password?: string })?.password ?? "";
}
