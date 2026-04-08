"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredTemplate } from "@/scripts/email-dispatch/types";

// ─── Style tokens (same palette as EmailTab) ──────────────────────────────────

const surface  = "#0f172a";
const border   = "#1e293b";
const muted    = "#475569";
const dimText  = "#64748b";
const bodyText = "#e2e8f0";

const inputBase: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "13px",
  background: surface,
  border: `1px solid #334155`,
  borderRadius: "6px",
  color: bodyText,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle = (
  bg: string,
  fg: string,
  disabled = false
): React.CSSProperties => ({
  padding: "7px 16px",
  fontSize: "12px",
  fontWeight: 600,
  borderRadius: "6px",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled ? "#1e293b" : bg,
  color: disabled ? muted : fg,
  opacity: disabled ? 0.6 : 1,
  transition: "opacity 0.15s",
  whiteSpace: "nowrap" as const,
});

// ─── Placeholder definitions ──────────────────────────────────────────────────

const PLACEHOLDERS: { key: string; label: string; demo: string }[] = [
  { key: "name",      label: "{{name}}",      demo: "Іван Петренко" },
  { key: "firstName", label: "{{firstName}}", demo: "Іван"           },
  { key: "lastName",  label: "{{lastName}}",  demo: "Петренко"       },
  { key: "to",        label: "{{to}}",        demo: "ivan@gmail.com" },
  { key: "subject",   label: "{{subject}}",   demo: "(тема листа)"   },
];

// ─── Substitution helper (mirrors server-side logic) ─────────────────────────

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplatesTab
// ─────────────────────────────────────────────────────────────────────────────

type EditorTab = "html" | "text";

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [selected,  setSelected]  = useState<number>(0); // index into templates[]
  const [editorTab, setEditorTab] = useState<EditorTab>("html");
  const [saving,    setSaving]    = useState(false);
  const [savedId,   setSavedId]   = useState<number | null>(null);

  // Working copy of the selected template
  const [draft, setDraft] = useState<StoredTemplate | null>(null);

  // Preview sample data
  const [previewName,  setPreviewName]  = useState("Іван Петренко");
  const [previewEmail, setPreviewEmail] = useState("ivan@gmail.com");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    fetch("/api/email/templates")
      .then((r) => r.json())
      .then(({ templates: tpls }: { templates: StoredTemplate[] }) => {
        setTemplates(tpls);
        setDraft(tpls[selected] ? { ...tpls[selected] } : null);
      })
      .catch(() => {});
  }, [selected]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When selection changes, reset draft from templates[]
  useEffect(() => {
    if (templates[selected]) setDraft({ ...templates[selected] });
  }, [selected, templates]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/email/templates/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, subject: draft.subject, html: draft.html, text: draft.text }),
      });
      if (res.ok) {
        const updated = (await res.json()) as StoredTemplate;
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSavedId(draft.id);
        setTimeout(() => setSavedId(null), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Insert placeholder at cursor ────────────────────────────────────────────
  const insertPlaceholder = (placeholder: string) => {
    if (!draft || !textareaRef.current) return;
    const el    = textareaRef.current;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const field = editorTab === "html" ? "html" : "text";
    const current = draft[field];
    const updated = current.slice(0, start) + placeholder + current.slice(end);
    setDraft({ ...draft, [field]: updated });
    // Restore focus + caret after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  };

  // ── Preview rendering ────────────────────────────────────────────────────────
  const previewVars: Record<string, string> = {
    name:      previewName  || "Шановний клієнте",
    firstName: previewName.split(" ")[0] ?? "",
    lastName:  previewName.split(" ")[1] ?? "",
    to:        previewEmail || "recipient@email.com",
    subject:   draft ? substitute(draft.subject, {
      name:      previewName  || "Шановний клієнте",
      firstName: previewName.split(" ")[0] ?? "",
      lastName:  previewName.split(" ")[1] ?? "",
      to:        previewEmail || "recipient@email.com",
      subject:   draft.subject,
    }) : "",
  };

  const previewHtml = draft ? substitute(draft.html, previewVars) : "";
  const previewText = draft ? substitute(draft.text, previewVars) : "";

  const isDirty = draft && templates[selected]
    ? JSON.stringify(draft) !== JSON.stringify(templates[selected])
    : false;

  if (templates.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: muted, fontSize: "13px" }}>
        Загрузка шаблонов…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "20px", height: "100%", minHeight: 0 }}>

      {/* ── Left: template selector ─────────────────────────────────────────── */}
      <div style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
          Шаблоны
        </div>
        {templates.map((tpl, idx) => (
          <button
            key={tpl.id}
            onClick={() => setSelected(idx)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: "8px",
              border: `1px solid ${selected === idx ? "#3b82f6" : border}`,
              background: selected === idx ? "#0f2040" : surface,
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: selected === idx ? "#93c5fd" : dimText, marginBottom: "3px" }}>
              Шаблон {tpl.id}
            </div>
            <div style={{ fontSize: "12px", color: selected === idx ? bodyText : muted, lineHeight: 1.3 }}>
              {tpl.name}
            </div>
            <div style={{ marginTop: "5px", fontSize: "10px", color: "#334155" }}>
              строки: {tpl.id - 1}, {tpl.id - 1 + 3}, {tpl.id - 1 + 6}…
            </div>
          </button>
        ))}

        {/* Placeholder reference */}
        <div style={{ marginTop: "12px", padding: "12px", borderRadius: "8px", border: `1px solid ${border}`, background: "#060d1a" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Переменные
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {PLACEHOLDERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => insertPlaceholder(`{{${key}}}`)}
                title={`Вставить {{${key}}} в позицию курсора`}
                style={{
                  textAlign: "left",
                  background: "#0f172a",
                  border: `1px solid #1e293b`,
                  borderRadius: "4px",
                  padding: "3px 7px",
                  fontSize: "11px",
                  color: "#7dd3fc",
                  cursor: "pointer",
                  fontFamily: '"Geist Mono", Consolas, monospace',
                }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "#334155" }}>
            Нажмите для вставки в курсор
          </div>
        </div>
      </div>

      {/* ── Right: editor + preview ───────────────────────────────────────── */}
      {draft && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>

          {/* Header row: name + subject + save */}
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ width: "180px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Название</div>
              <input
                style={inputBase}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Название шаблона"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Тема письма</div>
              <input
                style={inputBase}
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Тема письма"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              style={btnStyle("#2563eb", "#fff", saving || !isDirty)}>
              {saving ? "Сохранение…" : savedId === draft.id ? "✓ Сохранено" : "Сохранить"}
            </button>
            {isDirty && (
              <button
                onClick={() => setDraft({ ...templates[selected] })}
                style={btnStyle("#1e293b", "#94a3b8")}>
                Отменить
              </button>
            )}
          </div>

          {/* Body — split: editor left, preview right */}
          <div style={{ flex: 1, display: "flex", gap: "14px", minHeight: 0 }}>

            {/* Editor panel */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Editor sub-tabs */}
              <div style={{ display: "flex", gap: "2px", marginBottom: "8px" }}>
                {(["html", "text"] as EditorTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditorTab(t)}
                    style={{
                      padding: "5px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: "none",
                      borderBottom: editorTab === t ? "2px solid #3b82f6" : "2px solid transparent",
                      borderRadius: "4px 4px 0 0",
                      background: editorTab === t ? "#0f172a" : "transparent",
                      color: editorTab === t ? bodyText : muted,
                      cursor: "pointer",
                    }}>
                    {t === "html" ? "HTML" : "Обычный текст"}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={editorTab === "html" ? draft.html : draft.text}
                onChange={(e) =>
                  setDraft(editorTab === "html"
                    ? { ...draft, html: e.target.value }
                    : { ...draft, text: e.target.value })
                }
                spellCheck={false}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "#060d1a",
                  border: `1px solid #1e293b`,
                  borderRadius: "0 6px 6px 6px",
                  color: "#c4b5fd",
                  fontFamily: '"Geist Mono", Consolas, monospace',
                  fontSize: "12px",
                  lineHeight: 1.6,
                  padding: "12px",
                  outline: "none",
                  minHeight: "300px",
                  boxSizing: "border-box",
                  width: "100%",
                }}
              />
            </div>

            {/* Preview panel */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Предпросмотр
                </span>
                <input
                  style={{ ...inputBase, width: "150px", fontSize: "12px", padding: "5px 8px" }}
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="Имя"
                />
                <input
                  style={{ ...inputBase, width: "170px", fontSize: "12px", padding: "5px 8px" }}
                  value={previewEmail}
                  onChange={(e) => setPreviewEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>

              {editorTab === "html" ? (
                <iframe
                  key={previewHtml}
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  style={{
                    flex: 1,
                    border: `1px solid ${border}`,
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    minHeight: "300px",
                    width: "100%",
                  }}
                  title="Предпросмотр HTML письма"
                />
              ) : (
                <pre
                  style={{
                    flex: 1,
                    margin: 0,
                    padding: "14px",
                    background: "#060d1a",
                    border: `1px solid ${border}`,
                    borderRadius: "8px",
                    color: "#cbd5e1",
                    fontFamily: '"Geist Mono", Consolas, monospace',
                    fontSize: "12px",
                    lineHeight: 1.7,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    minHeight: "300px",
                  }}>
                  {previewText}
                </pre>
              )}

              {/* Rendered subject preview */}
              <div style={{ marginTop: "8px", padding: "7px 10px", background: surface, border: `1px solid ${border}`, borderRadius: "6px" }}>
                <span style={{ fontSize: "10px", color: dimText, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Тема: </span>
                <span style={{ fontSize: "13px", color: bodyText }}>{previewVars.subject}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
