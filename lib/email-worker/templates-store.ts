// ─────────────────────────────────────────────────────────────────────────────
// templates-store.ts — Read / write email templates from data/email-templates.json
//
// The file is committed to git so templates survive fresh clones.
// Writes use write-to-tmp + rename for atomicity.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import type { StoredTemplate, TemplateId } from "@/scripts/email-dispatch/types";

const DATA_FILE = path.join(process.cwd(), "data", "email-templates.json");
const TMP_FILE  = DATA_FILE + ".tmp";

interface TemplatesFile {
  templates: StoredTemplate[];
}

function readFile(): TemplatesFile {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as TemplatesFile;
  } catch {
    return { templates: [] };
  }
}

function writeFile(data: TemplatesFile): void {
  fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(TMP_FILE, DATA_FILE);
}

export function getTemplates(): StoredTemplate[] {
  return readFile().templates;
}

export function getTemplate(id: TemplateId): StoredTemplate | undefined {
  return readFile().templates.find((t) => t.id === id);
}

export function updateTemplate(
  id: TemplateId,
  data: Partial<Omit<StoredTemplate, "id">>
): StoredTemplate {
  const file = readFile();
  const idx  = file.templates.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Template #${id} not found`);
  const updated = { ...file.templates[idx], ...data, id } as StoredTemplate;
  file.templates[idx] = updated;
  writeFile(file);
  return updated;
}
