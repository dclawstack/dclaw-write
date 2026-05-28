"use client"

// Landing-page seed/clear strip. REMOVE WHEN STRIPPING THE DEMO SURFACE —
// this file plus the line in `src/app/page.tsx` and the backend dev router
// are the entire demo footprint.

import { useCallback, useEffect, useState } from "react"
import { Sparkles, Trash2 } from "lucide-react"

import { ApiError, DemoStatus, demoClear, demoSeed, demoStatus } from "@/lib/api"

const VISIBLE_COUNTS: { key: string; label: string }[] = [
  { key: "projects", label: "projects" },
  { key: "documents", label: "docs" },
  { key: "brand_profiles", label: "voices" },
  { key: "citations", label: "citations" },
  { key: "ai_suggestions", label: "Copilot runs" },
  { key: "draft_pipelines", label: "pipelines" },
]

export default function DemoDataControls() {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await demoStatus()
      setStatus(next)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Backend unreachable")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onSeed = async () => {
    if (status && !status.is_empty) {
      if (!confirm("Replace existing app data with the demo set?")) return
    }
    setBusy("seed")
    setError(null)
    setFlash(null)
    try {
      const next = await demoSeed()
      setStatus(next)
      setFlash("Demo data loaded.")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Seed failed")
    } finally {
      setBusy(null)
    }
  }

  const onClear = async () => {
    if (!confirm("Wipe every project, document, citation, and suggestion?")) return
    setBusy("clear")
    setError(null)
    setFlash(null)
    try {
      const next = await demoClear()
      setStatus(next)
      setFlash("All app data cleared.")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Clear failed")
    } finally {
      setBusy(null)
    }
  }

  const tone = status?.is_empty ? "border-amber-300 bg-amber-50" : "border-blue-300 bg-blue-50"

  return (
    <div className={`border-b ${tone}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Demo mode
          </span>
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : !status ? (
            <span className="text-slate-600">Checking backend…</span>
          ) : status.is_empty ? (
            <span className="text-slate-700">
              Clean state — load the demo corpus to see every feature with real data.
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700">
              {VISIBLE_COUNTS.map(({ key, label }) => {
                const n = status.counts[key] ?? 0
                return (
                  <span key={key}>
                    <span className="font-semibold text-slate-900">{n}</span> {label}
                  </span>
                )
              })}
            </span>
          )}
          {flash && <span className="text-emerald-700">{flash}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSeed}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {busy === "seed" ? "Seeding…" : "Seed demo data"}
          </button>
          <button
            onClick={onClear}
            disabled={busy !== null || (status?.is_empty ?? false)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy === "clear" ? "Clearing…" : "Clear all data"}
          </button>
        </div>
      </div>
    </div>
  )
}
