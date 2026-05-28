const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(`API error ${response.status}: ${error}`, response.status);
  }
  return response.json();
}

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectList = {
  items: Project[];
  total: number;
};

export type Document = {
  id: string;
  project_id: string;
  title: string;
  content_type: string;
  status: string;
  content: string;
  word_count: number;
  reading_time_seconds: number;
  created_at: string;
  updated_at: string;
};

export type DocumentList = {
  items: Document[];
  total: number;
};

export type Revision = {
  id: string;
  document_id: string;
  word_count: number;
  created_at: string;
};

export async function getHealth() {
  return fetchJson<{ status: string }>("/health/");
}

export function listProjects() {
  return fetchJson<ProjectList>("/api/v1/projects");
}

export function createProject(input: { name: string; description?: string | null }) {
  return fetchJson<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string) {
  return fetchJson<void>(`/api/v1/projects/${id}`, { method: "DELETE" });
}

export function listDocuments(projectId?: string) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return fetchJson<DocumentList>(`/api/v1/documents${qs}`);
}

export function getDocument(id: string) {
  return fetchJson<Document>(`/api/v1/documents/${id}`);
}

export function createDocument(input: {
  project_id: string;
  title?: string;
  content_type?: string;
  content?: string;
}) {
  return fetchJson<Document>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDocument(
  id: string,
  patch: Partial<Pick<Document, "title" | "content" | "content_type" | "status">>,
) {
  return fetchJson<Document>(`/api/v1/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteDocument(id: string) {
  return fetchJson<void>(`/api/v1/documents/${id}`, { method: "DELETE" });
}

export function listRevisions(documentId: string) {
  return fetchJson<Revision[]>(`/api/v1/documents/${documentId}/revisions`);
}

// ────────────────────────────────────────────────────────── brand profiles

export type BrandProfile = {
  id: string;
  name: string;
  description: string | null;
  sample_count: number;
  total_tokens: number;
  style_features: Record<string, number>;
  bigram_signature: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type BrandProfileList = {
  items: BrandProfile[];
  total: number;
};

export type VoiceSample = {
  id: string;
  brand_profile_id: string;
  label: string | null;
  source_url: string | null;
  word_count: number;
  created_at: string;
};

export function listBrandProfiles() {
  return fetchJson<BrandProfileList>("/api/v1/brand-profiles");
}

export function createBrandProfile(input: { name: string; description?: string | null }) {
  return fetchJson<BrandProfile>("/api/v1/brand-profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBrandProfile(id: string) {
  return fetchJson<BrandProfile>(`/api/v1/brand-profiles/${id}`);
}

export function deleteBrandProfile(id: string) {
  return fetchJson<void>(`/api/v1/brand-profiles/${id}`, { method: "DELETE" });
}

export function addVoiceSample(
  id: string,
  input: { text: string; label?: string | null; source_url?: string | null },
) {
  return fetchJson<BrandProfile>(`/api/v1/brand-profiles/${id}/samples`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listVoiceSamples(id: string) {
  return fetchJson<VoiceSample[]>(`/api/v1/brand-profiles/${id}/samples`);
}

export function voiceMatch(id: string, text: string) {
  return fetchJson<{ score: number; sample_features: Record<string, number> }>(
    `/api/v1/brand-profiles/${id}/voice-match`,
    { method: "POST", body: JSON.stringify({ text }) },
  );
}

// ───────────────────────────────────────────────────────────────────── ai

export type CompletionResponse = {
  suggestion_id: string;
  text: string;
  provider: string;
  model: string;
  latency_ms: number;
  voice_match_score: number | null;
};

export type ReadabilityResponse = {
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  sentences: number;
  words: number;
  syllables: number;
  mean_sentence_length: number;
  long_sentence_ratio: number;
};

export function aiComplete(input: {
  document_id?: string;
  brand_profile_id?: string;
  prompt: string;
  instruction?: string;
  max_tokens?: number;
  temperature?: number;
}) {
  return fetchJson<CompletionResponse>("/api/v1/ai/complete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function aiFeedback(suggestionId: string, accepted: boolean) {
  return fetchJson<void>(`/api/v1/ai/suggestions/${suggestionId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ accepted }),
  });
}

export function aiReadability(text: string) {
  return fetchJson<ReadabilityResponse>("/api/v1/ai/readability", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ─────────────────────────────────────────────────────────────── citations

export type Citation = {
  id: string;
  document_id: string;
  paragraph_index: number | null;
  claim: string;
  source_url: string;
  source_title: string | null;
  source_snippet: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export function listCitations(documentId: string) {
  return fetchJson<Citation[]>(`/api/v1/documents/${documentId}/citations`);
}

export function createCitation(
  documentId: string,
  input: {
    claim: string;
    source_url: string;
    source_title?: string;
    source_snippet?: string;
    paragraph_index?: number;
  },
) {
  return fetchJson<Citation>(`/api/v1/documents/${documentId}/citations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCitation(citationId: string, patch: Partial<Citation>) {
  return fetchJson<Citation>(`/api/v1/citations/${citationId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteCitation(citationId: string) {
  return fetchJson<void>(`/api/v1/citations/${citationId}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────────── multi-agent pipeline

export type PipelineRun = {
  id: string;
  document_id: string | null;
  brand_profile_id: string | null;
  topic: string;
  instruction: string | null;
  status: string;
  current_step: string | null;
  artifacts: Record<string, unknown>;
  final_draft: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function runPipeline(input: {
  topic: string;
  document_id?: string;
  brand_profile_id?: string;
  instruction?: string;
}) {
  return fetchJson<PipelineRun>("/api/v1/pipelines", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPipeline(id: string) {
  return fetchJson<PipelineRun>(`/api/v1/pipelines/${id}`);
}

// ─────────────────────────────────────────────────────────────────── eval

export type EvalReport = {
  word_count: number;
  voice_match_score: number | null;
  readability: {
    flesch_reading_ease: number;
    flesch_kincaid_grade: number;
    sentences: number;
    words: number;
    syllables: number;
    mean_sentence_length: number;
    long_sentence_ratio: number;
  };
  citation_density: number;
  verified_citation_ratio: number;
  total_citations: number;
  verified_citations: number;
  claims_needing_sources: number;
  grade: string;
};

export function evalDocument(documentId: string, brandProfileId?: string) {
  return fetchJson<EvalReport>(`/api/v1/documents/${documentId}/eval`, {
    method: "POST",
    body: JSON.stringify({ brand_profile_id: brandProfileId }),
  });
}

// ────────────────────────────────────────────────────────── export helpers

export function exportDocumentUrl(documentId: string, format: "md" | "html" | "docx") {
  return `${API_BASE}/api/v1/documents/${documentId}/export?format=${format}`;
}

// ─────────────────────────────────────────────── citation grounding (2.2)

export type GroundedSource = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  support_score: number;
  verified: boolean;
};

export function groundClaim(input: {
  claim: string;
  max_results?: number;
  accept_threshold?: number;
}) {
  return fetchJson<{ claim: string; sources: GroundedSource[] }>(
    "/api/v1/search/ground",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function autoGroundDocument(
  documentId: string,
  input: { accept_threshold?: number; max_claims?: number } = {},
) {
  return fetchJson<{
    document_id: string;
    created_citation_ids: string[];
    skipped_sentences: number;
  }>(`/api/v1/documents/${documentId}/ground`, {
    method: "POST",
    body: JSON.stringify({ ...input }),
  });
}

// ─────────────────────────────────────────────── repurposing (2.4)

export type RepurposeResponse = {
  platform: string;
  platform_name: string;
  text: string;
  provider: string;
  model: string;
  latency_ms: number;
};

export type PlatformInfo = { key: string; name: string };

export function listPlatforms() {
  return fetchJson<PlatformInfo[]>("/api/v1/search/platforms");
}

export function repurposeDocument(
  documentId: string,
  input: { platform: string; brand_profile_id?: string; instruction?: string },
) {
  return fetchJson<RepurposeResponse>(
    `/api/v1/documents/${documentId}/repurpose`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

// ─────────────────────────────────────────────── semantic + voice (2.3)

export function embedDocument(documentId: string) {
  return fetchJson<{
    entity_type: string;
    entity_id: string;
    purpose: string;
    model: string;
    dim: number;
  }>(`/api/v1/documents/${documentId}/embed`, { method: "POST" });
}

export type SemanticHit = { document_id: string; title: string; score: number };

export function semanticSearch(query: string, k = 5) {
  return fetchJson<{ results: SemanticHit[] }>("/api/v1/search/semantic", {
    method: "POST",
    body: JSON.stringify({ query, k }),
  });
}

export function voiceNeighbors(profileId: string) {
  return fetchJson<{
    profile_id: string;
    neighbors: { brand_profile_id: string; name: string; similarity: number }[];
  }>(`/api/v1/search/voice-neighbors/${profileId}`);
}

// ─────────────────────────────────────────────── ai-detection (2.6)

export type DetectionReport = {
  score: number;
  label: string;
  burstiness: number;
  lexical_diversity: number;
  punctuation_variety: number;
  starter_diversity: number;
  rare_word_share: number;
  suggestions: string[];
};

export function aiDetection(text: string) {
  return fetchJson<DetectionReport>("/api/v1/ai/detection", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ─────────────────────────────────────────────── headlines (2.8)

export type HeadlineVariant = {
  headline: string;
  score: number;
  length_score: number;
  specificity_score: number;
  curiosity_score: number;
  voice_match_score: number;
  provider: string;
  model: string;
};

export function generateHeadlines(input: {
  topic: string;
  body?: string;
  n?: number;
  brand_profile_id?: string;
}) {
  return fetchJson<{ variants: HeadlineVariant[] }>("/api/v1/ai/headlines", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─────────────────────────────────────────────── translate (2.9)

export type LanguageOption = { code: string; name: string };

export type CulturalFinding = {
  match: string;
  category: string;
  suggestion: string;
  position: string;
};

export type TranslationResponse = {
  target_language: string;
  language_name: string;
  text: string;
  provider: string;
  model: string;
  latency_ms: number;
  cultural_review: CulturalFinding[];
};

export function listLanguages() {
  return fetchJson<LanguageOption[]>("/api/v1/ai/languages");
}

export function translateText(input: {
  text: string;
  target_language: string;
  brand_profile_id?: string;
}) {
  return fetchJson<TranslationResponse>("/api/v1/ai/translate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─────────────────────────────────────────────── analytics (2.10)

export type ProviderRow = {
  provider: string;
  completions: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_voice_match: number | null;
  estimated_cost_cents: number;
};

export type DashboardResponse = {
  total_completions: number;
  accepted: number;
  rejected: number;
  pending: number;
  accept_rate: number | null;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_voice_match: number | null;
  estimated_cost_cents: number;
  providers: ProviderRow[];
  recent: {
    created_at: string;
    provider: string;
    model: string;
    latency_ms: number;
    voice_match_score: number | null;
    accepted: boolean | null;
  }[];
};

export function fetchDashboard() {
  return fetchJson<DashboardResponse>("/api/v1/analytics/dashboard");
}

// ─────────────────────────────────────────────── collab (2.7)

export function collabSocketUrl(documentId: string, user: string, color = "#3B82F6"): string {
  const base = API_BASE.replace(/^http/, "ws");
  const params = new URLSearchParams({ user, color });
  return `${base}/api/v1/collab/${documentId}?${params.toString()}`;
}

// ───────────────────────────────── demo seed/clear (remove with dev router)

export type DemoStatus = {
  counts: Record<string, number>;
  is_empty: boolean;
  message?: string;
};

export function demoStatus() {
  return fetchJson<DemoStatus>("/api/v1/dev/status");
}

export function demoSeed() {
  return fetchJson<DemoStatus>("/api/v1/dev/seed", { method: "POST" });
}

export function demoClear() {
  return fetchJson<DemoStatus>("/api/v1/dev/clear", { method: "POST" });
}

export { ApiError };
