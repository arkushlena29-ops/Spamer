import { readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const EXCEL_PATH = resolve(process.cwd(), "public", "emails.xlsx");
    const buffer = readFileSync(EXCEL_PATH);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

    if (rows.length === 0) {
      return Response.json({ error: "No rows found" }, { status: 404 });
    }

    const row = rows[0];
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      result[key] = value !== null && value !== undefined ? String(value) : "";
    }

    return Response.json({ row: result });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
