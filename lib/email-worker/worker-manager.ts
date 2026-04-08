// ─────────────────────────────────────────────────────────────────────────────
// worker-manager.ts — Singleton that owns the in-process email dispatch worker.
//
// SINGLETON PATTERN:
//   Module-level variables are reset on every Next.js HMR hot-reload.
//   Storing the instance on `globalThis` makes it survive HMR so the worker
//   state (running, logs, progress) is not lost when you edit a file.
//
//   Access via: getWorkerManager()  ← always returns the same instance
// ─────────────────────────────────────────────────────────────────────────────

import { runDispatch, type RunConfig } from "../../scripts/email-dispatch/runner";
import { loadState } from "../../scripts/email-dispatch/state";
import type {
  LogEntry,
  Logger,
  WorkerStatus,
  StreamEvent,
} from "../../scripts/email-dispatch/types";

const LOG_BUFFER_SIZE = 500;
const GLOBAL_KEY = "__emailWorkerManager__";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subscriber = (event: StreamEvent) => void;

// ─── WorkerManager class ──────────────────────────────────────────────────────

class WorkerManager {
  private status: WorkerStatus;

  constructor() {
    const persisted = loadState();
    this.status = {
      running: false,
      stopping: false,
      done: false,
      error: null,
      totalRows: 0,
      lastProcessedIndex: persisted.lastProcessedIndex,
      totalSent: persisted.totalSent,
      totalFailed: persisted.totalFailed,
      startedAt: null,
    };
  }

  private logs: LogEntry[] = [];
  private logCounter = 0;
  private subscribers = new Set<Subscriber>();
  private abortController: AbortController | null = null;

  // ── Pub/sub ────────────────────────────────────────────────────────────────

  /** Register a listener for live events. Returns an unsubscribe function. */
  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private publish(event: StreamEvent): void {
    this.subscribers.forEach((cb) => {
      try { cb(event); } catch { /* subscriber died — ignore */ }
    });
  }

  // ── Logger ─────────────────────────────────────────────────────────────────

  private makeLogger(): Logger {
    return (raw) => {
      const entry: LogEntry = {
        id: ++this.logCounter,
        ts: new Date().toTimeString().slice(0, 8),
        level: raw.level,
        message: raw.message,
        email: raw.email,
        smtpNum: raw.smtpNum,
        smtpHost: raw.smtpHost,
      };

      // Ring buffer — cap at LOG_BUFFER_SIZE
      this.logs.push(entry);
      if (this.logs.length > LOG_BUFFER_SIZE) {
        this.logs.splice(0, this.logs.length - LOG_BUFFER_SIZE);
      }

      this.publish({ type: "log", data: entry });
    };
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  private setStatus(patch: Partial<WorkerStatus>): void {
    this.status = { ...this.status, ...patch };
    this.publish({ type: "status", data: { ...this.status } });
  }

  getStatus(): WorkerStatus {
    return { ...this.status };
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // ── Start ──────────────────────────────────────────────────────────────────

  start(config?: Partial<RunConfig>): void {
    // ── Guard: prevent double-start ──────────────────────────────────────────
    // This check + set happens synchronously (before any await) so two
    // concurrent POST /api/email/start requests cannot both slip through.
    if (this.status.running) {
      throw new Error("Worker is already running");
    }

    this.abortController = new AbortController();

    this.setStatus({
      running: true,
      stopping: false,
      done: false,
      error: null,
      startedAt: new Date().toISOString(),
    });

    const log = this.makeLogger();

    // Fire and forget — the async loop runs independently of the HTTP request.
    // We deliberately catch all errors so a crash never propagates to the
    // Next.js request handler and never rejects an unhandled promise.
    runDispatch({
      config,
      signal: this.abortController.signal,
      log,
      onProgress: (patch) => this.setStatus(patch as Partial<WorkerStatus>),
    })
      .then(() => {
        this.setStatus({ running: false, stopping: false, done: true });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log({ level: "error", message: `Worker crashed: ${msg}` });
        this.setStatus({ running: false, stopping: false, error: msg });
      });
  }

  // ── Stop ───────────────────────────────────────────────────────────────────

  stop(): void {
    if (!this.status.running || !this.abortController) return;
    this.setStatus({ stopping: true });
    this.abortController.abort();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton accessor — safe across Next.js HMR
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __emailWorkerManager__: WorkerManager | undefined;
}

export function getWorkerManager(): WorkerManager {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new WorkerManager();
  }
  return globalThis[GLOBAL_KEY] as WorkerManager;
}
