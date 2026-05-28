import type { Metadata } from "next"
import Link from "next/link"

// Demo data controls — REMOVE WITH THE BACKEND `dev` ROUTER.
import DemoDataControls from "@/components/demo-data-controls"
import {
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardCheck,
  Cpu,
  FileText,
  Fingerprint,
  Globe2,
  Layers,
  Quote,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
  Workflow,
} from "lucide-react"

export const metadata: Metadata = {
  title: "DClaw Write — Long-form writing that sounds like you",
  description:
    "Voice DNA fingerprints your style, citation-grounded AI kills hallucinations, and a five-agent pipeline drafts in your voice. Built for B2B content teams done with the AI-detection panic.",
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <DemoDataControls />
      <Hero />
      <Painline />
      <WedgeVoiceDna />
      <WedgeCitation />
      <WedgePipeline />
      <WedgeRepurpose />
      <FeatureGrid />
      <TechDepth />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}

// ─────────────────────────────────────────────────────────────── shared bits

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
            <Fingerprint className="h-4 w-4" />
          </span>
          <span>DClaw Write</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
          <a href="#wedges" className="hover:text-slate-900">Wedges</a>
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#tech" className="hover:text-slate-900">Under the hood</a>
          <Link href="/dashboard" className="hover:text-slate-900">App</Link>
        </nav>
        <Link
          href="/dashboard"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open app
        </Link>
      </div>
    </header>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
      {children}
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string
  title: string
  body?: string
  align?: "left" | "center"
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-base text-slate-600 sm:text-lg">{body}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────── hero

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_60%)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div className="space-y-6">
          <Eyebrow>
            <Sparkles className="h-3.5 w-3.5" />
            For B2B content teams done with AI-detection panic
          </Eyebrow>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Long-form writing
            <br />
            that sounds like <span className="text-blue-600">you</span>.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600">
            DClaw Write fingerprints your voice, grounds every claim in a real source, and runs a
            five-agent pipeline that drafts in your style. Drop generic LLM output. Ship copy that
            survives the detector — and the editor.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open the app
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#wedges"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              See how it works
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Local-first AI (Ollama)
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-emerald-500" />
              Three-tier inference fallback
            </span>
            <span className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-emerald-500" />
              79 backend tests green
            </span>
          </div>
        </div>

        <HeroEditorMock />
      </div>
    </section>
  )
}

function HeroEditorMock() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <span className="font-mono">draft.md · saved</span>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Why small teams ship faster</p>
          <p className="font-serif text-base leading-relaxed text-slate-800">
            Markets churned through the morning, then settled into a familiar drift. Bond yields
            nudged up; equities slipped a touch — the only reasonable response when the data refuses
            to commit.
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Voice match" value="84/100" tone="emerald" />
            <Stat label="Flesch" value="62" tone="blue" />
            <Stat label="AI-detect" value="Human" tone="violet" />
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between text-blue-900">
              <span className="font-semibold">Copilot suggestion</span>
              <span className="font-mono text-[10px]">ollama · 1.4s</span>
            </div>
            <p className="text-slate-700">
              "The tape was thin, the prints unhelpful. By midday the desk had given up on a
              direction and started managing exposure instead."
            </p>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden rotate-3 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg shadow-slate-900/5 sm:block">
        <div className="flex items-center gap-2 text-slate-700">
          <Quote className="h-3.5 w-3.5 text-blue-600" />
          <span className="font-medium">3 citations · 100% verified</span>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "emerald" | "blue" | "violet"
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-800",
    blue: "bg-blue-50 text-blue-800",
    violet: "bg-violet-50 text-violet-800",
  }[tone]
  return (
    <div className={`rounded-lg px-2 py-1.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

// ───────────────────────────────────────────────────────── hair-on-fire pains

function Painline() {
  const pains = [
    {
      title: "AI-detection panic",
      body: "Agencies and freelancers lose contracts when drafts get flagged by GPTZero or Originality.ai. Your work is human — your tool has to prove it.",
    },
    {
      title: "Voice drift kills conversion",
      body: "Generic LLM output reads like every other blog. Your audience clicks away because nothing sounds like the brand they followed.",
    },
    {
      title: "Hallucinations block B2B & journalism",
      body: "Every claim needs a source. Without inline citations, your draft can't ship to a serious publication or a regulated buyer.",
    },
  ]
  return (
    <section className="border-y border-slate-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="The pain"
          title="LLM wrappers stopped being enough."
          body="The writers paying for AI tools today are dealing with three burning problems. DClaw Write was built around all three."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────── wedge: voice dna

function WedgeVoiceDna() {
  return (
    <section id="wedges" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="Wedge 01 · Voice DNA"
        title="Your style, fingerprinted."
        body="Upload writing samples. We extract a 12-axis style vector — mean sentence length, lexical diversity, punctuation rhythm, top-30 bigram signature — and constrain every Copilot completion to it."
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 font-mono text-xs leading-6">
          <p className="text-slate-500">brand_profile.style_features</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-slate-100">
{`{
  "mean_sentence_length": 11.7,
  "type_token_ratio": 0.62,
  "comma_density": 4.1,
  "semicolon_density": 1.2,
  "dash_density": 0.8,
  "flesch_reading_ease": 64,
  "avg_paragraph_words": 58,
  "top_bigrams": [
    "markets churned",
    "nudged up",
    "the writer"
  ]
}`}
          </pre>
        </div>
        <div className="space-y-6">
          <FeatureRow
            icon={Fingerprint}
            title="Per-user style vector"
            body="Statistical features plus a normalized bigram signature. Computed locally in milliseconds — no hosted model required to fit."
          />
          <FeatureRow
            icon={Target}
            title="Live voice-match score"
            body="Every paragraph is graded 0-100 against your DNA. Drift shows up in the sidebar before it ships."
          />
          <FeatureRow
            icon={Sparkles}
            title="Voice-constrained completions"
            body="The Copilot's system prompt encodes your sentence rhythm, lexical density, and signature phrases. Output sounds like you — not like the model."
          />
        </div>
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────────────────── wedge: citing

function WedgeCitation() {
  return (
    <section className="bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Wedge 02 · Citation-grounded"
          title="Every claim, an attached source."
          body="Tavily-first web search, per-claim support scoring, one-click attach. Auto-grounding sweeps the draft for percentages, dates, and named studies — and seeds the citation rows for you."
        />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="space-y-5">
            <FeatureRow
              icon={Quote}
              title="Find sources per claim"
              body="Tavily / Serper / mock fallback returns ranked candidates with overlap-based support scores. Pick one to attach."
              tone="dark"
            />
            <FeatureRow
              icon={ScanLine}
              title="Auto-ground the whole draft"
              body="Heuristic claim detector flags load-bearing sentences (percentages, years, 'according to') and seeds citation rows in one pass."
              tone="dark"
            />
            <FeatureRow
              icon={ShieldCheck}
              title="Verified / unverified at a glance"
              body="Citation rows are flagged the moment overlap clears the threshold — and you can override either way."
              tone="dark"
            />
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Grounded sources for the claim
            </div>
            <p className="mt-1 text-sm text-slate-200">
              "73% of small teams ship faster than enterprise teams."
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <SourceRow
                title="Small-team productivity — research reference"
                url="scholar.example.org/57934a8e/small"
                score={84}
              />
              <SourceRow
                title="The shipping cadence study — encyclopedia"
                url="en.wikipedia.org/57934a8e/teams"
                score={71}
              />
              <SourceRow
                title="2024 team velocity report — press"
                url="news.example.com/57934a8e/velocity"
                score={58}
              />
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function SourceRow({ title, url, score }: { title: string; url: string; score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/20 text-emerald-200"
      : score >= 60
        ? "bg-amber-500/20 text-amber-200"
        : "bg-slate-500/20 text-slate-200"
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg bg-slate-900/60 p-3">
      <div>
        <p className="font-medium text-slate-100">{title}</p>
        <p className="font-mono text-[11px] text-slate-400">{url}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${tone}`}>{score}%</span>
    </li>
  )
}

// ───────────────────────────────────────────────────────── wedge: pipeline

function WedgePipeline() {
  const steps = [
    {
      key: "planner",
      title: "Planner",
      body: "Outlines 4-6 sections, each with a one-sentence brief.",
    },
    {
      key: "researcher",
      title: "Researcher",
      body: "Per-section bullet facts, tagged for sourcing in step 4.",
    },
    {
      key: "drafter",
      title: "Drafter",
      body: "Writes each section in your Voice DNA. Produces the canonical draft.",
    },
    {
      key: "editor",
      title: "Editor",
      body: "One revise pass for clarity and voice consistency. Headings preserved.",
    },
    {
      key: "fact_checker",
      title: "Fact-checker",
      body: "Flags load-bearing claims missing a citation. Hands off to grounding.",
    },
  ]
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="Wedge 03 · Multi-agent pipeline"
        title="Five specialist agents, one inspectable run."
        body="A button generates a full draft — but every intermediate artifact is yours to read, rewind, or re-run. No black box."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, idx) => (
          <div
            key={step.key}
            className="relative rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-xs font-mono uppercase tracking-wide text-blue-600">
              step {idx + 1}
            </div>
            <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{step.body}</p>
            {idx < steps.length - 1 && (
              <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 lg:block" />
            )}
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
        Each step's JSON artifact persists on the <span className="font-mono">DraftPipeline</span>{" "}
        row. Click "Inspect artifacts" in the editor to read the planner's outline, the researcher's
        bullets, or the editor's revision diff.
      </p>
    </section>
  )
}

// ────────────────────────────────────────────────────────── wedge: repurpose

function WedgeRepurpose() {
  const channels = [
    { name: "Twitter / X", shape: "5-9 numbered tweets, ≤270 chars" },
    { name: "LinkedIn", shape: "1100-1500 chars, hook + one question" },
    { name: "Substack", shape: "Subject + 300-450 word body + sign-off" },
    { name: "Email", shape: "Subject + 150-220 word body + CTA" },
    { name: "Ad copy", shape: "Headline + subhead + CTA" },
  ]
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Wedge 04 · Cross-platform repurpose"
          title="One draft. Five channels. Same voice."
          body="Compress the canonical document into platform-shaped copy. Constraints live in the system prompt; your Voice DNA still applies."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {channels.map((c) => (
            <div
              key={c.name}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex items-center gap-2 text-blue-600">
                <Share2 className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">channel</span>
              </div>
              <h3 className="mt-1 text-base font-semibold">{c.name}</h3>
              <p className="mt-2 font-mono text-xs text-slate-500">{c.shape}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────── full feature grid

function FeatureGrid() {
  const features = [
    {
      icon: FileText,
      title: "Distraction-free editor",
      body: "Title + body with debounced autosave and per-save revision history.",
    },
    {
      icon: Timer,
      title: "Focus mode + writing sprints",
      body: "Full-width typography, 10/25-minute timers, live word-target progress.",
    },
    {
      icon: Bot,
      title: "Style-constrained Copilot",
      body: "Ollama-first, OpenRouter fallback, deterministic mock when offline.",
    },
    {
      icon: Target,
      title: "Voice-match score",
      body: "Live 0-100 score per paragraph against the active brand profile.",
    },
    {
      icon: ScanLine,
      title: "Readability scorecard",
      body: "Flesch reading ease, FK grade, long-sentence ratio. Updates as you type.",
    },
    {
      icon: ShieldCheck,
      title: "AI-detection self-check",
      body: "5-axis heuristic — burstiness, lexical diversity, starter variety — with actionable nudges.",
    },
    {
      icon: Sparkles,
      title: "A/B headlines",
      body: "5 ranked variants by length, specificity, curiosity, and voice fit.",
    },
    {
      icon: Globe2,
      title: "Translate + cultural review",
      body: "12 target languages plus flags for US-specific references that need localization.",
    },
    {
      icon: Layers,
      title: "Multi-format export",
      body: "Markdown / HTML / DOCX, generated server-side. One click each.",
    },
    {
      icon: ClipboardCheck,
      title: "Eval scorecard (A-D)",
      body: "Combines voice match, readability, citation density, and unsupported claims.",
    },
    {
      icon: Users,
      title: "Live presence",
      body: "WebSocket roster — Yjs-compatible binary relay backbone for real-time CRDT.",
    },
    {
      icon: BarChart3,
      title: "Inference analytics",
      body: "Cost, latency p95, accept rate, per-provider breakdown — every Copilot call logged.",
    },
  ]
  return (
    <section id="features" className="border-y border-slate-200/70 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="The rest of the surface"
          title="Twelve more features ride on top of the wedges."
          body="Everything you'd expect from a serious writing tool — built around the four wedges, not bolted on after."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────── tech depth

function TechDepth() {
  const items = [
    {
      icon: Cpu,
      title: "Three-tier inference",
      body: "Ollama (local, free) → OpenRouter (cloud, paid) → deterministic mock (offline demo). One client surface.",
    },
    {
      icon: ShieldCheck,
      title: "Local-first by default",
      body: "Default model server is your laptop. Cost is $0 unless you opt into the cloud fallback.",
    },
    {
      icon: Workflow,
      title: "pgvector-shaped storage",
      body: "Embeddings persist as fixed-length JSON arrays. Swap the column to pgvector in production — no schema rework.",
    },
    {
      icon: BarChart3,
      title: "Telemetry-driven flywheel",
      body: "Every accept/reject is logged with provider, model, latency, cost, and voice-match score. Fine-tuning fuel.",
    },
  ]
  return (
    <section id="tech" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="Under the hood"
        title="Built like infrastructure, not a prompt wrapper."
        body="FastAPI + SQLAlchemy 2.0 async + Next.js 14 App Router. 79 backend tests run on every push."
        align="center"
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <Icon className="h-5 w-5 text-blue-600" />
            <h3 className="mt-3 text-sm font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ──────────────────────────────────────────────────────────────── final CTA

function FinalCta() {
  return (
    <section className="bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
        <Eyebrow>
          <Sparkles className="h-3.5 w-3.5" />
          Ready when you are
        </Eyebrow>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ship drafts that sound like you.
        </h2>
        <p className="max-w-xl text-slate-300">
          No signup. The app boots on SQLite, talks to a local Ollama if you have one running, and
          falls back to a deterministic mock otherwise. Open it and start writing.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Open the app
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────── footer

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded bg-slate-900 text-white">
            <Fingerprint className="h-3 w-3" />
          </span>
          <span className="font-medium text-slate-700">DClaw Write</span>
          <span>· part of the DClaw Stack</span>
        </div>
        <div className="flex gap-4">
          <span>Code manager: Tharuni Dayara</span>
          <a
            href="mailto:tharunidayara@gmail.com"
            className="hover:text-slate-700"
          >
            tharunidayara@gmail.com
          </a>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────── shared row helper

function FeatureRow({
  icon: Icon,
  title,
  body,
  tone = "light",
}: {
  icon: typeof Sparkles
  title: string
  body: string
  tone?: "light" | "dark"
}) {
  const titleClass = tone === "dark" ? "text-white" : "text-slate-900"
  const bodyClass = tone === "dark" ? "text-slate-300" : "text-slate-600"
  const iconClass =
    tone === "dark"
      ? "bg-slate-800 text-blue-300"
      : "bg-blue-50 text-blue-600"
  return (
    <div className="flex gap-4">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className={`text-base font-semibold ${titleClass}`}>{title}</h3>
        <p className={`mt-1 text-sm leading-relaxed ${bodyClass}`}>{body}</p>
      </div>
    </div>
  )
}
