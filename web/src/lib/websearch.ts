// Optional web-search ingestion for citation grounding. Uses Tavily or Brave if
// a key is present; otherwise returns []. Lets grounding check claims against the
// live web, not just pasted sources.

export type WebSource = { title: string; url: string; text: string };

export function webSearchEnabled(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_API_KEY);
}

export async function webSearch(query: string, limit = 5): Promise<WebSource[]> {
  if (process.env.TAVILY_API_KEY) return tavily(query, limit);
  if (process.env.BRAVE_API_KEY) return brave(query, limit);
  return [];
}

async function tavily(query: string, limit: number): Promise<WebSource[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: limit,
      include_raw_content: true,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: Record<string, string>) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    text: r.raw_content || r.content || "",
  }));
}

async function brave(query: string, limit: number): Promise<WebSource[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
    { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY ?? "" } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.web?.results ?? []).map((r: Record<string, string>) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    text: r.description ?? "",
  }));
}
