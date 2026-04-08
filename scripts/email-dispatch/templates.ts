// ─────────────────────────────────────────────────────────────────────────────
// templates.ts — Loads stored templates and renders them for a given row.
//
// Templates are stored in data/email-templates.json with {{placeholder}} syntax.
// Available placeholders: {{name}}, {{firstName}}, {{lastName}}, {{to}}, {{subject}}
//
// Template selection is deterministic and round-robin:
//   rowIndex % 3 → template 1 / 2 / 3
// ─────────────────────────────────────────────────────────────────────────────

import { getTemplates } from "../../lib/email-worker/templates-store";
import type { EmailRow, EmailPayload, TemplateId } from "./types";

/** Returns a human-readable salutation from whatever name fields are populated. */
function salutation(row: EmailRow): string {
  const parts = [row.firstName, row.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Уважаемый клиент";
}

/** Replace all {{key}} placeholders with actual values. */
function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * Pick a template based on the row's position in the sheet and render it.
 * rowIndex 0 → template 1, 1 → template 2, 2 → template 3, 3 → template 1, …
 */
export function selectTemplate(row: EmailRow, from: string): EmailPayload {
  const templates = getTemplates();
  const id        = ((row.rowIndex % 3) + 1) as TemplateId;
  const tpl       = templates.find((t) => t.id === id);

  if (!tpl) {
    throw new Error(
      `Шаблон #${id} не найден — убедитесь что data/email-templates.json существует и содержит 3 записи`
    );
  }

  const vars: Record<string, string> = {
    name:      salutation(row),
    firstName: row.firstName ?? "",
    lastName:  row.lastName  ?? "",
    to:        row.email,
    subject:   tpl.subject,
  };

  return {
    from,
    to:      row.email,
    subject: substitute(tpl.subject, vars),
    html:    substitute(tpl.html,    vars),
    text:    substitute(tpl.text,    vars),
  };
}
