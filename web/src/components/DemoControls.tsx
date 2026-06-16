// ============================================================================
// DEMO ONLY — easy to remove later.
// To strip demo controls: delete this file, the `src/app/api/dev/` folder,
// `src/lib/demo.ts`, and the <DemoControls/> usage in `src/app/page.tsx`.
// ============================================================================
"use client";

import { useEffect, useState } from "react";

type Status = { brands: number; documents: number };

export function DemoControls() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function refresh() {
    try {
      setStatus(await (await fetch("/api/dev/status")).json());
    } catch {
      setStatus(null);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function seed() {
    setBusy("seed");
    setMsg("");
    try {
      const r = await (await fetch("/api/dev/seed", { method: "POST" })).json();
      setMsg(r.ok ? `Seeded ${r.brands} voices, ${r.documents} documents.` : `Error: ${r.error}`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function clear() {
    setBusy("clear");
    setMsg("");
    try {
      const r = await (await fetch("/api/dev/clear", { method: "POST" })).json();
      setMsg(r.ok ? "All app data cleared — fresh state." : `Error: ${r.error}`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  const populated = (status?.brands ?? 0) > 0 || (status?.documents ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
          Demo controls
        </span>
        <span className="text-xs text-[var(--muted)]">
          {status
            ? populated
              ? `Loaded: ${status.brands} voices · ${status.documents} docs`
              : "Fresh / empty state"
            : "…"}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Toggle between a fully-populated demo and a clean slate to explore the app in either state.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={seed}
          disabled={busy !== null}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {busy === "seed" ? "Seeding…" : "Load demo data"}
        </button>
        <button
          onClick={clear}
          disabled={busy !== null}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
        >
          {busy === "clear" ? "Clearing…" : "Clear all data"}
        </button>
        {msg && <span className="text-sm text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}
