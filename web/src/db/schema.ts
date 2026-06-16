import {
  pgSchema,
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  vector,
  index,
} from "drizzle-orm/pg-core";

// Embedding dimension. text-embedding-3-small / many OpenRouter embed models = 1536.
export const EMBEDDING_DIM = 1536;

// ---------------------------------------------------------------------------
// Brand Voice DNA
// ---------------------------------------------------------------------------
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  sampleCount: integer("sample_count").notNull().default(0),
  totalWords: integer("total_words").notNull().default(0),
  // Statistical style fingerprint (mean sentence length, ttr, densities, etc.)
  styleFeatures: jsonb("style_features").notNull().default({}),
  // Top word-pair signature { "the work": 0.012, ... }
  bigramSignature: jsonb("bigram_signature").notNull().default({}),
  // Semantic centroid of the brand's writing (averaged sample embeddings).
  voiceEmbedding: vector("voice_embedding", { dimensions: EMBEDDING_DIM }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const voiceSamples = pgTable("voice_samples", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandProfileId: uuid("brand_profile_id")
    .notNull()
    .references(() => brandProfiles.id, { onDelete: "cascade" }),
  label: text("label"),
  sourceUrl: text("source_url"),
  text: text("text").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled"),
  content: text("content").notNull().default(""),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  // Live voice-match score (0..100) of current content vs brand profile.
  voiceMatch: integer("voice_match"),
  status: text("status").notNull().default("draft"), // draft | grounded | published
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// MOAT: edit-capture loop. Every time a user edits AI output, we keep the
// before/after so each brand's voice model sharpens with use. Proprietary data.
// ---------------------------------------------------------------------------
export const aiEdits = pgTable("ai_edits", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  aiText: text("ai_text").notNull(), // what the model produced
  finalText: text("final_text").notNull(), // what the user kept
  // voice-match deltas + edit distance, for measuring drift the model should learn.
  metrics: jsonb("metrics").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Citation grounding
// ---------------------------------------------------------------------------
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  title: text("title"),
  url: text("url"),
  origin: text("origin").notNull().default("paste"), // paste | upload | web
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const citations = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").references(() => sources.id, {
    onDelete: "set null",
  }),
  claim: text("claim").notNull(), // the sentence/paragraph being supported
  quote: text("quote"), // supporting excerpt from the source
  // grounding confidence 0..1; below threshold => flagged as unsupported.
  confidence: real("confidence").notNull().default(0),
  supported: boolean("supported").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Embeddings (pgvector) — generic store for source chunks + voice samples.
// ---------------------------------------------------------------------------
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // source_chunk | voice_sample | brand_profile
    entityId: uuid("entity_id").notNull(),
    chunk: text("chunk").notNull(),
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    embIdx: index("embeddings_vec_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  }),
);

// ---------------------------------------------------------------------------
// Consensus AI generation log — feeds token-efficiency metrics + routing.
// ---------------------------------------------------------------------------
export const generations = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  task: text("task").notNull(), // complete | headline | ground | repurpose ...
  models: jsonb("models").notNull().default([]), // models consulted
  chosenModel: text("chosen_model"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  agreement: real("agreement"), // consensus agreement score 0..1
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// _meta schema: roadmap/progress tracking (mirrors ROADMAP.md into the DB).
// ---------------------------------------------------------------------------
export const meta = pgSchema("_meta");

export const progress = meta.table("progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestone: text("milestone").notNull(), // M0..M5
  task: text("task").notNull(),
  status: text("status").notNull().default("todo"), // todo | in_progress | done | blocked
  detail: text("detail"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const metrics = meta.table("metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  value: real("value").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});
