"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RichEditor, EditorHandle } from "./editor/RichEditor";

type BrandProfile = { id: string; name: string };
type GroundResult = {
  coverage: number;
  unsupported: number;
  canPublish: boolean;
  claims: { claim: string; supported: boolean; confidence: number; quote: string | null }[];
};

export function Editor({ documentId = null }: { documentId?: string | null }) {
  const [title, setTitle] = useState("Untitled");
  const [text, setText] = useState("");
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [brandProfileId, setBrandProfileId] = useState<string>("");
  const [voiceMatch, setVoiceMatch] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [sources, setSources] = useState("");
  const [grounding, setGrounding] = useState<GroundResult | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [docId, setDocId] = useState<string | null>(documentId);
  const lastAiText = useRef<string>("");
  const handle = useRef<EditorHandle | null>(null);

  useEffect(() => {
    fetch("/api/brand-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.items ?? []))
      .catch(() => {});
  }, []);

  // Load an existing document when opened with ?id=.
  useEffect(() => {
    if (!documentId) return;
    let tries = 0;
    const load = async () => {
      try {
        const d = await (await fetch(`/api/documents/${documentId}`)).json();
        if (d?.id) {
          setTitle(d.title ?? "Untitled");
          setBrandProfileId(d.brandProfileId ?? "");
          // Wait for the editor handle to register before injecting content.
          if (handle.current) handle.current.setText(d.content ?? "");
          else if (tries++ < 20) setTimeout(load, 100);
        }
      } catch {}
    };
    load();
  }, [documentId]);

  // Debounced live voice-match score.
  useEffect(() => {
    if (!brandProfileId || text.trim().length < 40) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/brand-profiles/${brandProfileId}/voice-match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const d = await r.json();
        if (typeof d.score === "number") setVoiceMatch(d.score);
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [text, brandProfileId]);

  const ensureDoc = useCallback(async (): Promise<string> => {
    if (docId) return docId;
    const r = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, brandProfileId: brandProfileId || null, content: text }),
    });
    const d = await r.json();
    setDocId(d.id);
    return d.id;
  }, [docId, title, brandProfileId, text]);

  async function continueInVoice() {
    if (!handle.current) return;
    setStreaming(true);
    lastAiText.current = "";
    const prompt = handle.current.getText();
    handle.current.append(" ");
    try {
      const r = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, brandProfileId: brandProfileId || null }),
      });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        lastAiText.current += chunk;
        handle.current.append(chunk);
      }
    } catch (e) {
      handle.current.append(`\n[generation error: ${(e as Error).message}]`);
    } finally {
      setStreaming(false);
    }
  }

  // Capture how the user changed the last AI output (the moat).
  async function captureEditOnBlur() {
    const ai = lastAiText.current.trim();
    if (!ai) return;
    const current = handle.current?.getText() ?? text;
    if (current.includes(ai)) return; // unchanged
    try {
      await fetch("/api/ai/edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiText: ai,
          finalText: current,
          documentId: docId,
          brandProfileId: brandProfileId || null,
        }),
      });
      lastAiText.current = "";
    } catch {}
  }

  async function save() {
    const id = await ensureDoc();
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content: handle.current?.getText() ?? text,
        brandProfileId: brandProfileId || null,
        voiceMatch,
      }),
    });
  }

  async function checkGrounding() {
    const id = await ensureDoc();
    const content = handle.current?.getText() ?? text;
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (sources.trim()) {
      await fetch(`/api/documents/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sources, origin: "paste" }),
      });
    }
    const r = await fetch(`/api/documents/${id}/ground`, { method: "POST" });
    const result: GroundResult = await r.json();
    setGrounding(result);
    setUnsupported(result.claims?.filter((c) => !c.supported).map((c) => c.claim) ?? []);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_320px]">
      <div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold outline-none"
        />
        <div className="mt-4">
          <RichEditor
            onTextChange={setText}
            onBlur={captureEditOnBlur}
            unsupported={unsupported}
            registerHandle={(h) => (handle.current = h)}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={continueInVoice}
            disabled={streaming}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {streaming ? "Writing…" : "Continue in my voice"}
          </button>
          <button
            onClick={checkGrounding}
            className="rounded-lg border border-white/15 px-4 py-2 font-medium hover:bg-white/5"
          >
            Check grounding
          </button>
          <button
            onClick={save}
            className="rounded-lg border border-white/15 px-4 py-2 font-medium hover:bg-white/5"
          >
            Save
          </button>
          <span className="text-sm text-[var(--muted)]">
            {text.trim().split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </div>

      <aside className="space-y-5">
        <Panel title="Brand voice">
          <select
            value={brandProfileId}
            onChange={(e) => setBrandProfileId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[var(--panel)] p-2"
          >
            <option value="">No voice</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {voiceMatch !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Voice match</span>
                <span className="font-semibold">{voiceMatch}/100</span>
              </div>
              <div className="mt-1 h-2 rounded bg-white/10">
                <div className="h-2 rounded bg-brand" style={{ width: `${voiceMatch}%` }} />
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Sources">
          <textarea
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            placeholder="Paste reference material here. Every claim will be checked against it."
            className="h-32 w-full resize-none rounded-lg border border-white/10 bg-[var(--panel)] p-2 text-sm outline-none"
          />
        </Panel>

        {grounding && (
          <Panel title="Grounding">
            <p className="text-sm">
              Coverage: <b>{Math.round(grounding.coverage * 100)}%</b> · {grounding.unsupported}{" "}
              unsupported
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                grounding.canPublish ? "text-green-400" : "text-amber-400"
              }`}
            >
              {grounding.canPublish ? "✓ Safe to publish" : "✗ Blocked — unsupported claims"}
            </p>
            <ul className="mt-3 space-y-2">
              {grounding.claims
                .filter((c) => !c.supported)
                .slice(0, 6)
                .map((c, i) => (
                  <li key={i} className="text-xs text-amber-300">
                    ⚠ {c.claim}
                  </li>
                ))}
            </ul>
          </Panel>
        )}
      </aside>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel)]/50 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </div>
  );
}
