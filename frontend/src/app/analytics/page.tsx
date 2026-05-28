"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ApiError, DashboardResponse, fetchDashboard } from "@/lib/api"

function formatCents(value: number): string {
  if (value === 0) return "$0.0000"
  return `$${(value / 100).toFixed(4)}`
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const data = await fetchDashboard()
      setDashboard(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load dashboard")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Inference dashboard
            </h1>
            <p className="text-slate-600">
              Cost, latency, and acceptance rate across every Copilot completion.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">
              ← Dashboard
            </Link>
            <Button variant="outline" onClick={load} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!dashboard ? (
          <p className="text-slate-500">Loading…</p>
        ) : dashboard.total_completions === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-slate-500">
              No Copilot runs yet. Generate a completion in the editor and refresh.
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Total completions"
                value={dashboard.total_completions.toLocaleString()}
              />
              <Stat
                label="Acceptance rate"
                value={
                  dashboard.accept_rate === null
                    ? "—"
                    : `${(dashboard.accept_rate * 100).toFixed(0)}%`
                }
                hint={`${dashboard.accepted} accepted · ${dashboard.rejected} rejected`}
              />
              <Stat
                label="Avg latency"
                value={`${dashboard.avg_latency_ms} ms`}
                hint={`p95 ${dashboard.p95_latency_ms} ms`}
              />
              <Stat
                label="Estimated cost"
                value={formatCents(dashboard.estimated_cost_cents)}
                hint={
                  dashboard.avg_voice_match === null
                    ? undefined
                    : `Avg voice match ${dashboard.avg_voice_match}/100`
                }
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Per-provider breakdown</CardTitle>
                <CardDescription>
                  Ollama runs locally at zero marginal cost. Cloud providers use a
                  static price table (4 chars/token).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-2">Provider</th>
                      <th className="pb-2 text-right">Completions</th>
                      <th className="pb-2 text-right">Avg latency</th>
                      <th className="pb-2 text-right">p95 latency</th>
                      <th className="pb-2 text-right">Voice match</th>
                      <th className="pb-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dashboard.providers.map((p) => (
                      <tr key={p.provider}>
                        <td className="py-2 font-mono text-xs">{p.provider}</td>
                        <td className="py-2 text-right">{p.completions}</td>
                        <td className="py-2 text-right">{p.avg_latency_ms} ms</td>
                        <td className="py-2 text-right">{p.p95_latency_ms} ms</td>
                        <td className="py-2 text-right">
                          {p.avg_voice_match === null ? "—" : `${p.avg_voice_match}/100`}
                        </td>
                        <td className="py-2 text-right">
                          {formatCents(p.estimated_cost_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent completions</CardTitle>
                <CardDescription>Last 20 Copilot calls.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-slate-200 text-sm">
                  {dashboard.recent
                    .slice()
                    .reverse()
                    .map((r, idx) => (
                      <li
                        key={`${r.created_at}-${idx}`}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-slate-700">
                            {r.provider} · {r.model}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(r.created_at).toLocaleString()} · {r.latency_ms} ms
                            {r.voice_match_score !== null && (
                              <> · voice {r.voice_match_score}/100</>
                            )}
                          </span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            r.accepted === true
                              ? "bg-green-100 text-green-800"
                              : r.accepted === false
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.accepted === true
                            ? "accepted"
                            : r.accepted === false
                              ? "rejected"
                              : "pending"}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </CardContent>
    </Card>
  )
}
