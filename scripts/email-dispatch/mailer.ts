import nodemailer, { type Transporter } from "nodemailer";
import { getDailyUsage, recordSent } from "../../lib/email-worker/usage-store";
import type { SmtpAccount, EmailPayload, Logger } from "./types";

export class MailDispatcher {
  private readonly accounts: SmtpAccount[];
  private readonly transporters: Transporter[];
  private readonly log: Logger;

  /** In-memory mirror of today's usage — loaded once, updated on every send. */
  private usage: Record<string, number>;

  constructor(
    accounts: SmtpAccount[],
    password: string,
    log: Logger = (e) => console.log(`[Mailer] ${e.message}`)
  ) {
    if (accounts.length === 0) throw new Error("SMTP аккаунты не настроены");
    this.log       = log;
    this.accounts  = accounts;
    this.usage     = getDailyUsage(); // snapshot — kept in sync via recordSent()
    this.transporters = accounts.map((acc) =>
      nodemailer.createTransport({
        host: acc.host,
        port: acc.port,
        secure: acc.secure,
        auth: { user: acc.email, pass: password },
        pool: true,
        maxConnections: 2,
        maxMessages: 200,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    );
  }

  async verifyAll(): Promise<void> {
    for (let i = 0; i < this.accounts.length; i++) {
      const acc = this.accounts[i];
      try {
        await this.transporters[i].verify();
        this.log({ level: "system", message: `SMTP #${i + 1} (${acc.host}) — ОК ✓` });
      } catch (err) {
        throw new Error(`SMTP #${i + 1} (${acc.host}) failed: ${(err as Error).message}`);
      }
    }
  }

  // ─── Slot selection ──────────────────────────────────────────────────────────

  /**
   * Find the next available account starting from `rowIndex % N`.
   * Throws if every account has reached its daily limit.
   */
  private getAvailableSlot(rowIndex: number): number {
    const n     = this.accounts.length;
    const start = rowIndex % n;

    for (let i = 0; i < n; i++) {
      const candidate = (start + i) % n;
      const acc       = this.accounts[candidate];
      const sent      = this.usage[acc.id] ?? 0;
      if (sent < acc.dailyLimit) return candidate;
    }

    // Build a helpful summary for the error log
    const summary = this.accounts
      .map((a) => `${a.email} (${this.usage[a.id] ?? 0}/${a.dailyLimit})`)
      .join(", ");
    throw new Error(`Все SMTP аккаунты достигли дневного лимита — ${summary}`);
  }

  // ─── Info helpers (called before send() in runner.ts for logging) ────────────

  getFrom(rowIndex: number): string {
    const acc = this.accounts[this.getAvailableSlot(rowIndex)];
    return `"${acc.fromName}" <${acc.email}>`;
  }

  getSmtpNumber(rowIndex: number): number {
    return this.getAvailableSlot(rowIndex) + 1;
  }

  getSmtpHost(rowIndex: number): string {
    return this.accounts[this.getAvailableSlot(rowIndex)].host;
  }

  // ─── Send ────────────────────────────────────────────────────────────────────

  async send(payload: EmailPayload, rowIndex: number): Promise<void> {
    const slot = this.getAvailableSlot(rowIndex);
    const acc  = this.accounts[slot];

    await this.transporters[slot].sendMail({
      from: payload.from, to: payload.to,
      subject: payload.subject, html: payload.html, text: payload.text,
    });

    // Update both the persistent store and the in-memory cache
    recordSent(acc.id);
    this.usage[acc.id] = (this.usage[acc.id] ?? 0) + 1;

    // Warn when approaching the limit
    const sent  = this.usage[acc.id];
    const limit = acc.dailyLimit;
    if (sent === limit) {
      this.log({ level: "warn", message: `SMTP #${slot + 1} (${acc.email}) достиг дневного лимита ${limit}` });
    } else if (sent === Math.floor(limit * 0.9)) {
      this.log({ level: "warn", message: `SMTP #${slot + 1} (${acc.email}) на 90% дневного лимита (${sent}/${limit})` });
    }
  }

  closeAll(): void { this.transporters.forEach((t) => t.close()); }
}
