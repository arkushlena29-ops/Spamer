export const runtime = "nodejs";

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import * as xlsx from "xlsx";
import { Buffer } from "buffer";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as {
			poolNameFilter?: string;
			creditorFilter?: string;
			statusFilters?: string[];
		};

		// Validate filters
		if (!body.poolNameFilter && !body.creditorFilter && !body.statusFilters) {
			return Response.json(
				{ error: "At least one filter must be provided" },
				{ status: 400 },
			);
		}

		// Read source.xlsx
		const sourcePath = join(process.cwd(), "public", "source.xlsx");
		const sourceData = readFileSync(sourcePath, { encoding: "binary" });
		const sourceWorkbook = xlsx.read(sourceData, { type: "binary" });

		// Get all rows as array of arrays
		const sourceSheetName = sourceWorkbook.SheetNames[0];
		const sourceSheet = sourceWorkbook.Sheets[sourceSheetName];
		const sourceDataArray = xlsx.utils.sheet_to_json(sourceSheet, {
			header: 1,
			defval: "",
		});
		const headers = sourceDataArray[0] as string[];
		const rows = sourceDataArray.slice(1) as string[][];

		// Apply filters
		const filteredRows = rows.filter((row) => {
			// Filter by pool name
			if (
				body.poolNameFilter &&
				!row[headers.indexOf("Назва пула") ?? -1]
					?.toString()
					.includes(body.poolNameFilter)
			) {
				return false;
			}

			// Filter by creditor
			if (
				body.creditorFilter &&
				!row[headers.indexOf("Первинний кредитор") ?? -1]
					?.toString()
					.includes(body.creditorFilter)
			) {
				return false;
			}

			// Filter by status
			if (body.statusFilters && body.statusFilters.length > 0) {
				const statusColIdx = headers.indexOf("Статус");
				if (statusColIdx !== -1) {
					const status = row[statusColIdx]?.toString();
					if (status && !body.statusFilters.includes(status)) {
						return false;
					}
				}
			}

			return true;
		});

		// Load sent/failed state from progress.json if exists
		let sentIndices: Set<number> | undefined;
		let failedIndices: Set<number> | undefined;

		const progressPath = join(process.cwd(), "data", "progress.json");
		if (existsSync(progressPath)) {
			try {
				const progressData = JSON.parse(readFileSync(progressPath, "utf8"));
				sentIndices = new Set(
					Array.from(
						{ length: progressData.lastProcessedIndex + 1 },
						(_, i) => i,
					),
				);
				failedIndices = new Set(); // TODO: track failed indices separately if needed
			} catch {
				// Invalid state file, ignore
			}
		}

		// Create new workbook with filtered data and conditional formatting
		const newWorkbook = xlsx.utils.book_new();

		// Build rows as plain arrays (xlsx will handle styling separately)
		const styledRows: string[][] = [];
		for (let i = 0; i < filteredRows.length; i++) {
			styledRows.push([...filteredRows[i]]);
		}

		const filteredSheet = xlsx.utils.aoa_to_sheet([headers, ...styledRows]);

		// Apply conditional formatting based on row index
		if (sentIndices) {
			// Convert column letters to index (A=0, B=1, etc.)
			const colIndex = (str: string): number =>
				str
					.split("")
					.reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;

			// Get sheet reference range
			const ref = filteredSheet["!ref"];
			if (!ref) return;

			// Parse Excel range (e.g., "A1:Z57148")
			const match = ref.match(/([A-Z]+)(\d+)-?([A-Z]*)(\d*)/);
			if (!match) return;

			const startCol = match[1];
			const endCol = match[3] || startCol;
			const startRow = parseInt(match[2]);
			const endRow = parseInt(match[4]) || startRow;

			// Apply green background to sent rows
			for (let c = colIndex(startCol); c <= colIndex(endCol); c++) {
				for (let r = startRow - 1; r < endRow && r < filteredRows.length; r++) {
					if (sentIndices.has(r)) {
						const cellAddr = String.fromCharCode(65 + c) + (r + 1);
						filteredSheet[`!styles`] = filteredSheet[`!styles`] || {};
						filteredSheet[`!styles`][cellAddr] = {
							fill: { fgColor: { rgb: "C6EFCE" } }, // Light green
							font: { color: { rgb: "000000" } },
						};
					}
				}
			}
		}

		// Auto-fit column widths based on content
		const colWidths: number[] = [];
		for (let i = 0; i < headers.length; i++) {
			let maxWidth = 10; // minimum width
			const headerStr = String(headers[i]);
			maxWidth = Math.max(maxWidth, headerStr.length);

			for (const row of filteredRows) {
				if (i < row.length) {
					const cellValue = String(row[i]);
					maxWidth = Math.max(maxWidth, cellValue.length);
				}
			}

			colWidths.push(Math.min(maxWidth, 50)); // cap at 50 chars
		}

		filteredSheet["!cols"] = colWidths.map((w) => ({ wch: w }));

		xlsx.utils.book_append_sheet(newWorkbook, filteredSheet, sourceSheetName);

		// Write to emails.xlsx
		const outputPath = join(process.cwd(), "public", "emails.xlsx");
		// Use buffer type for proper binary handling and prevent corruption
		writeFileSync(outputPath, xlsx.write(newWorkbook, { type: "buffer" }));

		return Response.json({
			success: true,
			message: "Emails generated successfully",
		});
	} catch (err) {
		console.log(err);
		return Response.json({ error: (err as Error).message }, { status: 500 });
	}
}
