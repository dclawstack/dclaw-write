"use client";

import { useEffect, useState } from "react";

type Task = { milestone: string; task: string; status: string };
type Data = {
  summary: { total: number; done: number; pct: number };
  milestones: { milestone: string; tasks: Task[] }[];
  error?: string;
  hint?: string;
};

const DOT: Record<string, string> = {
  done: "bg-green-400",
  in_progress: "bg-amber-400",
  blocked: "bg-red-400",
  todo: "bg-white/20",
};

export function ProgressDashboard() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setData({ error: String(e) } as Data));
  }, []);

  if (!data) return <main className="p-10 text-[var(--muted)]">Loading…</main>;

  if (data.error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">Build progress</h1>
        <p className="mt-4 text-amber-400">
          {data.hint ?? data.error} — run <code>npm run db:migrate &amp;&amp; npm run db:seed</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Build progress</h1>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-3 flex-1 rounded bg-white/10">
          <div className="h-3 rounded bg-brand" style={{ width: `${data.summary.pct}%` }} />
        </div>
        <span className="font-semibold">{data.summary.pct}%</span>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {data.summary.done} / {data.summary.total} tasks done
      </p>

      <div className="mt-8 space-y-6">
        {data.milestones.map((m) => (
          <div key={m.milestone}>
            <h2 className="mb-2 font-semibold">{m.milestone}</h2>
            <ul className="space-y-1">
              {m.tasks.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${DOT[t.status] ?? "bg-white/20"}`} />
                  <span className={t.status === "done" ? "text-[var(--muted)] line-through" : ""}>
                    {t.task}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
