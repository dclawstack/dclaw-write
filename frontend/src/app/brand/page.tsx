"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ApiError,
  BrandProfile,
  VoiceSample,
  addVoiceSample,
  createBrandProfile,
  deleteBrandProfile,
  listBrandProfiles,
  listVoiceSamples,
} from "@/lib/api"

function formatNumber(value: number, digits = 2): string {
  if (Number.isNaN(value)) return "—"
  return value.toFixed(digits)
}

export default function BrandPage() {
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [samples, setSamples] = useState<VoiceSample[]>([])
  const [newName, setNewName] = useState("")
  const [sampleText, setSampleText] = useState("")
  const [sampleLabel, setSampleLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = profiles.find((p) => p.id === activeId) ?? null

  const refresh = useCallback(async (preferId?: string | null) => {
    try {
      const response = await listBrandProfiles()
      setProfiles(response.items)
      const nextId =
        preferId !== undefined
          ? preferId
          : response.items.find((p) => p.id === activeId)?.id ?? response.items[0]?.id ?? null
      setActiveId(nextId)
      if (nextId) {
        const samplesResp = await listVoiceSamples(nextId)
        setSamples(samplesResp)
      } else {
        setSamples([])
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load brand profiles")
    }
  }, [activeId])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSelect = async (id: string) => {
    setActiveId(id)
    try {
      const samplesResp = await listVoiceSamples(id)
      setSamples(samplesResp)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load samples")
    }
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    try {
      const created = await createBrandProfile({ name: newName.trim() })
      setNewName("")
      await refresh(created.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create profile")
    } finally {
      setBusy(false)
    }
  }

  const onAddSample = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeId || !sampleText.trim()) return
    setBusy(true)
    try {
      await addVoiceSample(activeId, {
        text: sampleText.trim(),
        label: sampleLabel.trim() || undefined,
      })
      setSampleText("")
      setSampleLabel("")
      await refresh(activeId)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add sample")
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm("Delete this brand profile? All linked samples go too.")) return
    try {
      await deleteBrandProfile(id)
      await refresh(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete profile")
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Voice DNA — Brand profiles
            </h1>
            <p className="text-slate-600">
              Upload writing samples. The fingerprint constrains every Copilot completion to your voice.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Profiles</CardTitle>
              <CardDescription>One per voice (yours, a client's, a brand's).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {profiles.length === 0 && (
                <p className="text-sm text-slate-500">No profiles yet.</p>
              )}
              <ul className="space-y-1">
                {profiles.map((p) => {
                  const isActive = p.id === activeId
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p.id)}
                        className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                          isActive
                            ? "bg-blue-100 text-blue-900"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.sample_count} samples
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <form onSubmit={onCreate} className="w-full space-y-2">
                <Label htmlFor="new-profile">New profile</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-profile"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. My voice"
                  />
                  <Button type="submit" disabled={busy || !newName.trim()}>
                    Add
                  </Button>
                </div>
              </form>
              {active && (
                <Button variant="outline" className="w-full" onClick={() => onDelete(active.id)}>
                  Delete profile
                </Button>
              )}
            </CardFooter>
          </Card>

          <div className="space-y-6">
            {active ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{active.name}</CardTitle>
                    <CardDescription>
                      {active.sample_count} sample{active.sample_count === 1 ? "" : "s"} ·{" "}
                      {active.total_tokens.toLocaleString()} words used to fit DNA
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Metric
                      label="Mean sentence length"
                      value={formatNumber(active.style_features.mean_sentence_length ?? 0, 1)}
                      unit="words"
                    />
                    <Metric
                      label="Lexical diversity (TTR)"
                      value={formatNumber(active.style_features.type_token_ratio ?? 0, 2)}
                    />
                    <Metric
                      label="Reading ease (Flesch)"
                      value={formatNumber(active.style_features.flesch_reading_ease ?? 0, 0)}
                    />
                    <Metric
                      label="Commas per 100 words"
                      value={formatNumber(active.style_features.comma_density ?? 0, 1)}
                    />
                    <Metric
                      label="Semicolons per 100 words"
                      value={formatNumber(active.style_features.semicolon_density ?? 0, 2)}
                    />
                    <Metric
                      label="Dashes per 100 words"
                      value={formatNumber(active.style_features.dash_density ?? 0, 2)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add a sample</CardTitle>
                    <CardDescription>
                      Paste 200+ words you wrote. The more samples, the sharper the voice match.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={onAddSample} className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="sample-label">Label (optional)</Label>
                        <Input
                          id="sample-label"
                          value={sampleLabel}
                          onChange={(e) => setSampleLabel(e.target.value)}
                          placeholder="e.g. Substack post, Q3"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sample-text">Sample text</Label>
                        <textarea
                          id="sample-text"
                          value={sampleText}
                          onChange={(e) => setSampleText(e.target.value)}
                          className="min-h-[180px] w-full rounded border border-slate-200 bg-white p-3 text-sm leading-relaxed focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="Paste a writing sample…"
                        />
                      </div>
                      <Button type="submit" disabled={busy || !sampleText.trim()}>
                        Fit DNA from sample
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Samples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {samples.length === 0 ? (
                      <p className="text-sm text-slate-500">No samples yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-200 text-sm">
                        {samples.map((s) => (
                          <li key={s.id} className="flex items-center justify-between py-2">
                            <span>{s.label || "Untitled sample"}</span>
                            <span className="text-xs text-slate-500">
                              {s.word_count} words ·{" "}
                              {new Date(s.created_at).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-10 text-center text-sm text-slate-500">
                  Create a brand profile to start fitting your Voice DNA.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}
