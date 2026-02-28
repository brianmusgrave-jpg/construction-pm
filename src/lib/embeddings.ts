/**
 * @file src/lib/embeddings.ts
 * @description Semantic embedding utilities for Construction PM.
 *
 * Embeddings power semantic search across voice note transcripts, documents,
 * and other text-heavy entities. This module handles:
 *   - Generating embeddings via the OpenAI embeddings API (text-embedding-3-small)
 *   - Storing and retrieving embeddings from the `Embedding` table
 *   - Computing cosine similarity for in-process nearest-neighbour search
 *
 * Vectors are persisted as JSON-encoded float arrays in a `Text` column.
 * This avoids a pgvector dependency and works with any PostgreSQL host.
 * A future migration can replace the JSON column with a native `vector(1536)`
 * column once pgvector is enabled and query volume justifies it.
 *
 * Dimensions: 1536 (text-embedding-3-small). Update EMBEDDING_DIMS if you
 * switch to a different model.
 */

import { db } from "@/lib/db";

// ── Constants ──────────────────────────────────────────────────────────────

/** Dimensionality of the embedding vectors produced by text-embedding-3-small. */
export const EMBEDDING_DIMS = 1536;

/** OpenAI model used for embedding generation. */
const EMBEDDING_MODEL = "text-embedding-3-small";

// ── Types ──────────────────────────────────────────────────────────────────

/** Entity types that can have associated embeddings. */
export type EmbeddingEntityType =
  | "voice_note"
  | "document"
  | "phase"
  | "project"
  | "rfi"
  | "submittal";

/** A stored embedding row, ready for similarity comparisons. */
export interface StoredEmbedding {
  id: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  content: string;
  vector: number[];
}

/** Result from a similarity search — includes the score and source entity. */
export interface SimilarityResult {
  entityType: EmbeddingEntityType;
  entityId: string;
  content: string;
  /** Cosine similarity score in [0, 1]. Higher = more similar. */
  score: number;
}

// ── Embedding generation ──────────────────────────────────────────────────

/**
 * Generate a text embedding vector using the OpenAI embeddings API.
 *
 * Requires `OPENAI_API_KEY` to be set. Returns null (and logs a warning)
 * if the API key is missing or the request fails — callers should treat
 * a null result as "embedding unavailable" and degrade gracefully.
 *
 * @param text - The text to embed. Long texts are truncated server-side.
 * @returns Float array of length EMBEDDING_DIMS, or null on failure
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[embeddings] OPENAI_API_KEY not set — skipping embedding generation");
    return null;
  }

  // Trim whitespace and cap length to avoid unnecessary token spend
  const cleanText = text.trim().slice(0, 8000);
  if (!cleanText) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: cleanText }),
    });

    if (!res.ok) {
      console.warn(`[embeddings] OpenAI ${res.status} — skipping embedding`);
      return null;
    }

    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[embeddings] Failed to generate embedding:", err);
    return null;
  }
}

// ── Storage ────────────────────────────────────────────────────────────────

/**
 * Store or update an embedding for an entity.
 * Uses upsert so callers can safely call this every time text changes.
 *
 * @param entityType - The type of entity (e.g. "voice_note")
 * @param entityId - The primary key of the entity
 * @param content - The text that was embedded
 * @param vector - The embedding vector (float array)
 */
export async function storeEmbedding(
  entityType: EmbeddingEntityType,
  entityId: string,
  content: string,
  vector: number[]
): Promise<void> {
  const dbc = db as any; // Embedding model not in generated Prisma types yet
  await dbc.embedding.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType,
      entityId,
      content,
      vector: JSON.stringify(vector),
    },
    update: {
      content,
      vector: JSON.stringify(vector),
    },
  });
}

/**
 * Delete the embedding for an entity (call when the entity is deleted).
 *
 * @param entityType - The type of entity
 * @param entityId - The primary key of the entity
 */
export async function deleteEmbedding(
  entityType: EmbeddingEntityType,
  entityId: string
): Promise<void> {
  const dbc = db as any;
  await dbc.embedding.deleteMany({
    where: { entityType, entityId },
  });
}

// ── Similarity ─────────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; for text embeddings this is effectively [0, 1].
 *
 * @param a - First vector
 * @param b - Second vector (must have same length as a)
 * @returns Cosine similarity score
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the most semantically similar stored embeddings to a query vector.
 *
 * Loads all stored embeddings of the given entity types, computes cosine
 * similarity in-process, and returns the top-k results sorted by score.
 *
 * Performance note: this is O(n) over stored embeddings. Acceptable for
 * < 10k embeddings. When the corpus grows, switch to pgvector IVFFlat index.
 *
 * @param queryVector - The embedding of the search query
 * @param entityTypes - Which entity types to search (default: all)
 * @param limit - Maximum number of results to return (default: 10)
 * @param minScore - Minimum similarity threshold to include in results (default: 0.7)
 * @returns Ranked array of similarity results, highest score first
 */
export async function searchByEmbedding(
  queryVector: number[],
  entityTypes?: EmbeddingEntityType[],
  limit = 10,
  minScore = 0.7
): Promise<SimilarityResult[]> {
  const dbc = db as any;

  const where = entityTypes?.length ? { entityType: { in: entityTypes } } : {};
  const rows: Array<{ entityType: string; entityId: string; content: string; vector: string }> =
    await dbc.embedding.findMany({ where });

  const scored: SimilarityResult[] = rows
    .map((row) => {
      let vec: number[] = [];
      try {
        vec = JSON.parse(row.vector);
      } catch {
        return null;
      }
      const score = cosineSimilarity(queryVector, vec);
      return {
        entityType: row.entityType as EmbeddingEntityType,
        entityId: row.entityId,
        content: row.content,
        score,
      };
    })
    .filter((r): r is SimilarityResult => r !== null && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Convenience: generate an embedding from text and immediately run a similarity search.
 * Returns an empty array if embedding generation fails.
 *
 * @param queryText - Plain text search query
 * @param entityTypes - Which entity types to search (default: all)
 * @param limit - Maximum number of results (default: 10)
 */
export async function semanticSearch(
  queryText: string,
  entityTypes?: EmbeddingEntityType[],
  limit = 10
): Promise<SimilarityResult[]> {
  const vector = await generateEmbedding(queryText);
  if (!vector) return [];
  return searchByEmbedding(vector, entityTypes, limit);
}
