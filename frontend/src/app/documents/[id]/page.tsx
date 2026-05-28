"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ApiError,
  BrandProfile,
  Citation,
  CompletionResponse,
  CulturalFinding,
  DetectionReport,
  Document,
  EvalReport,
  GroundedSource,
  HeadlineVariant,
  LanguageOption,
  PipelineRun,
  PlatformInfo,
  ReadabilityResponse,
  RepurposeResponse,
  Revision,
  TranslationResponse,
  aiComplete,
  aiDetection,
  aiFeedback,
  aiReadability,
  autoGroundDocument,
  collabSocketUrl,
  createCitation,
  deleteCitation,
  deleteDocument,
  evalDocument,
  exportDocumentUrl,
  generateHeadlines,
  getDocument,
  groundClaim,
  listBrandProfiles,
  listCitations,
  listLanguages,
  listPlatforms,
  listRevisions,
  repurposeDocument,
  runPipeline,
  translateText,
  updateCitation,
  updateDocument,
  voiceMatch,
} from "@/lib/api"

const WORDS_PER_MINUTE = 225

function countWords(text: string): number {
  const matches = text.match(/\b[\w'\-]+\b/g)
  return matches ? matches.length : 0
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "<1 min"
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} min`
}

function formatSprint(remaining: number): string {
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [doc, setDoc] = useState<Document | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const lastSavedRef = useRef<{ title: string; content: string }>({ title: "", content: "" })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>("")
  const [readability, setReadability] = useState<ReadabilityResponse | null>(null)
  const [voiceScore, setVoiceScore] = useState<number | null>(null)
  const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [suggestion, setSuggestion] = useState<CompletionResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiInstruction, setAiInstruction] = useState("")

  const [citations, setCitations] = useState<Citation[]>([])
  const [newClaim, setNewClaim] = useState("")
  const [newSourceUrl, setNewSourceUrl] = useState("")

  const [evalReport, setEvalReport] = useState<EvalReport | null>(null)
  const [evalBusy, setEvalBusy] = useState(false)

  const [pipelineRun, setPipelineRun] = useState<PipelineRun | null>(null)
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [pipelineExpanded, setPipelineExpanded] = useState(false)

  const [focusMode, setFocusMode] = useState(false)
  const [sprintRemaining, setSprintRemaining] = useState(0)
  const [sprintStartWords, setSprintStartWords] = useState(0)
  const [sprintTarget, setSprintTarget] = useState(300)
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [repurposeBusy, setRepurposeBusy] = useState<string | null>(null)
  const [repurposeResult, setRepurposeResult] = useState<RepurposeResponse | null>(null)

  const [groundingFor, setGroundingFor] = useState<string | null>(null)
  const [groundingCandidates, setGroundingCandidates] = useState<GroundedSource[]>([])
  const [groundingBusy, setGroundingBusy] = useState(false)
  const [autoGroundBusy, setAutoGroundBusy] = useState(false)

  const [detection, setDetection] = useState<DetectionReport | null>(null)
  const detectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [headlinesBusy, setHeadlinesBusy] = useState(false)
  const [headlineVariants, setHeadlineVariants] = useState<HeadlineVariant[]>([])

  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [translateTarget, setTranslateTarget] = useState("es")
  const [translateBusy, setTranslateBusy] = useState(false)
  const [translation, setTranslation] = useState<TranslationResponse | null>(null)

  const [peers, setPeers] = useState<{ peer_id: string; user: { name: string; color: string } }[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const peerNameRef = useRef<string>("")
  if (!peerNameRef.current) {
    peerNameRef.current = `Author-${Math.random().toString(36).slice(2, 6)}`
  }

  const loadDocument = useCallback(async () => {
    if (!id) return
    try {
      const d = await getDocument(id)
      setDoc(d)
      setTitle(d.title)
      setContent(d.content)
      lastSavedRef.current = { title: d.title, content: d.content }
      const [history, profilesResp, cits, platformList, langs] = await Promise.all([
        listRevisions(id),
        listBrandProfiles(),
        listCitations(id),
        listPlatforms().catch(() => [] as PlatformInfo[]),
        listLanguages().catch(() => [] as LanguageOption[]),
      ])
      setRevisions(history)
      setProfiles(profilesResp.items)
      if (profilesResp.items[0]) setActiveProfileId(profilesResp.items[0].id)
      setCitations(cits)
      setPlatforms(platformList)
      setLanguages(langs)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setError("Document not found.")
      else setError(e instanceof Error ? e.message : "Failed to load document")
    }
  }, [id])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  const persist = useCallback(async () => {
    if (!id) return
    const patch: Record<string, string> = {}
    if (title !== lastSavedRef.current.title) patch.title = title
    if (content !== lastSavedRef.current.content) patch.content = content
    if (Object.keys(patch).length === 0) {
      setSaveState("saved")
      return
    }
    setSaveState("saving")
    try {
      const updated = await updateDocument(id, patch)
      setDoc(updated)
      lastSavedRef.current = { title: updated.title, content: updated.content }
      setSaveState("saved")
      if ("content" in patch) {
        const history = await listRevisions(id)
        setRevisions(history)
      }
    } catch (e) {
      setSaveState("error")
      setError(e instanceof ApiError ? e.message : "Save failed")
    }
  }, [id, title, content])

  useEffect(() => {
    if (!doc) return
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState("saving")
    saveTimer.current = setTimeout(persist, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [title, content, doc, persist])

  useEffect(() => {
    if (!doc) return
    if (analysisTimer.current) clearTimeout(analysisTimer.current)
    analysisTimer.current = setTimeout(async () => {
      if (!content.trim()) {
        setReadability(null)
        setVoiceScore(null)
        return
      }
      try {
        const r = await aiReadability(content)
        setReadability(r)
      } catch {
        /* ignore */
      }
      if (activeProfileId) {
        try {
          const match = await voiceMatch(activeProfileId, content)
          setVoiceScore(match.score)
        } catch {
          setVoiceScore(null)
        }
      } else {
        setVoiceScore(null)
      }
    }, 1200)
    return () => {
      if (analysisTimer.current) clearTimeout(analysisTimer.current)
    }
  }, [content, doc, activeProfileId])

  const wordCount = useMemo(() => countWords(content), [content])
  const readingTime = useMemo(
    () => (wordCount === 0 ? 0 : Math.max(1, Math.round((wordCount / WORDS_PER_MINUTE) * 60))),
    [wordCount],
  )

  // sprint timer
  useEffect(() => {
    return () => {
      if (sprintTimer.current) clearInterval(sprintTimer.current)
    }
  }, [])

  // Live AI-detection scan, debounced like readability.
  useEffect(() => {
    if (!doc) return
    if (detectionTimer.current) clearTimeout(detectionTimer.current)
    detectionTimer.current = setTimeout(async () => {
      if (countWords(content) < 50) {
        setDetection(null)
        return
      }
      try {
        const report = await aiDetection(content)
        setDetection(report)
      } catch {
        /* non-critical */
      }
    }, 1500)
    return () => {
      if (detectionTimer.current) clearTimeout(detectionTimer.current)
    }
  }, [content, doc])

  // Collab presence WebSocket (one room per document).
  useEffect(() => {
    if (!doc) return
    let ws: WebSocket
    try {
      ws = new WebSocket(collabSocketUrl(doc.id, peerNameRef.current))
    } catch {
      return
    }
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === "hello") {
          setPeers(message.roster ?? [])
        } else if (message.type === "join" && message.peer) {
          setPeers((prev) => {
            if (prev.some((p) => p.peer_id === message.peer.peer_id)) return prev
            return [...prev, message.peer]
          })
        } else if (message.type === "leave") {
          setPeers((prev) => prev.filter((p) => p.peer_id !== message.peer_id))
        }
      } catch {
        /* ignore non-JSON frames */
      }
    }

    return () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      wsRef.current = null
      setPeers([])
    }
  }, [doc])

  const startSprint = (durationMinutes: number) => {
    if (sprintTimer.current) clearInterval(sprintTimer.current)
    setSprintRemaining(durationMinutes * 60)
    setSprintStartWords(wordCount)
    sprintTimer.current = setInterval(() => {
      setSprintRemaining((prev) => {
        if (prev <= 1) {
          if (sprintTimer.current) clearInterval(sprintTimer.current)
          sprintTimer.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const cancelSprint = () => {
    if (sprintTimer.current) clearInterval(sprintTimer.current)
    sprintTimer.current = null
    setSprintRemaining(0)
  }

  const sprintActive = sprintRemaining > 0
  const sprintProgress = sprintActive
    ? Math.min(100, ((wordCount - sprintStartWords) / sprintTarget) * 100)
    : 0

  const onDelete = async () => {
    if (!doc) return
    if (!confirm("Delete this document? This cannot be undone.")) return
    try {
      await deleteDocument(doc.id)
      router.push("/dashboard")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete document")
    }
  }

  const onContinue = async () => {
    if (!doc || aiBusy) return
    setAiBusy(true)
    setError(null)
    try {
      const response = await aiComplete({
        document_id: doc.id,
        brand_profile_id: activeProfileId || undefined,
        prompt: content || title,
        instruction: aiInstruction.trim() || undefined,
        max_tokens: 320,
      })
      setSuggestion(response)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Copilot failed")
    } finally {
      setAiBusy(false)
    }
  }

  const onAccept = async () => {
    if (!suggestion) return
    const separator = content && !content.endsWith("\n") ? "\n\n" : ""
    setContent(content + separator + suggestion.text)
    try {
      await aiFeedback(suggestion.suggestion_id, true)
    } catch {
      /* telemetry-only */
    }
    setSuggestion(null)
  }

  const onReject = async () => {
    if (!suggestion) return
    try {
      await aiFeedback(suggestion.suggestion_id, false)
    } catch {
      /* ignore */
    }
    setSuggestion(null)
  }

  const onAddCitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doc || !newClaim.trim() || !newSourceUrl.trim()) return
    try {
      const created = await createCitation(doc.id, {
        claim: newClaim.trim(),
        source_url: newSourceUrl.trim(),
      })
      setCitations([...citations, created])
      setNewClaim("")
      setNewSourceUrl("")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add citation")
    }
  }

  const onToggleVerified = async (citation: Citation) => {
    try {
      const updated = await updateCitation(citation.id, { verified: !citation.verified })
      setCitations(citations.map((c) => (c.id === updated.id ? updated : c)))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update citation")
    }
  }

  const onDeleteCitation = async (citation: Citation) => {
    try {
      await deleteCitation(citation.id)
      setCitations(citations.filter((c) => c.id !== citation.id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete citation")
    }
  }

  const onRunEval = async () => {
    if (!doc) return
    setEvalBusy(true)
    try {
      const report = await evalDocument(doc.id, activeProfileId || undefined)
      setEvalReport(report)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Eval failed")
    } finally {
      setEvalBusy(false)
    }
  }

  const onRepurpose = async (platform: string) => {
    if (!doc || repurposeBusy) return
    setRepurposeBusy(platform)
    setRepurposeResult(null)
    try {
      const result = await repurposeDocument(doc.id, {
        platform,
        brand_profile_id: activeProfileId || undefined,
        instruction: aiInstruction.trim() || undefined,
      })
      setRepurposeResult(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Repurpose failed")
    } finally {
      setRepurposeBusy(null)
    }
  }

  const onFindSources = async (citation: Citation) => {
    setGroundingFor(citation.id)
    setGroundingBusy(true)
    setGroundingCandidates([])
    try {
      const result = await groundClaim({
        claim: citation.claim,
        max_results: 5,
        accept_threshold: 50,
      })
      setGroundingCandidates(result.sources)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed")
    } finally {
      setGroundingBusy(false)
    }
  }

  const onAttachGroundedSource = async (candidate: GroundedSource) => {
    if (!groundingFor) return
    try {
      const updated = await updateCitation(groundingFor, {
        source_url: candidate.url,
        source_title: candidate.title,
        source_snippet: candidate.snippet,
        verified: candidate.verified,
      })
      setCitations(citations.map((c) => (c.id === updated.id ? updated : c)))
      setGroundingFor(null)
      setGroundingCandidates([])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not attach source")
    }
  }

  const onAutoGround = async () => {
    if (!doc || autoGroundBusy) return
    if (!confirm("Scan the draft for load-bearing claims and seed citations?")) return
    setAutoGroundBusy(true)
    try {
      const result = await autoGroundDocument(doc.id, {
        accept_threshold: 50,
        max_claims: 8,
      })
      const refreshed = await listCitations(doc.id)
      setCitations(refreshed)
      alert(
        `Created ${result.created_citation_ids.length} citation${result.created_citation_ids.length === 1 ? "" : "s"}.`,
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Auto-grounding failed")
    } finally {
      setAutoGroundBusy(false)
    }
  }

  const onGenerateHeadlines = async () => {
    if (!doc || headlinesBusy) return
    setHeadlinesBusy(true)
    setHeadlineVariants([])
    try {
      const result = await generateHeadlines({
        topic: title || "Untitled draft",
        body: content,
        n: 5,
        brand_profile_id: activeProfileId || undefined,
      })
      setHeadlineVariants(result.variants)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Headline generation failed")
    } finally {
      setHeadlinesBusy(false)
    }
  }

  const onUseHeadline = (headline: string) => {
    setTitle(headline)
  }

  const onTranslate = async () => {
    if (!doc || translateBusy) return
    setTranslateBusy(true)
    setTranslation(null)
    try {
      const result = await translateText({
        text: content,
        target_language: translateTarget,
        brand_profile_id: activeProfileId || undefined,
      })
      setTranslation(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Translation failed")
    } finally {
      setTranslateBusy(false)
    }
  }

  const onRunPipeline = async () => {
    if (!doc || pipelineBusy) return
    if (!confirm("Run the multi-agent draft pipeline? It overwrites the current content.")) return
    setPipelineBusy(true)
    setError(null)
    try {
      const result = await runPipeline({
        topic: title || "Untitled draft",
        document_id: doc.id,
        brand_profile_id: activeProfileId || undefined,
        instruction: aiInstruction.trim() || undefined,
      })
      setPipelineRun(result)
      if (result.final_draft) {
        setContent(result.final_draft)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Pipeline failed")
    } finally {
      setPipelineBusy(false)
    }
  }

  if (error && !doc) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-700 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    )
  }

  if (!doc) return <main className="mx-auto max-w-3xl p-6 text-slate-600">Loading…</main>

  const mainColClass = focusMode ? "max-w-3xl" : "grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]"

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className={`mx-auto ${mainColClass}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="hover:underline">← All documents</Link>
              <Link href="/brand" className="hover:underline">Voice DNA</Link>
              <Link href="/analytics" className="hover:underline">Analytics</Link>
            </div>
            <div className="flex items-center gap-3">
              <PresenceBadge selfName={peerNameRef.current} peers={peers} />
              <span>
                {saveState === "saving" && "Saving…"}
                {saveState === "saved" && "Saved"}
                {saveState === "error" && "Save failed"}
              </span>
              <Button variant="outline" onClick={() => setFocusMode(!focusMode)}>
                {focusMode ? "Exit focus" : "Focus mode"}
              </Button>
              <ExportMenu documentId={doc.id} title={title} />
              <Button variant="outline" onClick={onDelete}>Delete</Button>
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-0 bg-transparent text-3xl font-semibold focus-visible:ring-0 px-0"
            placeholder="Untitled"
          />

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>{wordCount} words</span>
            <span>{content.length} characters</span>
            <span>{formatTime(readingTime)} read</span>
            {sprintActive ? (
              <>
                <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-blue-900">
                  Sprint {formatSprint(sprintRemaining)}
                </span>
                <span>
                  {wordCount - sprintStartWords}/{sprintTarget} words
                </span>
                <button onClick={cancelSprint} className="text-blue-700 hover:underline">
                  cancel
                </button>
              </>
            ) : (
              <SprintLauncher
                target={sprintTarget}
                onChangeTarget={setSprintTarget}
                onStart={startSprint}
              />
            )}
          </div>

          {sprintActive && (
            <div className="h-1 w-full overflow-hidden rounded bg-slate-200">
              <div className="h-full bg-blue-500" style={{ width: `${sprintProgress}%` }} />
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`w-full resize-y rounded border border-slate-200 bg-white p-4 font-serif leading-relaxed focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
              focusMode ? "min-h-[75vh] text-xl" : "min-h-[60vh] text-lg"
            }`}
            placeholder="Start writing…"
          />

          {suggestion && (
            <Card className="border-blue-300 bg-blue-50/50">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Copilot suggestion</CardTitle>
                  <p className="text-xs text-slate-500">
                    {suggestion.provider} · {suggestion.model} · {suggestion.latency_ms} ms
                    {suggestion.voice_match_score !== null && (
                      <> · voice match {suggestion.voice_match_score}/100</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onReject}>Reject</Button>
                  <Button onClick={onAccept}>Accept</Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {suggestion.text}
                </p>
              </CardContent>
            </Card>
          )}

          {pipelineRun && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Multi-agent pipeline</CardTitle>
                  <p className="text-xs text-slate-500">
                    {pipelineRun.status} · 5 agents · planner → researcher → drafter → editor → fact-checker
                  </p>
                </div>
                <Button variant="outline" onClick={() => setPipelineExpanded(!pipelineExpanded)}>
                  {pipelineExpanded ? "Hide artifacts" : "Inspect artifacts"}
                </Button>
              </CardHeader>
              {pipelineExpanded && (
                <CardContent>
                  <pre className="max-h-96 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(pipelineRun.artifacts, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {!focusMode && (
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Copilot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="brand-select">Voice profile</Label>
                  <select
                    id="brand-select"
                    value={activeProfileId}
                    onChange={(e) => setActiveProfileId(e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white p-2 text-sm"
                  >
                    <option value="">No profile (generic voice)</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sample_count})
                      </option>
                    ))}
                  </select>
                  {profiles.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No brand profiles yet —{" "}
                      <Link href="/brand" className="text-blue-700 hover:underline">create one</Link>.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ai-instruction">Instruction (optional)</Label>
                  <Input
                    id="ai-instruction"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g. add a contrasting example"
                  />
                </div>
                <Button onClick={onContinue} disabled={aiBusy} className="w-full">
                  {aiBusy ? "Generating…" : "Continue writing"}
                </Button>
                <Button
                  variant="outline"
                  onClick={onRunPipeline}
                  disabled={pipelineBusy}
                  className="w-full"
                >
                  {pipelineBusy ? "Running pipeline…" : "Run full draft pipeline"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voice match</CardTitle>
              </CardHeader>
              <CardContent>
                {!activeProfileId ? (
                  <p className="text-sm text-slate-500">Select a voice profile to score this draft.</p>
                ) : voiceScore === null ? (
                  <p className="text-sm text-slate-500">Start writing — the score updates live.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-slate-900">{voiceScore}/100</div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.min(100, Math.max(0, voiceScore))}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      How closely this draft matches your fitted Voice DNA.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Readability</CardTitle>
              </CardHeader>
              <CardContent>
                {!readability ? (
                  <p className="text-sm text-slate-500">Write a few sentences to see the score.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex justify-between">
                      <span>Flesch reading ease</span>
                      <span className="font-medium">{readability.flesch_reading_ease.toFixed(0)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>FK grade level</span>
                      <span className="font-medium">{readability.flesch_kincaid_grade.toFixed(1)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Avg sentence length</span>
                      <span className="font-medium">{readability.mean_sentence_length.toFixed(1)} words</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Long sentences (&gt;25w)</span>
                      <span className="font-medium">{(readability.long_sentence_ratio * 100).toFixed(0)}%</span>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">Eval scorecard</CardTitle>
                <Button variant="outline" onClick={onRunEval} disabled={evalBusy}>
                  {evalBusy ? "Scoring…" : "Refresh"}
                </Button>
              </CardHeader>
              <CardContent>
                {!evalReport ? (
                  <p className="text-sm text-slate-500">Run the scorecard to grade this draft.</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Grade</span>
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-white">
                        {evalReport.grade}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Voice match</span>
                      <span>
                        {evalReport.voice_match_score === null
                          ? "—"
                          : `${evalReport.voice_match_score}/100`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Citation density</span>
                      <span>{evalReport.citation_density.toFixed(2)}/100 words</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Verified citations</span>
                      <span>{evalReport.verified_citations}/{evalReport.total_citations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Claims needing sources</span>
                      <span>{evalReport.claims_needing_sources}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">
                  Citations ({citations.length})
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={onAutoGround}
                  disabled={autoGroundBusy}
                >
                  {autoGroundBusy ? "Scanning…" : "Auto-ground"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {citations.length === 0 ? (
                  <p className="text-sm text-slate-500">No citations yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {citations.map((c) => (
                      <li key={c.id} className="rounded border border-slate-200 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-800">{c.claim}</span>
                          <button
                            onClick={() => onDeleteCitation(c)}
                            className="text-xs text-slate-500 hover:text-red-600"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-blue-700 hover:underline"
                          >
                            {c.source_url}
                          </a>
                          <button
                            onClick={() => onToggleVerified(c)}
                            className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                              c.verified
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {c.verified ? "verified" : "unverified"}
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => onFindSources(c)}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Find sources
                          </button>
                          {groundingFor === c.id && groundingBusy && (
                            <span className="text-xs text-slate-500">Searching…</span>
                          )}
                        </div>
                        {groundingFor === c.id && !groundingBusy && groundingCandidates.length > 0 && (
                          <ul className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50 p-2">
                            {groundingCandidates.map((g) => (
                              <li key={g.url} className="space-y-1 border-b border-slate-200 pb-1 last:border-b-0 last:pb-0">
                                <div className="flex items-center justify-between gap-2">
                                  <a
                                    href={g.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-xs text-blue-700 hover:underline"
                                  >
                                    {g.title}
                                  </a>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                      g.verified
                                        ? "bg-green-100 text-green-800"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {g.support_score}%
                                  </span>
                                </div>
                                <p className="text-[11px] leading-snug text-slate-600">
                                  {g.snippet}
                                </p>
                                <button
                                  onClick={() => onAttachGroundedSource(g)}
                                  className="text-[11px] text-blue-700 hover:underline"
                                >
                                  Attach this source
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={onAddCitation} className="space-y-2">
                  <Input
                    placeholder="Claim"
                    value={newClaim}
                    onChange={(e) => setNewClaim(e.target.value)}
                  />
                  <Input
                    placeholder="Source URL"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={!newClaim.trim() || !newSourceUrl.trim()}
                    className="w-full"
                  >
                    Add citation
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI-detection self-check</CardTitle>
              </CardHeader>
              <CardContent>
                {!detection ? (
                  <p className="text-sm text-slate-500">
                    Write at least 50 words to score against AI-detection heuristics.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-slate-900">
                        {detection.score}/100
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          detection.label === "human-looking"
                            ? "bg-green-100 text-green-800"
                            : detection.label === "borderline"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {detection.label}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <Axis label="Burstiness" value={detection.burstiness} />
                      <Axis label="Lexical diversity" value={detection.lexical_diversity} />
                      <Axis label="Punctuation variety" value={detection.punctuation_variety} />
                      <Axis label="Starter diversity" value={detection.starter_diversity} />
                      <Axis label="Rare-word share" value={detection.rare_word_share} />
                    </ul>
                    {detection.suggestions.length > 0 && (
                      <ul className="space-y-1 rounded bg-slate-50 p-2 text-xs text-slate-700">
                        {detection.suggestions.map((s) => (
                          <li key={s}>· {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">A/B headlines</CardTitle>
                <Button
                  variant="outline"
                  onClick={onGenerateHeadlines}
                  disabled={headlinesBusy}
                >
                  {headlinesBusy ? "Generating…" : "Generate"}
                </Button>
              </CardHeader>
              <CardContent>
                {headlineVariants.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Generate 5 variants ranked by length, specificity, curiosity, and voice match.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {headlineVariants.map((v, idx) => (
                      <li
                        key={`${v.headline}-${idx}`}
                        className="space-y-1 rounded border border-slate-200 p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-800">{v.headline}</span>
                          <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-white">
                            {v.score}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            len {v.length_score} · spec {v.specificity_score} · curi{" "}
                            {v.curiosity_score} · voice {v.voice_match_score}
                          </span>
                          <button
                            onClick={() => onUseHeadline(v.headline)}
                            className="text-blue-700 hover:underline"
                          >
                            Use
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Translate + cultural review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={translateTarget}
                    onChange={(e) => setTranslateTarget(e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white p-2 text-sm"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={onTranslate} disabled={translateBusy}>
                    {translateBusy ? "…" : "Translate"}
                  </Button>
                </div>
                {translation && (
                  <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        {translation.language_name}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(translation.text)}
                        className="text-blue-700 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-800">
                      {translation.text}
                    </pre>
                    {translation.cultural_review.length > 0 && (
                      <div className="space-y-1 border-t border-slate-200 pt-2">
                        <p className="font-medium text-slate-700">
                          Culture-flagged ({translation.cultural_review.length})
                        </p>
                        <ul className="space-y-1">
                          {translation.cultural_review.map((f, idx) => (
                            <li
                              key={`${f.match}-${idx}`}
                              className="rounded bg-yellow-50 px-2 py-1 text-[11px] text-yellow-900"
                            >
                              <span className="font-mono">{f.match}</span> ({f.category}) — {f.suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Repurpose</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {platforms.length === 0 ? (
                  <p className="text-sm text-slate-500">Loading platforms…</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {platforms.map((p) => (
                      <Button
                        key={p.key}
                        variant="outline"
                        onClick={() => onRepurpose(p.key)}
                        disabled={repurposeBusy !== null}
                      >
                        {repurposeBusy === p.key ? "…" : p.name}
                      </Button>
                    ))}
                  </div>
                )}
                {repurposeResult && (
                  <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        {repurposeResult.platform_name}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(repurposeResult.text)
                        }}
                        className="text-blue-700 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-800">
                      {repurposeResult.text}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revision history</CardTitle>
              </CardHeader>
              <CardContent>
                {revisions.length === 0 ? (
                  <p className="text-sm text-slate-500">No revisions yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-600">
                    {revisions.slice(0, 5).map((rev) => (
                      <li key={rev.id} className="flex items-center justify-between">
                        <span>{new Date(rev.created_at).toLocaleString()}</span>
                        <span>{rev.word_count} words</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </main>
  )
}

function ExportMenu({ documentId, title }: { documentId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const formats: ("md" | "html" | "docx")[] = ["md", "html", "docx"]
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen(!open)}>
        Export ▾
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded border border-slate-200 bg-white text-sm shadow-md">
          {formats.map((fmt) => (
            <a
              key={fmt}
              href={exportDocumentUrl(documentId, fmt)}
              download={`${title || "document"}.${fmt}`}
              className="block px-3 py-2 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              .{fmt}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Axis({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-32 shrink-0">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded bg-slate-200">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${Math.min(100, (value / 20) * 100)}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums">{value}</span>
    </li>
  )
}

function PresenceBadge({
  selfName,
  peers,
}: {
  selfName: string
  peers: { peer_id: string; user: { name: string; color: string } }[]
}) {
  if (peers.length === 0) {
    return (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        {selfName} (only you)
      </span>
    )
  }
  return (
    <span
      className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-900"
      title={peers.map((p) => p.user.name).join(", ")}
    >
      {selfName} + {peers.length} editing
    </span>
  )
}

function SprintLauncher({
  target,
  onChangeTarget,
  onStart,
}: {
  target: number
  onChangeTarget: (n: number) => void
  onStart: (durationMinutes: number) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>Sprint:</span>
      <input
        type="number"
        min={50}
        step={50}
        value={target}
        onChange={(e) => onChangeTarget(Number(e.target.value) || 0)}
        className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 text-right"
      />
      <span>words</span>
      <button onClick={() => onStart(10)} className="text-blue-700 hover:underline">
        10 min
      </button>
      <button onClick={() => onStart(25)} className="text-blue-700 hover:underline">
        25 min
      </button>
    </div>
  )
}
