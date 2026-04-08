import nodemailer, { type Transporter } from "nodemailer";
import { getDailyUsage, recordSent } from "../../lib/email-worker/usage-store";
import type { SmtpAccount, EmailPayload, Logger } from "./types";

export class MailDispatcher {
	private readonly accounts: SmtpAccount[];
	private readonly passwords: Record<string, string>;
	private readonly transporters: Transporter[];
	private readonly log: Logger;

	private usage: Record<string, number>;

	constructor(
		accounts: SmtpAccount[],
		passwords: Record<string, string>,
		log: Logger = (e) => console.log(`[Mailer] ${e.message}`),
	) {
		if (accounts.length === 0) throw new Error("SMTP аккаунты не настроены");
		this.log = log;
		this.accounts = accounts;
		this.passwords = passwords;
		this.usage = getDailyUsage();
		this.transporters = accounts.map((acc) => {
			const pass = passwords[acc.id];
			if (!pass) throw new Error(`Пароль для ${acc.email} не установлен`);
			const config: Record<string, unknown> = {
				host: acc.host,
				port: acc.port,
				auth: { user: acc.email, pass },
				pool: true,
				maxConnections: 2,
				maxMessages: 200,
				connectionTimeout: 10_000,
				greetingTimeout: 10_000,
				socketTimeout: 30_000,
				family: 4,
				tls: {
					rejectUnauthorized: false,
				},
			};
			if (acc.port === 465) {
				config.secure = true;
			} else {
				config.secure = false;
				config.requireTLS = true;
			}
			return nodemailer.createTransport(config);
		});
	}

	async verifyAll(): Promise<void> {
		for (let i = 0; i < this.accounts.length; i++) {
			const acc = this.accounts[i];
			try {
				await this.transporters[i].verify();
				this.log({
					level: "system",
					message: `SMTP #${i + 1} (${acc.host}) — ОК ✓`,
				});
			} catch (err) {
				throw new Error(
					`SMTP #${i + 1} (${acc.host}) не подключился: ${(err as Error).message}`,
				);
			}
		}
	}

	private getAvailableSlot(rowIndex: number): number {
		const n = this.accounts.length;
		const start = rowIndex % n;

		for (let i = 0; i < n; i++) {
			const candidate = (start + i) % n;
			const acc = this.accounts[candidate];
			const sent = this.usage[acc.id] ?? 0;
			if (sent < acc.dailyLimit) return candidate;
		}

		const summary = this.accounts
			.map((a) => `${a.email} (${this.usage[a.id] ?? 0}/${a.dailyLimit})`)
			.join(", ");
		throw new Error(`Все SMTP аккаунты достигли дневного лимита — ${summary}`);
	}

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

	async send(payload: EmailPayload, rowIndex: number): Promise<void> {
		const slot = this.getAvailableSlot(rowIndex);
		const acc = this.accounts[slot];

		await this.transporters[slot].sendMail({
			from: payload.from,
			to: payload.to,
			subject: payload.subject,
			html: payload.html,
			text: payload.text,
		});

		recordSent(acc.id);
		this.usage[acc.id] = (this.usage[acc.id] ?? 0) + 1;

		const sent = this.usage[acc.id];
		const limit = acc.dailyLimit;
		if (sent === limit) {
			this.log({
				level: "warn",
				message: `SMTP #${slot + 1} (${acc.email}) достиг дневного лимита ${limit}`,
			});
		} else if (sent === Math.floor(limit * 0.9)) {
			this.log({
				level: "warn",
				message: `SMTP #${slot + 1} (${acc.email}) на 90% дневного лимита (${sent}/${limit})`,
			});
		}
	}

	closeAll(): void {
		this.transporters.forEach((t) => t.close());
	}
}

