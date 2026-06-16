"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Doc = {
  id: string;
  title: string;
  status: string;
  voiceMatch: number | null;
  updatedAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "text-[var(--muted)]",
  grounded: "text-green-400",
  published: "text-brand",
};

export function DocumentsList() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => setDocs(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createDoc() {
    const d = await (
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      })
    ).json();
    router.push(`/editor?id=${d.id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents</h1>
        <button onClick={createDoc} className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
          New document
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-[var(--muted)]">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-8 text-[var(--muted)]">
          No documents yet. Create one, or set up a{" "}
          <Link href="/brand" className="text-brand underline">
            brand voice
          </Link>{" "}
          first.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/editor?id=${d.id}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[var(--panel)] p-4 hover:border-brand"
              >
                <span className="font-medium">{d.title || "Untitled"}</span>
                <span className="flex items-center gap-4 text-sm">
                  {d.voiceMatch !== null && (
                    <span className="text-[var(--muted)]">voice {d.voiceMatch}</span>
                  )}
                  <span className={STATUS_COLOR[d.status] ?? "text-[var(--muted)]"}>
                    {d.status}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
