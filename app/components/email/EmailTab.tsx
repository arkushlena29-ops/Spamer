"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TemplatesTab from "./TemplatesTab";
import type { LogEntry, SmtpAccount, WorkerStatus } from "@/scripts/email-dispatch/types";

// ─── Types ────────────────────────────────────────────────────────────────────
// (SmtpAccount imported from types has no password field — it's in .env.local)

// ─── Shared style tokens ──────────────────────────────────────────────────────

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

const btn = (
  bg: string,
  fg: string,
  disabled = false
): React.CSSProperties => ({
  padding: "8px 18px",
  fontSize: "13px",
  fontWeight: 600,
  borderRadius: "7px",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled ? "#1e293b" : bg,
  color: disabled ? muted : fg,
  transition: "opacity 0.15s",
  opacity: disabled ? 0.6 : 1,
  whiteSpace: "nowrap" as const,
});

const label = (text: string) => (
  <div style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
    {text}
  </div>
);

// ─── Log colours ─────────────────────────────────────────────────────────────

const logColor: Record<LogEntry["level"], string> = {
  success: "#86efac", error: "#fca5a5", warn: "#fcd34d",
  rate: "#c4b5fd",    info: "#93c5fd",  system: "#94a3b8",
};
const logIcon: Record<LogEntry["level"], string> = {
  success: "✓", error: "✗", warn: "⚠", rate: "⏸", info: "›", system: "·",
};

// ─────────────────────────────────────────────────────────────────────────────
// AccountsTab
// ─────────────────────────────────────────────────────────────────────────────

type FormData = Omit<SmtpAccount, "id">;
const BLANK_FORM: FormData = { email: "", fromName: "", host: "", port: 587, secure: false, dailyLimit: 500 };

function AccountsTab() {
  const [accounts, setAccounts]       = useState<SmtpAccount[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword]       = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [editing, setEditing]         = useState<SmtpAccount | null>(null);
  const [form, setForm]               = useState<FormData>(BLANK_FORM);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [usage, setUsage]             = useState<Record<string, number>>({});

  const load = useCallback(() => {
    fetch("/api/email/accounts")
      .then((r) => r.json())
      .then(({ accounts: a, hasPassword: hp, usage: u }: { accounts: SmtpAccount[]; hasPassword: boolean; usage: Record<string, number> }) => {
        setAccounts(a);
        setHasPassword(hp);
        setUsage(u ?? {});
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(BLANK_FORM); setShowForm(true); };
  const openEdit = (acc: SmtpAccount) => {
    setEditing(acc);
    setForm({ email: acc.email, fromName: acc.fromName, host: acc.host, port: acc.port, secure: acc.secure, dailyLimit: acc.dailyLimit ?? 500 });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url    = editing ? `/api/email/accounts/${editing.id}` : "/api/email/accounts";
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
    load();
  };

  const handleSavePassword = async () => {
    setPwSaving(true);
    await fetch("/api/email/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setHasPassword(password.length > 0);
    setPassword("");
    setPwSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Shared password */}
      <section style={{ background: surface, border: `1px solid ${border}`, borderRadius: "10px", padding: "18px 20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: bodyText, marginBottom: "4px" }}>
          Общий пароль
          {hasPassword && <span style={{ marginLeft: "10px", fontSize: "11px", color: "#6ee7b7", background: "#022c22", padding: "2px 8px", borderRadius: "99px" }}>установлен</span>}
        </div>
        <div style={{ fontSize: "12px", color: dimText, marginBottom: "12px" }}>
          Один пароль для всех аккаунтов. Сохраняется в <code style={{ color: "#94a3b8" }}>.env.local</code> — не попадает в git.
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? "••••••••  (оставьте пустым, чтобы сохранить текущий)" : "Введите общий App Password"}
            style={{ ...inputBase, flex: 1 }} />
          <button onClick={handleSavePassword} disabled={pwSaving || password.length === 0}
            style={btn("#2563eb", "#fff", pwSaving || password.length === 0)}>
            {pwSaving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </section>

      {/* Accounts list */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: bodyText }}>
            SMTP аккаунты <span style={{ color: dimText, fontWeight: 400 }}>({accounts.length})</span>
          </span>
          <button onClick={openAdd} style={btn("#1e3a5f", "#93c5fd")}>+ Добавить аккаунт</button>
        </div>

        {accounts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: muted, fontSize: "13px", background: surface, borderRadius: "10px", border: `1px solid ${border}` }}>
            Аккаунты не добавлены. Добавьте один, чтобы начать отправку.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {accounts.map((acc, i) => {
              const limit    = acc.dailyLimit ?? 500;
              const sent     = usage[acc.id] ?? 0;
              const pct      = Math.min(100, (sent / limit) * 100);
              const barColor = pct >= 100 ? "#ef4444" : pct >= 90 ? "#f59e0b" : "#22c55e";
              const exhausted = sent >= limit;
              return (
              <div key={acc.id} style={{ background: surface, border: `1px solid ${exhausted ? "#7f1d1d" : border}`, borderRadius: "8px", padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: dimText, flexShrink: 0 }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: exhausted ? "#fca5a5" : bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.fromName ? `${acc.fromName} ` : ""}
                      <span style={{ color: dimText }}>&lt;{acc.email}&gt;</span>
                      {exhausted && <span style={{ marginLeft: "8px", fontSize: "10px", fontWeight: 700, color: "#ef4444", background: "#450a0a", padding: "1px 7px", borderRadius: "99px" }}>ЛИМИТ ИСЧЕРПАН</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: dimText, marginTop: "2px" }}>
                      {acc.host}:{acc.port} · {acc.secure ? "TLS" : "STARTTLS"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openEdit(acc)} style={btn("#1e293b", "#94a3b8")}>Изменить</button>
                    <button onClick={() => handleDelete(acc.id)} style={btn("#450a0a", "#fca5a5")}>Удалить</button>
                  </div>
                </div>
                {/* Daily usage bar */}
                <div style={{ marginTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", color: dimText, textTransform: "uppercase", letterSpacing: "0.05em" }}>Использовано сегодня</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: barColor }}>{sent.toLocaleString()} / {limit.toLocaleString()}</span>
                  </div>
                  <div style={{ height: "4px", background: "#1e293b", borderRadius: "99px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "99px", transition: "width 0.4s ease" }} />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add / Edit form */}
      {showForm && (
        <section style={{ background: surface, border: `1px solid #334155`, borderRadius: "10px", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: bodyText, marginBottom: "16px" }}>
            {editing ? "Изменить аккаунт" : "Добавить аккаунт"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              {label("Email (логин SMTP)")}
              <input style={inputBase} value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@gmail.com" />
            </div>
            <div>
              {label("Имя отправителя")}
              <input style={inputBase} value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="ЕЛІТ ФІНАНС" />
            </div>
            <div>
              {label("SMTP хост")}
              <input style={inputBase} value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "end" }}>
              <div>
                {label("Порт")}
                <input type="number" style={inputBase} value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
              </div>
              <div>
                {label("Лимит в день")}
                <input type="number" min={1} style={{ ...inputBase, width: "90px" }} value={form.dailyLimit ?? 500}
                  onChange={(e) => setForm({ ...form, dailyLimit: Math.max(1, Number(e.target.value)) })} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", paddingBottom: "9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={form.secure}
                  onChange={(e) => setForm({ ...form, secure: e.target.checked })}
                  style={{ accentColor: "#3b82f6", width: "14px", height: "14px" }} />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>TLS (465)</span>
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={btn("#1e293b", "#94a3b8")}>Отмена</button>
            <button onClick={handleSave} disabled={saving || !form.email || !form.host}
              style={btn("#2563eb", "#fff", saving || !form.email || !form.host)}>
              {saving ? "Сохранение…" : editing ? "Сохранить изменения" : "Добавить аккаунт"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DispatchTab
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATUS: WorkerStatus = {
  running: false, stopping: false, done: false, error: null,
  totalRows: 0, lastProcessedIndex: -1, totalSent: 0, totalFailed: 0, startedAt: null,
};

function DispatchTab() {
  const [status, setStatus]           = useState<WorkerStatus>(INITIAL_STATUS);
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [delayMs, setDelayMs]         = useState(1000);
  const [batchSize, setBatchSize]     = useState(50);
  const [batchPauseMs, setBatchPauseMs] = useState(5000);
  const [dryRun, setDryRun]           = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    fetch("/api/email/status")
      .then((r) => r.json())
      .then(({ status: s, logs: l }: { status: WorkerStatus; logs: LogEntry[] }) => {
        setStatus(s);
        setLogs(l);
      })
      .catch(() => {});

    const es = new EventSource("/api/email/stream");
    es.onopen  = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: "log"; data: LogEntry }
          | { type: "status"; data: WorkerStatus };
        if (event.type === "log") appendLog(event.data);
        else if (event.type === "status") setStatus(event.data);
      } catch { /**/ }
    };

    return () => { es.close(); setSseConnected(false); };
  }, [appendLog]);

  const handleStart = () =>
    fetch("/api/email/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayBetweenEmailsMs: delayMs, batchSize, batchPauseMs, dryRun }),
    });

  const handleStop = () => fetch("/api/email/stop", { method: "POST" });

  const progress = status.totalRows > 0
    ? Math.min(100, ((status.lastProcessedIndex + 1) / status.totalRows) * 100) : 0;

  const isActive = status.running || status.stopping;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Config + controls */}
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
        {[
          { lbl: "Задержка (мс)",       val: delayMs,     set: setDelayMs,     w: "90px"  },
          { lbl: "Размер пачки",        val: batchSize,    set: setBatchSize,   w: "80px"  },
          { lbl: "Пауза пачки (мс)",    val: batchPauseMs, set: setBatchPauseMs, w: "100px" },
        ].map(({ lbl, val, set, w }) => (
          <div key={lbl}>
            {label(lbl)}
            <input type="number" value={val} disabled={isActive}
              onChange={(e) => set(Number(e.target.value))}
              style={{ ...inputBase, width: w, opacity: isActive ? 0.5 : 1 }} />
          </div>
        ))}

        <label style={{ display: "flex", alignItems: "center", gap: "7px", paddingBottom: "9px", cursor: isActive ? "not-allowed" : "pointer", opacity: isActive ? 0.5 : 1 }}>
          <input type="checkbox" checked={dryRun} disabled={isActive}
            onChange={(e) => setDryRun(e.target.checked)}
            style={{ accentColor: "#3b82f6", width: "14px", height: "14px" }} />
          <span style={{ fontSize: "13px", color: "#94a3b8", userSelect: "none" }}>Тестовый режим</span>
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <button onClick={handleStart} disabled={isActive} style={{ ...btn("#2563eb", "#fff", isActive), padding: "10px 22px", fontSize: "14px", fontWeight: 700 }}>
            ▶ Начать отправку
          </button>
          <button onClick={handleStop} disabled={!isActive || status.stopping}
            style={{ ...btn("#7f1d1d", "#fca5a5", !isActive || status.stopping), padding: "10px 22px", fontSize: "14px", fontWeight: 700 }}>
            {status.stopping ? "⏳ Останавливается…" : "■ Стоп"}
          </button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: surface, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ display: "flex", gap: "28px" }}>
            <Stat label="Строка"     value={status.lastProcessedIndex < 0 ? "—" : `${(status.lastProcessedIndex + 1).toLocaleString()} / ${status.totalRows.toLocaleString()}`} />
            <Stat label="Отправлено" value={status.totalSent.toLocaleString()}    color="#86efac" />
            <Stat label="Ошибки"     value={status.totalFailed.toLocaleString()}  color="#fca5a5" />
            <Stat label="Осталось"   value={status.totalRows > 0 ? Math.max(0, status.totalRows - (status.lastProcessedIndex + 1)).toLocaleString() : "—"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <StatusBadge status={status} />
            <span style={{ fontSize: "11px", color: sseConnected ? "#6ee7b7" : "#ef4444" }}>
              {sseConnected ? "● в эфире" : "○ отключён"}
            </span>
          </div>
        </div>
        <div style={{ height: "5px", background: "#1e293b", borderRadius: "99px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: "99px", transition: "width 0.4s ease",
            background: status.error ? "#ef4444" : status.done ? "#22c55e" : "linear-gradient(90deg,#2563eb,#7c3aed)" }} />
        </div>
        <div style={{ marginTop: "5px", fontSize: "11px", color: dimText, textAlign: "right" }}>{progress.toFixed(1)}%</div>
      </div>

      {/* Log feed */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: dimText, textTransform: "uppercase", letterSpacing: "0.05em" }}>Логи</span>
          <button onClick={() => setLogs([])} style={{ fontSize: "11px", color: muted, background: "none", border: "none", cursor: "pointer" }}>Очистить</button>
        </div>
        <div style={{ height: "280px", overflowY: "auto", background: "#0a0f1a", borderRadius: "8px", border: `1px solid ${border}`,
          padding: "10px 12px", fontFamily: '"Geist Mono",Consolas,monospace', fontSize: "12px", lineHeight: "1.7" }}>
          {logs.length === 0
            ? <span style={{ color: "#334155" }}>Логов пока нет — нажмите «Начать отправку».</span>
            : logs.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: "10px", color: logColor[e.level] }}>
                <span style={{ color: "#334155", flexShrink: 0 }}>{e.ts}</span>
                <span style={{ flexShrink: 0 }}>{logIcon[e.level]}</span>
                <span style={{ wordBreak: "break-all" }}>{e.message}</span>
              </div>
            ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function Stat({ label: lbl, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{lbl}</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: color ?? bodyText }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: WorkerStatus }) {
  const [label, color, bg] = status.stopping
    ? ["Останавливается", "#fcd34d", "#451a03"]
    : status.running
    ? ["Работает",        "#6ee7b7", "#022c22"]
    : status.done
    ? ["Завершено",       "#86efac", "#14532d"]
    : status.error
    ? ["Ошибка",          "#fca5a5", "#450a0a"]
    : ["Ожидание",        muted,      "#1e293b"];
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, color, background: bg, padding: "2px 10px", borderRadius: "99px", border: `1px solid ${color}30` }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailTab — top-level with Dispatch / Accounts sub-tabs
// ─────────────────────────────────────────────────────────────────────────────

type SubTab = "dispatch" | "accounts" | "templates";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "dispatch",  label: "Рассылка"  },
  { id: "accounts",  label: "Аккаунты"  },
  { id: "templates", label: "Шаблоны"   },
];

export default function EmailTab() {
  const [sub, setSub] = useState<SubTab>("dispatch");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: "2px", padding: "12px 32px 0", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {SUB_TABS.map(({ id, label: lbl }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderBottom: sub === id ? "2px solid #3b82f6" : "2px solid transparent",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              background: sub === id ? "#0f172a" : "transparent",
              color: sub === id ? "#e2e8f0" : "#475569",
              transition: "color 0.15s",
              marginBottom: "-1px",
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {sub === "dispatch"  && <DispatchTab />}
        {sub === "accounts"  && <AccountsTab />}
        {sub === "templates" && <TemplatesTab />}
      </div>
    </div>
  );
}
