import { randomUUID } from "crypto";

import type { RetrievedCandidateChunk } from "../../lib/types.ts";
import { db } from "../db.ts";
import { createEmbedding, createEmbeddings } from "./embedding.tool.ts";

export type NewCandidateChunk = {
  anonymousSessionId?: string | null;
  userId?: string | null;
  sourceApplicationId?: string | null;
  candidateProfileId?: string | null;
  sourceType: "profile" | "cv_upload" | "linkedin" | "background" | "gap_answer" | "manual";
  sourceId?: string | null;
  sourceKey?: string | null;
  sourceHash?: string | null;
  contentHash?: string | null;
  chunkType:
    | "project"
    | "skill"
    | "certification"
    | "education"
    | "experience"
    | "gap_answer"
    | "achievement";
  content: string;
  tags: string[];
  metadata?: Record<string, unknown>;
};

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => value.toFixed(8)).join(",")}]`;
}

export async function insertCandidateChunkWithEmbedding(chunk: NewCandidateChunk) {
  const embedding = await createEmbedding(chunk.content);
  const id = randomUUID();

  await db.$executeRaw`
    INSERT INTO candidate_chunks (
      id,
      anonymous_session_id,
      user_id,
      source_application_id,
      candidate_profile_id,
      source_type,
      source_id,
      source_key,
      source_hash,
      content_hash,
      chunk_type,
      content,
      embedding,
      tags_json,
      metadata_json,
      embedded_at,
      last_seen_at
    )
    VALUES (
      ${id},
      ${chunk.anonymousSessionId ?? null},
      ${chunk.userId ?? null},
      ${chunk.sourceApplicationId ?? null},
      ${chunk.candidateProfileId ?? null},
      ${chunk.sourceType}::"SourceType",
      ${chunk.sourceId ?? null},
      ${chunk.sourceKey ?? null},
      ${chunk.sourceHash ?? null},
      ${chunk.contentHash ?? null},
      ${chunk.chunkType}::"ChunkType",
      ${chunk.content},
      ${toVectorLiteral(embedding)}::vector,
      ${JSON.stringify(chunk.tags)}::jsonb,
      ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
      NOW(),
      NOW()
    )
  `;

  const rows = await db.$queryRaw<
    Array<{
      id: string;
      anonymousSessionId: string;
      userId: string | null;
      sourceApplicationId: string | null;
      candidateProfileId: string | null;
      sourceType: string;
      sourceId: string | null;
      chunkType: string;
      content: string;
      tagsJson: unknown;
      metadataJson: unknown;
      createdAt: Date;
    }>
  >`
    SELECT
      id,
      anonymous_session_id AS "anonymousSessionId",
      user_id AS "userId",
      source_application_id AS "sourceApplicationId",
      candidate_profile_id AS "candidateProfileId",
      source_type AS "sourceType",
      source_id AS "sourceId",
      chunk_type AS "chunkType",
      content,
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      created_at AS "createdAt"
    FROM candidate_chunks
    WHERE id = ${id}
    LIMIT 1
  `;

  const inserted = rows[0];
  if (!inserted) {
    throw new Error("Inserted candidate chunk could not be loaded");
  }

  return inserted;
}

export async function insertCandidateChunksWithEmbeddings(
  chunks: NewCandidateChunk[]
) {
  if (chunks.length === 0) return [];

  const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content));
  const inserted = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = embeddings[index];
    if (!chunk || !embedding) continue;
    const id = randomUUID();

    await db.$executeRaw`
      INSERT INTO candidate_chunks (
        id,
        anonymous_session_id,
        user_id,
        source_application_id,
        candidate_profile_id,
        source_type,
        source_id,
        source_key,
        source_hash,
        content_hash,
        chunk_type,
        content,
        embedding,
        tags_json,
        metadata_json,
        embedded_at,
        last_seen_at
      )
      VALUES (
        ${id},
        ${chunk.anonymousSessionId ?? null},
        ${chunk.userId ?? null},
        ${chunk.sourceApplicationId ?? null},
        ${chunk.candidateProfileId ?? null},
        ${chunk.sourceType}::"SourceType",
        ${chunk.sourceId ?? null},
        ${chunk.sourceKey ?? null},
        ${chunk.sourceHash ?? null},
        ${chunk.contentHash ?? null},
        ${chunk.chunkType}::"ChunkType",
        ${chunk.content},
        ${toVectorLiteral(embedding)}::vector,
        ${JSON.stringify(chunk.tags)}::jsonb,
        ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
        NOW(),
        NOW()
      )
    `;
    inserted.push(id);
  }

  if (inserted.length === 0) return [];

  return db.$queryRaw<
    Array<{
      id: string;
      anonymousSessionId: string;
      userId: string | null;
      sourceApplicationId: string | null;
      candidateProfileId: string | null;
      sourceType: string;
      sourceId: string | null;
      chunkType: string;
      content: string;
      tagsJson: unknown;
      metadataJson: unknown;
      createdAt: Date;
    }>
  >`
    SELECT
      id,
      anonymous_session_id AS "anonymousSessionId",
      user_id AS "userId",
      source_application_id AS "sourceApplicationId",
      candidate_profile_id AS "candidateProfileId",
      source_type AS "sourceType",
      source_id AS "sourceId",
      chunk_type AS "chunkType",
      content,
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      created_at AS "createdAt"
    FROM candidate_chunks
    WHERE id = ANY(${inserted})
    ORDER BY created_at ASC
  `;
}

export async function searchCandidateChunks(args: {
  anonymousSessionId: string;
  userId?: string | null;
  requirementText: string;
  topK?: number;
}) {
  const embedding = await createEmbedding(args.requirementText);
  const topK = Math.min(args.topK ?? 3, 3);

  return db.$queryRaw<RetrievedCandidateChunk[]>`
    SELECT
      id,
      content,
      chunk_type AS "chunkType",
      source_type AS "sourceType",
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      1 - (embedding <=> ${toVectorLiteral(embedding)}::vector) AS "similarityScore"
    FROM candidate_chunks
    WHERE
      archived_at IS NULL
      AND (
        (${args.userId ?? null}::text IS NOT NULL AND user_id = ${args.userId ?? null})
        OR (${args.userId ?? null}::text IS NULL AND anonymous_session_id = ${args.anonymousSessionId})
        OR (${args.userId ?? null}::text IS NOT NULL AND user_id IS NULL AND anonymous_session_id = ${args.anonymousSessionId})
      )
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
    LIMIT ${topK}
  `;
}

export async function searchCandidateChunksForRequirements(args: {
  anonymousSessionId: string;
  userId?: string | null;
  requirements: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  topK?: number;
}) {
  const topK = Math.min(args.topK ?? 4, 6);
  const embeddings = await createEmbeddings(
    args.requirements.map(
      (requirement) => `${requirement.label}\n${requirement.description}`
    )
  );
  const results = new Map<string, RetrievedCandidateChunk[]>();

  for (let index = 0; index < args.requirements.length; index += 1) {
    const requirement = args.requirements[index];
    const embedding = embeddings[index];
    if (!requirement || !embedding) continue;

    const rows = await db.$queryRaw<RetrievedCandidateChunk[]>`
      SELECT
        id,
        content,
        chunk_type AS "chunkType",
        source_type AS "sourceType",
        tags_json AS "tagsJson",
        metadata_json AS "metadataJson",
        1 - (embedding <=> ${toVectorLiteral(embedding)}::vector) AS "similarityScore"
      FROM candidate_chunks
      WHERE
        archived_at IS NULL
        AND (
          (${args.userId ?? null}::text IS NOT NULL AND user_id = ${args.userId ?? null})
          OR (${args.userId ?? null}::text IS NULL AND anonymous_session_id = ${args.anonymousSessionId})
          OR (${args.userId ?? null}::text IS NOT NULL AND user_id IS NULL AND anonymous_session_id = ${args.anonymousSessionId})
        )
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
      LIMIT ${topK}
    `;
    results.set(requirement.id, rows);
  }

  return results;
}
