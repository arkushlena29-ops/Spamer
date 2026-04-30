import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Define the path to the data file relative to the project root
const DATA_FILE = path.join(process.cwd(), "data", "progress.json");

export async function POST(_request: Request) {
	try {
		// Physically delete progress JSON file (ignore if doesn't exist)
		await fs
			.access(DATA_FILE)
			.then(() => fs.unlink(DATA_FILE))
			.catch(() => {});

		// In a real application, usage stats would also be cleared here or in a separate call
		return NextResponse.json(
			{ message: "Progress and usage stats cleared successfully" },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error clearing progress:", error);
		// In Next.js API routes, errors should be handled gracefully for the client
		return NextResponse.json(
			{
				message: "Failed to clear progress data",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
