import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-sm font-medium text-brand">DClaw Write</p>
      <h1 className="mt-3 text-5xl font-bold leading-tight">
        Your brand voice.
        <br />
        Every claim cited.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
        Generate publish-ready content in your team&apos;s exact voice — with every
        factual claim backed by a real source. The longer you use it, the more it
        sounds like you.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/documents"
          className="rounded-lg bg-brand px-5 py-3 font-medium text-white hover:opacity-90"
        >
          Open workspace
        </Link>
        <Link
          href="/brand"
          className="rounded-lg border border-white/15 px-5 py-3 font-medium hover:bg-white/5"
        >
          Set up brand voice
        </Link>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {[
          ["Voice DNA", "Learns your style from samples and enforces it on every word."],
          ["Citation grounding", "No unsupported claim can be published. Trust, by default."],
          ["Consensus AI", "Multiple models cross-check each other, picked for token efficiency."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-white/10 bg-[var(--panel)] p-5">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
