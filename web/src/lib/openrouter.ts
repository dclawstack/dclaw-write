// Thin OpenRouter client (OpenAI-compatible). All LLM traffic goes through here.

const BASE = "https://openrouter.ai/api/v1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompletionResult = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

function key(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is not set");
  return k;
}

function headers() {
  return {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://dclaw-write.vercel.app",
    "X-Title": "DClaw Write",
  };
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<CompletionResult> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${model} failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

// Streaming chat — yields text chunks.
export async function* chatStream(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter stream ${model} failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
}

export async function embed(
  text: string,
  model = "openai/text-embedding-3-small",
): Promise<{ vector: number[]; model: string }> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter embed failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { vector: data.data?.[0]?.embedding ?? [], model };
}
