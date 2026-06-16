import Link from "next/link";
import { DemoControls } from "@/components/DemoControls"; // DEMO ONLY — remove with api/dev + lib/demo

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <Hero />
      <LogoStrip />
      <FeatureSections />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ Nav */
function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--bg)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">W</span>
          DClaw Write
        </Link>
        <div className="hidden items-center gap-6 text-sm text-[var(--muted)] sm:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <Link href="/progress" className="hover:text-white">Progress</Link>
        </div>
        <Link
          href="/documents"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open app
        </Link>
      </nav>
    </header>
  );
}

/* ----------------------------------------------------------------- Hero */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(59,130,246,0.25), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Live on Vercel · Neon · OpenRouter
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.1] sm:text-6xl">
          Your brand voice.
          <br />
          <span className="bg-gradient-to-r from-brand to-sky-300 bg-clip-text text-transparent">
            Every claim cited.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--muted)]">
          DClaw Write generates publish-ready content in your team&apos;s exact voice — with every
          factual claim backed by a real source. The longer you use it, the more it sounds like you.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/documents"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Open the workspace
          </Link>
          <Link
            href="/brand"
            className="rounded-lg border border-white/15 px-6 py-3 font-semibold hover:bg-white/5"
          >
            Train a brand voice
          </Link>
        </div>

        {/* DEMO ONLY — remove this block (and api/dev + lib/demo) to disable demo seeding */}
        <div className="mx-auto mt-10 max-w-xl text-left">
          <DemoControls />
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  return (
    <div className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-sm text-[var(--muted)]">
        <span>Built for content &amp; marketing teams who care about</span>
        <span className="font-semibold text-white">brand voice</span>
        <span className="font-semibold text-white">factual accuracy</span>
        <span className="font-semibold text-white">speed</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Features */
type Feature = {
  tag: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    tag: "Voice DNA",
    title: "Sounds like you — not like a robot",
    body: "We learn a brand's voice from real writing samples: sentence rhythm, vocabulary, punctuation habits, and a semantic fingerprint. Every generation is constrained to that voice and scored live.",
    points: [
      "Statistical style fingerprint + semantic embedding match",
      "Live voice-match score as you write",
      "Multiple brand voices per workspace",
    ],
    visual: <VoiceMeterVisual />,
  },
  {
    tag: "Citation grounding",
    title: "Never publish an unsupported claim",
    body: "Every factual sentence is checked against your sources. Supported claims get a citation; unsupported ones are underlined inline and block publishing until they're fixed.",
    points: [
      "Claim extraction → retrieval → support check",
      "Inline wavy-underline on unsupported claims",
      "Publish gate: ship only when grounded",
    ],
    visual: <GroundingVisual />,
  },
  {
    tag: "Consensus AI",
    title: "The right model for every task",
    body: "All generation runs through a consensus router over OpenRouter. Trivial tasks use one cheap model; high-stakes tasks consult a panel and a judge picks the best — optimizing quality per token.",
    points: [
      "Task-aware, token-efficient model selection",
      "Cross-check panel + judge for high-stakes tasks",
      "Every call logged with cost, tokens, agreement",
    ],
    visual: <ConsensusVisual />,
  },
  {
    tag: "Learning moat",
    title: "Gets smarter the more you use it",
    body: "Every time you edit the AI's output, we capture the before and after as a learning signal. Each brand's voice sharpens with use — data a competitor can't copy.",
    points: [
      "Edit-capture loop on every correction",
      "Voice drift measured in style space",
      "Your corrections become your advantage",
    ],
    visual: <EditCaptureVisual />,
  },
];

function FeatureSections() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        kicker="What it does"
        title="Three hard problems, solved together"
        sub="Generic AI writing is a commodity. Voice fidelity, factual grounding, and cost-efficient model routing are not."
      />
      <div className="mt-14 space-y-20">
        {FEATURES.map((f, i) => (
          <div
            key={f.tag}
            className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}
          >
            <div>
              <span className="text-sm font-semibold text-brand">{f.tag}</span>
              <h3 className="mt-2 text-3xl font-bold">{f.title}</h3>
              <p className="mt-4 text-[var(--muted)]">{f.body}</p>
              <ul className="mt-6 space-y-2">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check /> <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[var(--panel)] p-6">{f.visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- How it works */
function HowItWorks() {
  const steps = [
    ["Train your voice", "Paste a few writing samples. We extract your brand's Voice DNA in milliseconds."],
    ["Write with the copilot", "Draft in a rich editor and continue in your voice — streamed, on demand."],
    ["Ground every claim", "Add sources. We verify each claim and block publishing on anything unsupported."],
    ["Publish with confidence", "Ship content that sounds like you and stands up to fact-checking."],
  ];
  return (
    <section id="how" className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading kicker="How it works" title="From samples to publish in four steps" />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="rounded-2xl border border-white/10 bg-[var(--panel)] p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 font-bold text-brand">
                {i + 1}
              </div>
              <h4 className="mt-4 font-semibold">{t}</h4>
              <p className="mt-2 text-sm text-[var(--muted)]">{b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="mx-auto max-w-2xl text-4xl font-bold">
        Stop sounding like everyone else.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
        Load the demo data above to explore a fully-populated workspace, or start from a clean slate.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/documents" className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90">
          Open the workspace
        </Link>
        <Link href="/progress" className="rounded-lg border border-white/15 px-6 py-3 font-semibold hover:bg-white/5">
          View build progress
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--muted)] sm:flex-row">
        <span>DClaw Write — your voice, every claim cited.</span>
        <span>Next.js · Neon · OpenRouter</span>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- Helpers */
function SectionHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold text-brand">{kicker}</span>
      <h2 className="mt-2 text-4xl font-bold">{title}</h2>
      {sub && <p className="mt-4 text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-brand" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

/* ----------------------------------------------------------- Mini visuals */
function VoiceMeterVisual() {
  return (
    <div className="space-y-4">
      {[["Statistical match", 33], ["Semantic match", 88], ["Blended voice score", 63]].map(
        ([label, val]) => (
          <div key={label as string}>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">{label}</span>
              <span className="font-semibold">{val}/100</span>
            </div>
            <div className="mt-1 h-2 rounded bg-white/10">
              <div className="h-2 rounded bg-brand" style={{ width: `${val}%` }} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function GroundingVisual() {
  return (
    <div className="space-y-3 text-sm leading-7">
      <p>
        Content marketing is a{" "}
        <span className="rounded bg-green-500/15 px-1 text-green-300">$400B industry</span>.
      </p>
      <p>
        Most teams still{" "}
        <span className="underline decoration-amber-400 decoration-wavy underline-offset-4">
          write everything by hand
        </span>{" "}
        — flagged, no source.
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
        <span>✗</span> 1 unsupported claim — publishing blocked
      </div>
    </div>
  );
}

function ConsensusVisual() {
  const rows = [
    ["headline", "claude-3.5-haiku", "$0.0001"],
    ["complete", "gpt-4o", "$0.0022"],
    ["ground", "panel → sonnet-4", "$0.0075"],
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 text-sm">
      <div className="grid grid-cols-3 bg-white/5 px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
        <span>Task</span><span>Model chosen</span><span className="text-right">Cost</span>
      </div>
      {rows.map(([t, m, c]) => (
        <div key={t} className="grid grid-cols-3 border-t border-white/5 px-3 py-2">
          <span className="text-[var(--muted)]">{t}</span>
          <span className="font-medium">{m}</span>
          <span className="text-right tabular-nums">{c}</span>
        </div>
      ))}
    </div>
  );
}

function EditCaptureVisual() {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="text-xs font-semibold text-[var(--muted)]">AI wrote</div>
        <p className="mt-1 text-[var(--muted)] line-through">
          In today&apos;s fast-paced digital landscape, leveraging AI-powered solutions can
          synergistically enhance your content strategy.
        </p>
      </div>
      <div className="rounded-lg border border-brand/30 bg-brand/[0.06] p-3">
        <div className="text-xs font-semibold text-brand">You kept</div>
        <p className="mt-1">
          AI should make your content sharper, not blander. Use it to move faster — not to sound like
          everyone else.
        </p>
      </div>
      <p className="text-xs text-[var(--muted)]">→ captured as a voice signal (74% style drift)</p>
    </div>
  );
}
