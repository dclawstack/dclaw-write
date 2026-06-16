"use client";

import { useEffect, useState } from "react";

type Profile = {
  id: string;
  name: string;
  sampleCount: number;
  totalWords: number;
};

export function BrandSetup() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState<Profile | null>(null);
  const [sample, setSample] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await (await fetch("/api/brand-profiles")).json();
    setProfiles(d.items ?? []);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function create() {
    if (!name.trim()) return;
    const d = await (
      await fetch("/api/brand-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
    ).json();
    setName("");
    setActive(d);
    await load();
  }

  async function addSample() {
    if (!active || !sample.trim()) return;
    setBusy(true);
    try {
      const d = await (
        await fetch(`/api/brand-profiles/${active.id}/samples`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sample }),
        })
      ).json();
      setActive(d);
      setSample("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Brand voice</h1>
      <p className="mt-2 text-[var(--muted)]">
        Add writing samples. We learn the voice and enforce it on every generation.
      </p>

      <div className="mt-8 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New voice name (e.g. Acme Blog)"
          className="flex-1 rounded-lg border border-white/10 bg-[var(--panel)] p-3 outline-none"
        />
        <button onClick={create} className="rounded-lg bg-brand px-5 font-medium text-white">
          Create
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p)}
            className={`rounded-lg border p-4 text-left ${
              active?.id === p.id ? "border-brand" : "border-white/10"
            } bg-[var(--panel)]`}
          >
            <div className="flex justify-between">
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-[var(--muted)]">
                {p.sampleCount} samples · {p.totalWords} words
              </span>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-8 rounded-xl border border-white/10 bg-[var(--panel)] p-5">
          <h2 className="font-semibold">Add a sample to “{active.name}”</h2>
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            placeholder="Paste a representative piece of writing…"
            className="mt-3 h-40 w-full resize-none rounded-lg border border-white/10 bg-[var(--bg)] p-3 outline-none"
          />
          <button
            onClick={addSample}
            disabled={busy}
            className="mt-3 rounded-lg bg-brand px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Learning…" : "Add & learn"}
          </button>
        </div>
      )}
    </main>
  );
}
