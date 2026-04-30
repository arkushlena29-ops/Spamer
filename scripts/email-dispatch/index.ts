// ─────────────────────────────────────────────────────────────────────────────
// index.ts — CLI entry point.  Do NOT import this from the Next.js app.
//            (It calls dotenv/config as a side effect and owns process signals.)
//            Import runner.ts directly for programmatic use.
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config"; // must be first — not needed when running under Next.js

import XLSX from "xlsx-js-style";
import { runDispatch, DEFAULT_CONFIG } from "./runner";
import {
	colorAllRows,
	resetRowStatuses,
	clearRowStatuses,
	resetRowColors,
} from "./state";
import type { DispatchState } from "./types";

// Helper function to decode Excel range string (e.g., "A1:S4912") into start/end row/col
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

function colToNum(col: string): number {
	let num = 0;
	for (const char of col.toUpperCase()) {
		num = num * 26 + (char.charCodeAt(0) - 64);
	}
	return num;
}

const abortController = new AbortController();

/**
 * Auto-fit column widths based on cell content.
 */
function autoFitColumns(ws: any): void {
	const refRange = ws["!ref"];
	if (!refRange) return;

	const range = parseRange(refRange);

	for (let c = range.s.c; c <= range.e.c; ++c) {
		let maxWidth = 0;
		const colLetter = String.fromCharCode(65 + c);

		// Check all rows for this column
		for (let r = range.s.r; r <= range.e.r; ++r) {
			const cellAddress = `${colLetter}${r + 1}`;
			if (ws[cellAddress]) {
				const val = ws[cellAddress].v ?? "";
				const strVal = String(val);
				maxWidth = Math.max(maxWidth, strVal.length);
			}
		}

		// Set column width with some padding
		ws["!cols"] = ws["!cols"] || [];
		while (ws["!cols"].length < c) {
			ws["!cols"].push({ wch: 10 }); // default
		}
		ws["!cols"][c] = { wch: Math.max(maxWidth + 2, 15) };
	}
}

// Command-line option for manual coloring
if (process.argv.includes("--color") || process.argv.includes("-c")) {
	console.log("Manual color command detected — coloring Excel file...");
	try {
		const workbook = XLSX.readFile("public/emails.xlsx");

		if (workbook.SheetNames.length === 0) {
			console.log("[Color] No sheets found in emails.xlsx");
		} else {
			const sheetName = workbook.SheetNames[0];
			console.log(`[Color] Coloring rows in "${sheetName}"...`);
			colorAllRows(workbook);
			XLSX.writeFile(workbook, "public/emails.xlsx");
			console.log("[Color] Excel file colored successfully.");
		}
		process.exit(0);
	} catch (err) {
		console.error("[Color] Failed to color Excel file:", err);
		process.exit(1);
	}
}

// Command-line option for manual reset
if (process.argv.includes("--reset") || process.argv.includes("-r")) {
	console.log("Manual reset command detected — resetting colors...");
	try {
		const workbook = XLSX.readFile("public/emails.xlsx");

		if (workbook.SheetNames.length === 0) {
			console.log("[Reset] No sheets found in emails.xlsx");
		} else {
			resetRowStatuses();
			resetRowColors(workbook); // Reset Excel colors to white
			XLSX.writeFile(workbook, "public/emails.xlsx");
			console.log("[Reset] Colors reset to white.");
		}
		process.exit(0);
	} catch (err) {
		console.error("[Reset] Failed to reset colors:", err);
		process.exit(1);
	}
}

// Command-line option for manual clear
if (process.argv.includes("--clear") || process.argv.includes("-k")) {
	console.log("Manual clear command detected — clearing all colors...");
	try {
		const workbook = XLSX.readFile("public/emails.xlsx");

		if (workbook.SheetNames.length === 0) {
			console.log("[Clear] No sheets found in emails.xlsx");
		} else {
			clearRowStatuses();

			const ws = workbook.Sheets[workbook.SheetNames[0]];
			autoFitColumns(ws); // Auto-fit columns before writing
			XLSX.writeFile(workbook, "public/emails.xlsx");
			console.log("[Clear] All colors cleared.");
		}
		process.exit(0);
	} catch (err) {
		console.error("[Clear] Failed to clear colors:", err);
		process.exit(1);
	}
}

// Graceful shutdown — save state on CTRL+C / kill
process.on("SIGINT", () => {
	console.log("\n[CLI] Shutdown signal — stopping after current send…");
	abortController.abort();
});
process.on("SIGTERM", () => abortController.abort());

async function main() {
	console.log("╔══════════════════════════════════════╗");
	console.log("║      Email Dispatch Worker (CLI)     ║");
	console.log("╚══════════════════════════════════════╝\n");

	await runDispatch({
		config: DEFAULT_CONFIG,
		signal: abortController.signal,
		log: (entry) => {
			const icon =
				entry.level === "success"
					? "✓"
					: entry.level === "error"
						? "✗"
						: entry.level === "warn"
							? "⚠"
							: entry.level === "rate"
								? "⏸"
								: "›";
			const ts = new Date().toTimeString().slice(0, 8);
			console.log(`[${ts}] ${icon} ${entry.message}`);
		},
	});

	process.exit(0);
}

main().catch((err) => {
	console.error("[Fatal]", err);
	process.exit(1);
});

