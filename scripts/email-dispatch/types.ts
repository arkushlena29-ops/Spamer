// ─────────────────────────────────────────────────────────────────────────────
// types.ts — Shared TypeScript interfaces for the email dispatch worker
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailRow {
  rowIndex: number;
  email: string;
  firstName: string;
  lastName: string;
  [key: string]: unknown;
}

export interface DispatchState {
  lastProcessedIndex: number;
  totalSent: number;
  totalFailed: number;
  startedAt: string;
  lastUpdatedAt: string;
}

/** One SMTP account managed via the UI — stored in data/smtp-accounts.json (committed) */
export interface SmtpAccount {
  id: string;
  email: string;      // SMTP username and From address
  fromName: string;   // display name shown in the inbox
  host: string;
  port: number;
  secure: boolean;    // true = TLS port 465, false = STARTTLS port 587
  dailyLimit: number; // maximum emails allowed to send per calendar day (default 500)
  password?: string;   // SMTP password (stored in json, remove before committing)
}


export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type TemplateId = 1 | 2 | 3;

/** One editable email template stored in data/email-templates.json */
export interface StoredTemplate {
  id: TemplateId;
  name: string;
  subject: string;
  /** Full HTML string; uses {{name}}, {{firstName}}, {{lastName}}, {{to}}, {{subject}} */
  html: string;
  /** Plain-text fallback; same placeholders */
  text: string;
}

// ─── Log / Worker Status types ────────────────────────────────────────────────

export type LogLevel = "info" | "success" | "error" | "warn" | "rate" | "system";

export interface LogEntry {
  id: number;
  ts: string;        // HH:MM:SS
  level: LogLevel;
  message: string;
  email?: string;
  smtpNum?: number;
  smtpHost?: string;
}

export interface WorkerStatus {
  running: boolean;
  stopping: boolean;
  done: boolean;
  error: string | null;
  totalRows: number;
  lastProcessedIndex: number;
  totalSent: number;
  totalFailed: number;
  startedAt: string | null;
}

export type Logger = (entry: Omit<LogEntry, "id" | "ts">) => void;

export type StreamEvent =
  | { type: "log"; data: LogEntry }
  | { type: "status"; data: WorkerStatus };
