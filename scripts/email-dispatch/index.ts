// ─────────────────────────────────────────────────────────────────────────────
// index.ts — CLI entry point.  Do NOT import this from the Next.js app.
//            (It calls dotenv/config as a side effect and owns process signals.)
//            Import runner.ts directly for programmatic use.
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config"; // must be first — not needed when running under Next.js

import { runDispatch, DEFAULT_CONFIG } from "./runner";
import { saveState, loadState } from "./state";
import type { DispatchState } from "./types";

const abortController = new AbortController();

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
        entry.level === "success" ? "✓" :
        entry.level === "error"   ? "✗" :
        entry.level === "warn"    ? "⚠" :
        entry.level === "rate"    ? "⏸" : "›";
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
