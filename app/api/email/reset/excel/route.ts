export const runtime = "nodejs";

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import * as xlsx from "xlsx";

export async function POST(_request: Request) {
	try {
		// Read emails.xlsx (keep existing data and structure)
		const inputPath = join(process.cwd(), "public", "emails.xlsx");
		if (!existsSync(inputPath)) {
			console.error("emails.xlsx not found at:", inputPath);
			return Response.json(
				{ error: "Emails Excel file not found" },
				{ status: 404 },
			);
		}

		const data = readFileSync(inputPath, { encoding: "binary" });
		const workbook = xlsx.read(data, { type: "binary", cellStyles: true });

		// Get sheet and convert to JSON with styles preserved for structure
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];

		// Convert to array of arrays preserving data
		const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

		if (rawData.length === 0) {
			return Response.json(
				{ error: "No data found in emails.xlsx" },
				{ status: 400 },
			);
		}

		const headers = rawData[0] as string[];
		const rows = rawData.slice(1) as string[][];

		// Create new workbook with same data but without conditional formatting
		const newWorkbook = xlsx.utils.book_new();

		// Build rows as plain arrays (no styles applied)
		const cleanRows: string[][] = [];
		for (let i = 0; i < rows.length; i++) {
			cleanRows.push([...rows[i]]);
		}

		const cleanSheet = xlsx.utils.aoa_to_sheet([headers, ...cleanRows]);

		// Preserve column widths from original sheet
		if (sheet["!cols"]) {
			cleanSheet["!cols"] = sheet["!cols"];
		}

		xlsx.utils.book_append_sheet(newWorkbook, cleanSheet, sheetName);

		// Write to emails.xlsx with white backgrounds (no colors)
		const outputPath = join(process.cwd(), "public", "emails.xlsx");
		writeFileSync(outputPath, xlsx.write(newWorkbook, { type: "buffer" }));

		console.log(
			"Excel file reset - all cell colors cleared while preserving data.",
		);

		return Response.json({
			success: true,
			message: "Emails Excel file reset successfully",
		});
	} catch (err) {
		console.error("Error resetting Excel:", err);
		return Response.json({ error: (err as Error).message }, { status: 500 });
	}
}
