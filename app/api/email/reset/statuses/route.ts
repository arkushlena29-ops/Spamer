import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Define the path to the data file relative to the project root
const DATA_FILE = path.join(process.cwd(), "data", "row-statuses.json");

export async function DELETE(_request: Request) {
	try {
		// Physically delete row statuses JSON file (ignore if doesn't exist)
		await fs
			.access(DATA_FILE)
			.then(() => fs.unlink(DATA_FILE))
			.catch(() => {});

		return NextResponse.json(
			{ message: "Row statuses data deleted successfully" },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error deleting row statuses:", error);
		const err = error instanceof Error ? error : new Error(String(error));
		return NextResponse.json(
			{ message: "Failed to clear row statuses data", error: err.message },
			{ status: 500 },
		);
	}
}
