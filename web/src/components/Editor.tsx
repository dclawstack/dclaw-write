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
  const [attachedSources, setAttachedSources] = useState<{ id: string; title: string | null; text: string; origin?: string }[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [grounding, setGrounding] = useState<GroundResult | null>(null);
  const [groundError, setGroundError] = useState<string>("");
  const [groundingBusy, setGroundingBusy] = useState(false);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [docId, setDocId] = useState<string | null>(documentId);
  const lastAiText = useRef<string>("");
  const handle = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/brand-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.items ?? []))
      .catch(() => {});
  }, []);

  const loadSources = useCallback(async (id: string) => {
    try {
      const d = await (await fetch(`/api/documents/${id}/sources`)).json();
      setAttachedSources(d.items ?? []);
    } catch {}
  }, []);

  // Load an existing document (and its sources) when opened with ?id=.
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
    loadSources(documentId);
  }, [documentId, loadSources]);

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

  async function addSource() {
    if (!sources.trim()) return;
    setAddingSource(true);
    try {
      const id = await ensureDoc();
      await fetch(`/api/documents/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sources, origin: "paste" }),
      });
      setSources("");
      await loadSources(id);
    } finally {
      setAddingSource(false);
    }
  }

  async function deleteSource(sourceId: string) {
    // optimistic removal
    setAttachedSources((prev) => prev.filter((s) => s.id !== sourceId));
    try {
      await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    } catch {
      if (docId) loadSources(docId); // re-sync on failure
    }
  }

  const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?|rtf|log|tsv|xml|yaml|yml)$/i;
  const DOC_EXT = /\.(pdf|docx)$/i;

  // Returns extracted text, or null if the file type is unsupported.
  async function extractFileText(file: File): Promise<string | null> {
    if (file.type.startsWith("text") || TEXT_EXT.test(file.name)) {
      return (await file.text()).slice(0, 200_000);
    }
    if (DOC_EXT.test(file.name)) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/parse", { method: "POST", body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.text) throw new Error(d?.error || `Couldn't read ${file.name}`);
      return d.text as string;
    }
    return null;
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploadError("");
    setAddingSource(true);
    try {
      const id = await ensureDoc();
      const unsupported: string[] = [];
      const failed: string[] = [];
      for (const file of list) {
        let content: string | null;
        try {
          content = await extractFileText(file);
        } catch {
          failed.push(file.name);
          continue;
        }
        if (content === null) {
          unsupported.push(file.name);
          continue;
        }
        if (!content.trim()) {
          failed.push(file.name);
          continue;
        }
        await fetch(`/api/documents/${id}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content, title: file.name, origin: "upload" }),
        });
      }
      await loadSources(id);
      const msgs: string[] = [];
      if (unsupported.length) msgs.push(`Unsupported: ${unsupported.join(", ")}`);
      if (failed.length) msgs.push(`Couldn't read: ${failed.join(", ")}`);
      setUploadError(msgs.join(" · "));
    } finally {
      setAddingSource(false);
    }
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
      setSources("");
      await loadSources(id);
    }
    setGroundError("");
    setGroundingBusy(true);
    try {
      const r = await fetch(`/api/documents/${id}/ground`, { method: "POST" });
      const result = await r.json();
      if (!r.ok || !Array.isArray(result?.claims)) {
        setGrounding(null);
        setUnsupported([]);
        setGroundError(
          result?.error ?? "Couldn't check grounding. Add sources, then try again.",
        );
        return;
      }
      setGrounding(result as GroundResult);
      setUnsupported(result.claims.filter((c: { supported: boolean }) => !c.supported).map((c: { claim: string }) => c.claim));
    } catch (e) {
      setGrounding(null);
      setGroundError((e as Error).message || "Grounding request failed.");
    } finally {
      setGroundingBusy(false);
    }
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

        <Panel title={`Sources${attachedSources.length ? ` (${attachedSources.length})` : ""}`}>
          {/* Drag & drop / browse upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              uploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border border-dashed p-4 text-center text-xs transition ${
              dragging
                ? "border-brand bg-brand/10 text-white"
                : "border-white/15 text-[var(--muted)] hover:border-white/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,.log,.tsv,.xml,.yaml,.yml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="text-lg">⬆</div>
            <div className="mt-1 font-medium">
              {dragging ? "Drop files to upload" : "Drag & drop files, or click to browse"}
            </div>
            <div className="mt-0.5 opacity-70">PDF, Word (.docx), or text — .pdf, .docx, .txt, .md, …</div>
          </div>

          {uploadError && <p className="mt-2 text-xs text-amber-300">{uploadError}</p>}

          {/* Attached sources with delete */}
          {attachedSources.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {attachedSources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs"
                >
                  <span className="truncate" title={s.text}>
                    {s.origin === "upload" ? "📎" : "📄"}{" "}
                    {s.title || s.text.slice(0, 48) + "…"}
                  </span>
                  <button
                    onClick={() => deleteSource(s.id)}
                    aria-label="Delete source"
                    title="Delete source"
                    className="ml-auto flex-none rounded px-1.5 py-0.5 text-[var(--muted)] hover:bg-red-500/15 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Or paste text */}
          <textarea
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            placeholder="…or paste reference text (Cmd/Ctrl+V), then Add."
            className="mt-3 h-24 w-full resize-none rounded-lg border border-white/10 bg-[var(--panel)] p-2 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={addSource}
            disabled={addingSource || !sources.trim()}
            className="mt-2 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-40"
          >
            {addingSource ? "Adding…" : "Add pasted text"}
          </button>
          {attachedSources.length === 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Add at least one source before checking grounding.
            </p>
          )}
        </Panel>

        {groundingBusy && (
          <Panel title="Grounding">
            <p className="text-sm text-[var(--muted)]">Checking claims against sources…</p>
          </Panel>
        )}

        {!groundingBusy && groundError && (
          <Panel title="Grounding">
            <p className="text-sm text-amber-300">{groundError}</p>
          </Panel>
        )}

        {!groundingBusy && grounding && Array.isArray(grounding.claims) && (
          <Panel title="Grounding">
            <p className="text-sm">
              Coverage: <b>{Math.round((grounding.coverage ?? 0) * 100)}%</b> ·{" "}
              {grounding.unsupported ?? 0} unsupported
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
