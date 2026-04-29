import { randomUUID } from "crypto";

import type { RetrievedCandidateChunk } from "../../lib/types.ts";
import { db } from "../db.ts";
import { createEmbedding } from "./embedding.tool.ts";

export type NewCandidateChunk = {
  anonymousSessionId: string;
  applicationId: string;
  candidateProfileId?: string | null;
  sourceType: "profile" | "gap_answer" | "manual";
  sourceId?: string | null;
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

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => value.toFixed(8)).join(",")}]`;
}

export async function insertCandidateChunkWithEmbedding(chunk: NewCandidateChunk) {
  const embedding = await createEmbedding(chunk.content);
  const id = randomUUID();

  await db.$executeRaw`
    INSERT INTO candidate_chunks (
      id,
      anonymous_session_id,
      application_id,
      candidate_profile_id,
      source_type,
      source_id,
      chunk_type,
      content,
      embedding,
      tags_json,
      metadata_json
    )
    VALUES (
      ${id},
      ${chunk.anonymousSessionId},
      ${chunk.applicationId},
      ${chunk.candidateProfileId ?? null},
      ${chunk.sourceType}::"SourceType",
      ${chunk.sourceId ?? null},
      ${chunk.chunkType}::"ChunkType",
      ${chunk.content},
      ${toVectorLiteral(embedding)}::vector,
      ${JSON.stringify(chunk.tags)}::jsonb,
      ${JSON.stringify(chunk.metadata ?? {})}::jsonb
    )
  `;

  const rows = await db.$queryRaw<
    Array<{
      id: string;
      anonymousSessionId: string;
      applicationId: string;
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
      application_id AS "applicationId",
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

export async function searchCandidateChunks(args: {
  anonymousSessionId: string;
  applicationId: string;
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
      application_id = ${args.applicationId}
      AND anonymous_session_id = ${args.anonymousSessionId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
    LIMIT ${topK}
  `;
}
