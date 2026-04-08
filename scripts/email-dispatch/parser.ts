// ─────────────────────────────────────────────────────────────────────────────
// parser.ts — Reads public/emails.xls and returns a typed EmailRow array
//
// MEMORY STRATEGY:
//   SheetJS (xlsx) is the only battle-tested library that handles the legacy
//   .xls binary format.  It loads the file into memory, but for 40 k rows
//   the heap usage is typically 50–120 MB — well within Node's 1.5 GB default.
//
//   Key options that minimise memory:
//     • read() from a Buffer (avoids a second copy vs. readFile path)
//     • raw: false   — all cells are strings; no extra type wrappers
//     • defval: ''   — no undefined values (smaller hidden class count)
//
//   After sheet_to_json() the raw workbook is released for GC.
//   We then filter invalid rows in a single pass so the final array only
//   holds rows we will actually send.
//
//   If you ever hit OOM on a truly enormous file, set the Node flag:
//     node --max-old-space-size=4096 ...
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";
import type { EmailRow, Logger } from "./types";

const EXCEL_PATH = resolve(process.cwd(), "public", "emails.xlsx");

/**
 * Raw shape coming out of sheet_to_json.
 * Keys match whatever your Excel column headers are.
 * Edit the aliases inside normalizeRow() to fit your actual file.
 */
interface RawRow {
	[key: string]: unknown;
}

/** Try several common header spellings and return the first truthy value. */
function pick(row: RawRow, ...keys: string[]): string {
	for (const k of keys) {
		const v = row[k];
		if (v !== undefined && v !== null && String(v).trim() !== "") {
			return String(v).trim();
		}
	}
	return "";
}

/** Returns a normalised EmailRow or null if the row should be skipped. */
function normalizeRow(raw: RawRow, rowIndex: number): EmailRow | null {
	// ── Resolve email ─────────────────────────────────────────────────────────
	// Add more alias keys if your column header differs
	const email = pick(raw, "Email", "email", "E-mail", "EMAIL", "Почта", "Емейл")
		.toLowerCase()
		.replace(/\s/g, "");

	// Hard filter: skip rows without a valid-looking email address
	if (!email || !email.includes("@") || !email.includes(".")) {
		return null;
	}

	return {
		rowIndex,
		email,
		firstName: pick(
			raw,
			"First Name",
			"FirstName",
			"first_name",
			"Имя",
			"Ім'я",
			"Name",
		),
		lastName: pick(
			raw,
			"Last Name",
			"LastName",
			"last_name",
			"Фамилия",
			"Прізвище",
		),
		// Spread all original columns so templates can access custom fields
		...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? ""])),
	};
}

/**
 * Parse public/xls and return a deduplicated, validated array of rows.
 * Called once at startup — subsequent access is from the in-memory array.
 */
export function parseEmailsFile(
	log: Logger = (e) => console.log(`[Parser] ${e.message}`),
): EmailRow[] {
	log({ level: "system", message: `Чтение ${EXCEL_PATH} …` });

	// Read into a Buffer so XLSX doesn't open a second file handle
	const buffer = readFileSync(EXCEL_PATH);

	const workbook = XLSX.read(buffer, {
		type: "buffer",
		cellDates: true, // parse date cells as JS Date (avoids serial-number strings)
		dense: false, // sparse cell addressing — less memory for wide sheets
	});

	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error("[Парсер] Excel файл не содержит листов.");

	const sheet = workbook.Sheets[sheetName];

	// sheet_to_json with raw:false gives us formatted string values for every cell,
	// which is safe and avoids numeric/date type surprises.
	const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
		defval: "",
		raw: false,
	});

	log({
		level: "system",
		message: `Лист "${sheetName}" — ${rawRows.length} строк`,
	});

	// Single-pass normalise + filter
	const rows: EmailRow[] = [];
	const seenEmails = new Set<string>(); // deduplicate by email address

	for (let i = 0; i < rawRows.length; i++) {
		const row = normalizeRow(rawRows[i], i);
		if (!row) continue;
		if (seenEmails.has(row.email)) continue; // skip duplicates
		seenEmails.add(row.email);
		rows.push(row);
	}

	// Explicitly clear the raw array so GC can reclaim its memory
	rawRows.length = 0;

	log({
		level: "system",
		message: `${rows.length} валидных уникальных строк после фильтрации`,
	});

	return rows;
}

