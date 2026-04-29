// ─────────────────────────────────────────────────────────────────────────────
// runner.ts — Programmatic dispatch loop (used by both the CLI and the web UI)
//
// The CLI (index.ts) calls runDispatch() directly.
// The web UI (lib/email-worker/worker-manager.ts) also calls runDispatch()
// with an AbortSignal and a structured logger so it can stream logs over SSE.
// ─────────────────────────────────────────────────────────────────────────────

import { parseEmailsFile } from "./parser";
import { loadState, saveState, resetState } from "./state";
import { MailDispatcher } from "./mailer";
import { selectTemplate } from "./templates";
import {
	getAccounts,
	getAccountPassword,
} from "../../lib/email-worker/accounts-store";
import type { DispatchState, Logger, WorkerStatus } from "./types";

const STATUS_OPTIONS = [
	{ id: "Борг менше 100", label: "Борг менше 100" },
	{ id: "Борг мешне 1000", label: "Борг мешне 1000" },
	{ id: "Відкрито ВП за ВЛ", label: "Відкрито ВП за ВЛ" },
	{ id: "Закритий кредит", label: "Закритий кредит" },
	{ id: "Не знає боржника", label: "Не знає боржника" },
	{ id: "Не опрацьована угода", label: "Не опрацьована угода" },
	{ id: "Не співпрацює", label: "Не співпрацює" },
	{ id: "Немає домовленості", label: "Немає домовленості" },
	{ id: "Опрацьована угода", label: "Опрацьована угода" },
	{ id: "Платить за ВЛ", label: "Платить за ВЛ" },
	{ id: "Платить за ВНН", label: "Платить за ВНН" },
	{ id: "Помер", label: "Помер" },
	{ id: "Пообіцяв закрити", label: "Пообіцяв закрити" },
	{ id: "Реструктуризація діюча", label: "Реструктуризація діюча" },
	{ id: "Реструктуризація нова", label: "Реструктуризація нова" },
	{ id: "Співпрацює", label: "Співпрацює" },
	{ id: "Телефони відсутні", label: "Телефони відсутні" },
	{ id: "Банкрутство", label: "Банкрутство" },
	{ id: "Виконав рішення суду", label: "Виконав рішення суду" },
	{ id: "Вилучено КЛТ", label: "Вилучено КЛТ" },
	{ id: "Військовий", label: "Військовий" },
	{
		id: "Закрив попередньому кредитору",
		label: "Закрив попередньому кредитору",
	},
	{ id: "Окуповані території з 2014", label: "Окуповані території з 2014" },
	{ id: "Перенос", label: "Перенос" },
	{ id: "Стягнення неможливе", label: "Стягнення неможливе" },
];

export interface RunConfig {
	delayBetweenEmailsMs: number;
	batchSize: number;
	batchPauseMs: number;
	dryRun: boolean;
	reset: boolean;
	statusFilters?: string[];
	poolName?: string;
	creditor?: string;
}

export const DEFAULT_CONFIG: RunConfig = {
	delayBetweenEmailsMs: parseInt(process.env.EMAIL_DELAY_MS ?? "60000", 10),
	batchSize: parseInt(process.env.EMAIL_BATCH_SIZE ?? "50", 10),
	batchPauseMs: parseInt(process.env.EMAIL_BATCH_PAUSE_MS ?? "5000", 10),
	dryRun: process.env.EMAIL_DRY_RUN === "true",
	reset: false,
};

export interface RunOptions {
	config?: Partial<RunConfig>;
	signal: AbortSignal;
	log: Logger;
	/** Called every time progress advances so the manager can update its status snapshot */
	onProgress?: (status: Partial<WorkerStatus>) => void;
}

// ─── Abort-aware sleep ────────────────────────────────────────────────────────
// Resolves after `ms` OR immediately when the signal fires — whichever comes first.
// This means "Stop" takes effect within one send cycle, not one batch cycle.
function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runDispatch(options: RunOptions): Promise<void> {
	const { signal, log, onProgress } = options;
	const cfg: RunConfig = { ...DEFAULT_CONFIG, ...options.config };

	// ── Step 1: Optional reset ─────────────────────────────────────────────────
	if (cfg.reset) {
		resetState();
		log({
			level: "system",
			message: "Состояние сброшено — начинаем с строки 0",
		});
	}

	// ── Step 2: Load persisted state ───────────────────────────────────────────
	// THIS IS THE RESUMABILITY ENTRY POINT.
	// lastProcessedIndex tells us exactly where to continue from.
	const persistedState = loadState();
	const startIndex = persistedState.lastProcessedIndex + 1;

	log({
		level: "system",
		message:
			startIndex > 0
				? `Продолжаем с строки ${startIndex} (${persistedState.totalSent} уже отправлено)`
				: "Начинаем с строки 0",
	});

	// ── Step 3: Parse Excel ────────────────────────────────────────────────────
	if (signal.aborted) return;

	const allRows = parseEmailsFile(log);

	if (allRows.length === 0) {
		log({
			level: "error",
			message: "В Excel файле не найдено валидных строк.",
		});
		return;
	}

	// Apply filters (all rows processed without filtering)
	const rows = allRows;
	const filters: string[] = [];

	if (filters.length > 0) {
		log({
			level: "system",
			message: `Отфильтровано: ${rows.length} из ${allRows.length} строк (применены: ${filters.join(", ")})`,
		});
	}

	// Check if filters changed - if so, reset state to start from beginning
	const currentFilterHash = JSON.stringify({
		statusFilters: cfg.statusFilters?.sort() || [],
		poolName: cfg.poolName || "",
		creditor: cfg.creditor || "",
	});
	const savedFilterHash = persistedState.filterHash || "";

	if (
		currentFilterHash !== savedFilterHash &&
		persistedState.lastProcessedIndex > 0
	) {
		log({
			level: "warn",
			message: "Фильтры изменились — сбрасываем прогресс и начинаем заново",
		});
		persistedState.lastProcessedIndex = -1;
		persistedState.totalSent = 0;
		persistedState.totalFailed = 0;
	}

	// Save new filter hash (now empty since no filters are applied)
	(persistedState as any).filterHash = currentFilterHash;

	onProgress?.({
		totalRows: rows.length,
		lastProcessedIndex: persistedState.lastProcessedIndex,
	});

	if (startIndex >= rows.length) {
		log({
			level: "system",
			message: `Все ${rows.length} строк уже отправлены. Нечего делать.`,
		});
		return;
	}

	const remaining = rows.length - startIndex;
	log({
		level: "system",
		message: `${remaining} строк осталось (${startIndex} уже отправлено, ${rows.length} всего)`,
	});

	// ── Step 4: Initialise mailer ──────────────────────────────────────────────
	if (signal.aborted) return;

	const accounts = getAccounts();

	if (accounts.length === 0) {
		log({
			level: "error",
			message: "SMTP аккаунты не настроены — добавьте их на вкладке Аккаунты.",
		});
		return;
	}

	const passwords: Record<string, string> = {};
	const missingPassword: string[] = [];
	for (const acc of accounts) {
		const pass = getAccountPassword(acc.id);
		if (pass) {
			passwords[acc.id] = pass;
		} else {
			missingPassword.push(acc.email);
		}
	}

	if (missingPassword.length > 0) {
		log({
			level: "error",
			message: `Пароли не установлены для: ${missingPassword.join(", ")}`,
		});
		return;
	}

	const dispatcher = new MailDispatcher(accounts, passwords, log);

	if (!cfg.dryRun) {
		log({ level: "system", message: "Проверка SMTP подключений…" });
		await dispatcher.verifyAll();
	} else {
		log({
			level: "warn",
			message: "ТЕСТОВЫЙ РЕЖИМ — письма отправляться не будут",
		});
	}

	// ── Step 5: Dispatch loop ──────────────────────────────────────────────────
	let currentState: DispatchState = { ...persistedState };
	let batchCounter = 0;

	for (let i = startIndex; i < rows.length; i++) {
		// Check abort signal on every iteration (set by worker-manager.stop())
		if (signal.aborted) {
			log({ level: "warn", message: `Рассылка остановлена на строке ${i}` });
			saveState(currentState);
			break;
		}

		const row = rows[i];
		const from = dispatcher.getFrom(i);
		const payload = selectTemplate(row, from);
		const smtpNum = dispatcher.getSmtpNumber(i);
		const smtpHost = dispatcher.getSmtpHost(i);

		try {
			if (cfg.dryRun) {
				log({
					level: "info",
					message: `[ТЕСТ] Отправить ${row.email} через SMTP #${smtpNum}`,
					email: row.email,
					smtpNum,
					smtpHost,
				});
			} else {
				await dispatcher.send(payload, i);
				log({
					level: "success",
					message: `Отправлено → ${row.email} через SMTP #${smtpNum} (${smtpHost})`,
					email: row.email,
					smtpNum,
					smtpHost,
				});
			}

			// ── CRITICAL: advance the index ONLY after a confirmed send ───────────
			// Crash between send() and saveState() → one possible retry on restart.
			// Crash after saveState() → no duplicate.  This is the safest trade-off.
			currentState = {
				...currentState,
				lastProcessedIndex: i,
				totalSent: currentState.totalSent + 1,
			};
			saveState(currentState);
			onProgress?.({
				lastProcessedIndex: i,
				totalSent: currentState.totalSent,
				totalFailed: currentState.totalFailed,
			});
		} catch (err) {
			log({
				level: "error",
				message: `Ошибка → ${row.email}: ${(err as Error).message}`,
				email: row.email,
				smtpNum,
				smtpHost,
			});
			currentState = {
				...currentState,
				totalFailed: currentState.totalFailed + 1,
			};
			saveState(currentState);
			onProgress?.({ totalFailed: currentState.totalFailed });
		}

		// ── Rate limiting ────────────────────────────────────────────────────────
		batchCounter++;
		const isLastRow = i === rows.length - 1;

		if (!isLastRow) {
			if (batchCounter % cfg.batchSize === 0) {
				log({
					level: "rate",
					message: `Пачка из ${cfg.batchSize} отправлена — пауза ${cfg.batchPauseMs}мс`,
				});
				await abortableSleep(cfg.batchPauseMs, signal);
			} else {
				await abortableSleep(cfg.delayBetweenEmailsMs, signal);
			}
		}
	}

	dispatcher.closeAll();

	if (!signal.aborted) {
		log({
			level: "system",
			message: `Готово — отправлено: ${currentState.totalSent}, ошибок: ${currentState.totalFailed}`,
		});
	}
}

