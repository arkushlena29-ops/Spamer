// ─────────────────────────────────────────────────────────────────────────────
// state.ts — Atomic read/write of progress.json and row statuses
//
// RESUMABILITY MECHANISM:
//   After every successful send, saveState() writes the current row index to
//   data/progress.json using an atomic rename:
//     1. Write new state → progress.json.tmp
//     2. fs.renameSync(tmp → progress.json)   ← atomic on Linux/macOS/Windows
//   If the process crashes between steps 1 and 2, the old progress.json is
//   still intact — zero data loss.  If it crashes after step 2, the index is
//   already advanced — no duplicate send.
//
// ROW STATUS TRACKING:
//   Individual row statuses (sent/failed) are persisted in data/row-statuses.json
//   to enable Excel row coloring based on email dispatch outcome.
// ─────────────────────────────────────────────────────────────────────────────

import {
	existsSync,
	readFileSync,
	writeFileSync,
	renameSync,
	mkdirSync,
} from "fs";
import { resolve } from "path";
import type { DispatchState } from "./types";

const DATA_DIR = resolve(process.cwd(), "data");
const STATE_FILE = resolve(DATA_DIR, "progress.json");
const STATE_FILE_TMP = resolve(DATA_DIR, "progress.json.tmp");
const ROW_STATUSES_FILE = resolve(DATA_DIR, "row-statuses.json");

/** Represents the status of an individual email row */
export type RowStatus = "pending" | "sent" | "failed";

/** Map of rowIndex -> status for tracking individual row outcomes */
interface RowStatuses {
	[rowIndex: number]: RowStatus;
}

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
				`totalSent=${state.totalSent}, totalFailed=${state.totalFailed}`,
		);
		return state;
	} catch {
		// Corrupted file — back it up and start over
		const backup = STATE_FILE.replace(".json", `_corrupt_${Date.now()}.json`);
		renameSync(STATE_FILE, backup);
		console.warn(
			`[State] progress.json was corrupt — backed up to ${backup}, starting fresh.`,
		);
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
	console.log(
		"[State] Initiating full state reset: deleting progress.json and row-statuses.json.",
	);
	clearProgressFile();
	clearRowStatuses(); // Clear the status file entirely
	if (existsSync(STATE_FILE)) {
		const backup = STATE_FILE.replace(".json", `_backup_${Date.now()}.json`);
		renameSync(STATE_FILE, backup);
		console.log(`[State] Reset requested. Old state backed up to ${backup}`);
	} else {
		console.log(
			"[State] Reset requested but no progress.json found — nothing to reset.",
		);
	}
}

/**
 * Load persisted row statuses from disk.
 * Returns an empty object when no file exists (first run).
 */
export function loadRowStatuses(): RowStatuses {
	if (!existsSync(ROW_STATUSES_FILE)) {
		console.log("[State] No row-statuses.json found — all rows pending.");
		return {};
	}

	try {
		const raw = readFileSync(ROW_STATUSES_FILE, "utf8");
		const statuses = JSON.parse(raw) as RowStatuses;
		return statuses;
	} catch {
		// Corrupted file — back it up and start over
		const backup = ROW_STATUSES_FILE.replace(
			".json",
			`_corrupt_${Date.now()}.json`,
		);
		renameSync(ROW_STATUSES_FILE, backup);
		console.warn(
			`[State] row-statuses.json was corrupt — backed up to ${backup}, starting fresh.`,
		);
		return {};
	}
}

/**
 * Atomically persist row statuses to disk.
 * Called after every send attempt (success or failure) so status is always up to date.
 */
export function saveRowStatuses(statuses: RowStatuses): void {
	ensureDataDir();
	writeFileSync(ROW_STATUSES_FILE, JSON.stringify(statuses, null, 2), "utf8");
}

/**
 * Update the status of a single row.
 * Called after each email send attempt (success or failure).
 */
export function updateRowStatus(rowIndex: number, status: RowStatus): void {
	const statuses = loadRowStatuses();
	statuses[rowIndex] = status;
	saveRowStatuses(statuses);
}

/**
 * Get the current status of a specific row.
 * Returns "pending" if no status is recorded for that row.
 */
export function getRowStatus(rowIndex: number): RowStatus {
	// This function is not directly related to the reset button logic, but we keep it for completeness.
	const statuses = loadRowStatuses();
	return statuses[rowIndex] ?? "pending";
}

/**
 * Reset all row statuses to pending.
 * Called when EMAIL_RESET=true is set.
 */
export function resetRowStatuses(): void {
	if (existsSync(ROW_STATUSES_FILE)) {
		const backup = ROW_STATUSES_FILE.replace(
			".json",
			`_backup_${Date.now()}.json`,
		);
		renameSync(ROW_STATUSES_FILE, backup);
		console.log(
			`[State] Row statuses reset. Old statuses backed up to ${backup}`,
		);
	} else {
		console.log(
			"[State] Reset requested but no row-statuses.json found — nothing to reset.",
		);
	}
}

/**
 * Reset all row colors in an Excel workbook to white.
 * Called when EMAIL_RESET=true is set.
 */
export function resetRowColors(wb: any): void {
	const sheetName = wb.SheetNames[0];
	if (!sheetName) return;

	// Get all rows in the sheet
	const ws = wb.Sheets[sheetName];
	const refRange = ws["!ref"];
	if (!refRange) return;

	const range = parseRange(refRange);

	for (let r = range.s.r + 2; r <= range.e.r; ++r) {
		const firstCell = `${String.fromCharCode(65 + range.s.c)}${r + 1}`;

		for (let c = range.s.c; c <= range.e.c; ++c) {
			const cellAddress = `${String.fromCharCode(65 + c)}${r + 1}`;
			ws[cellAddress] = ws[cellAddress] || { v: "" }; // Ensure cell exists
			ws[cellAddress].s = ws[cellAddress].s || {};
			// Set all cells to white background
			ws[cellAddress].s.fill = {
				patternType: "solid",
				fgColor: { rgb: "FFFFFF" },
			};
		}
	}

	// Rebuild the sheet to save changes
	wb.SheetNames[0] = sheetName;
}

/**
 * Clear all row statuses (delete the file).
 */
export function clearRowStatuses(): void {
	if (existsSync(ROW_STATUSES_FILE)) {
		renameSync(ROW_STATUSES_FILE, ROW_STATUSES_FILE + ".deleted");
		console.log("[State] Row statuses cleared.");
	}
}

/**
 * Mark a row as sent.
 */
export function markRowSent(rowIndex: number): void {
	updateRowStatus(rowIndex, "sent");
}

/**
 * Mark a row as failed.
 */
export function markRowFailed(rowIndex: number): void {
	updateRowStatus(rowIndex, "failed");
}

// ──────────────────────────────────────────────────────────────────────────────
// Excel Row Coloring Utilities (xlsx-js-style)
// Note: These functions use dynamic require to avoid TypeScript namespace issues
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Color a single row in an Excel workbook based on its status.
 * Uses xlsx-js-style API for styling cells with background colors.
 *
 * rowIndex is the 0-based index from the data array (same as used in runner.ts).
 * Excel rows: Row 0 = header, Row 1 = empty/skip, Row 2+ = data starting at index 0
 */
export function colorRow(wb: any, rowIndex: number, status: RowStatus): void {
	const sheetName = wb.SheetNames[0];
	const ws = wb.Sheets[sheetName];

	if (!ws) return;

	// Define background colors for each status with proper fill pattern
	const colorMap: Record<RowStatus, string> = {
		sent: "C6EFCE", // Light green
		failed: "FFC7CE", // Light red
		pending: "FFFFFF", // White (reset)
	};

	const fillColor = colorMap[status];

	// rowIndex 0 maps to Excel row 2 (header is row 0, empty row is row 1)
	const excelRow = rowIndex + 2;

	// Get the sheet reference range to know how many columns
	const refRange = ws["!ref"];
	if (!refRange) return;

	// Decode range manually since wb.utils may not be available
	const colStr = refRange.substring(0, 1); // e.g., "A"
	const rowNum = parseInt(refRange.substring(1), 10); // e.g., 1 for A1
	const startCol = colStr.charCodeAt(0) - 64; // A=1, B=2, etc.

	// Get end column from the range string (e.g., "A1:S4912" -> "S")
	const lastChar = refRange.split(":")[1]; // e.g., "4912" for A1:S4912
	const endColStr = refRange
		.substring(0, refRange.indexOf(":") + 1)
		.split(":")[0]; // e.g., "S"
	const endCol = endColStr.charCodeAt(0) - 64;

	// Fill ALL cells in the row with background color (including empty ones)
	for (let c = startCol; c <= endCol; ++c) {
		const cellAddress = `${String.fromCharCode(65 + c)}${excelRow}`;

		ws[cellAddress] = ws[cellAddress] || { v: "" }; // Ensure cell exists
		ws[cellAddress].s = ws[cellAddress].s || {};

		// Set fill with solid pattern and color (no # prefix, no alpha)
		ws[cellAddress].s.fill = {
			patternType: "solid",
			fgColor: { rgb: fillColor },
		};
	}

	// Rebuild the sheet to ensure styles are persisted in the output file
	wb.SheetNames[0] = sheetName;
}

/**
 * Color all rows in an Excel workbook based on their saved statuses.
 * Reads from data/row-statuses.json and applies appropriate colors.
 *
 * @param wb - The workbook to update with row colors (from dynamic require)
 */
export function colorAllRows(wb: any): void {
	const sheetName = wb.SheetNames[0];
	if (!sheetName) return;

	// Load saved row statuses
	const rowStatuses = loadRowStatuses();

	// Process each row that has a status recorded
	for (const [rowIndex, status] of Object.entries(rowStatuses)) {
		colorRow(wb, parseInt(rowIndex), status);
	}
}

/**
 * Helper function to decode Excel column letter to number (A=1, B=2, ..., Z=26, AA=27)
 */
function colToNum(col: string): number {
	let num = 0;
	for (const char of col.toUpperCase()) {
		num = num * 26 + (char.charCodeAt(0) - 64);
	}
	return num;
}

/**
 * Helper function to decode Excel range string (e.g., "A1:S4912") into start/end row/col
 */
function parseRange(range: string): {
	s: { r: number; c: number };
	e: { r: number; c: number };
} {
	const parts = range.split(":");
	const first = parts[0]; // e.g., "A1"
	const last = parts[parts.length - 1]; // e.g., "S4912"

	const startCol = colToNum(first.substring(0, 1));
	const endCol = colToNum(last.substring(0, 1));
	const startRow = parseInt(first.substring(1), 10);
	const endRow = parseInt(last.substring(1), 10);

	return {
		s: { r: startRow - 1, c: startCol },
		e: { r: endRow - 1, c: endCol },
	}; // 0-indexed
}

/**
 * Reset all row colors to white in an Excel workbook.
 *
 * @param wb - The workbook to reset (from dynamic require)
 */
export function resetAllRowColors(wb: any): void {
	const sheetName = wb.SheetNames[0];
	if (!sheetName) return;

	// Get all rows in the sheet
	const ws = wb.Sheets[sheetName];
	const refRange = ws["!ref"];
	if (!refRange) return;

	const range = parseRange(refRange);

	for (let r = range.s.r + 2; r <= range.e.r; ++r) {
		const firstCell = `${String.fromCharCode(65 + range.s.c)}${r + 1}`;

		for (let c = range.s.c; c <= range.e.c; ++c) {
			const cellAddress = `${String.fromCharCode(65 + c)}${r + 1}`;
			ws[cellAddress] = ws[cellAddress] || { v: "" }; // Ensure cell exists
			ws[cellAddress].s = ws[cellAddress].s || {};
			// Set all cells to white background
			ws[cellAddress].s.fill = {
				patternType: "solid",
				fgColor: { rgb: "FFFFFF" },
			};
		}
	}

	// Rebuild the sheet to save changes
	wb.SheetNames[0] = sheetName;
}
