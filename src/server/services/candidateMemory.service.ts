import "server-only";

import { createHash, randomUUID } from "crypto";

import type { Prisma } from "../../../generated/prisma/index.js";

import type { CandidateProfilerOutput, RetrievedCandidateChunk } from "../../lib/types.ts";
import { db } from "../db.ts";
import type { NewCandidateChunk } from "../tools/vectorSearch.tool.ts";
import { toVectorLiteral } from "../tools/vectorSearch.tool.ts";
import { createEmbeddings, getActiveEmbeddingModelName } from "../tools/embedding.tool.ts";
import { timedStep } from "./timing.service.ts";

export type CandidateMemorySourceType =
  | "profile"
  | "cv_upload"
  | "linkedin"
  | "background"
  | "gap_answer"
  | "manual";

export type CandidateMemoryOwner = {
  anonymousSessionId: string;
  userId: string | null;
};

export type CandidateMemoryChunkRow = {
  id: string;
  anonymousSessionId: string | null;
  userId: string | null;
  sourceApplicationId: string | null;
  candidateProfileId: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceKey: string | null;
  sourceHash: string | null;
  contentHash: string | null;
  chunkType: string;
  content: string;
  tagsJson: unknown;
  metadataJson: unknown;
  embeddedAt: Date | null;
  lastSeenAt: Date;
  createdAt: Date;
};

function inputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseVectorLiteral(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!trimmed) return null;
  const embedding = trimmed.split(",").map((item) => Number(item));
  return embedding.length === 1536 && embedding.every(Number.isFinite) ? embedding : null;
}

function normalizedContentHash(content: string) {
  return hash(content.replace(/\s+/g, " ").trim().toLowerCase());
}

export function requirementQueryText(requirement: { label: string; description: string }) {
  return `${requirement.label.trim()}\n${requirement.description.trim()}`;
}

function requirementQueryHash(requirement: { label: string; description: string }) {
  return hash(requirementQueryText(requirement).replace(/\s+/g, " ").trim().toLowerCase());
}

function ownerWhere(owner: CandidateMemoryOwner) {
  return owner.userId
    ? {
        OR: [
          { userId: owner.userId },
          { userId: null, anonymousSessionId: owner.anonymousSessionId },
        ],
      }
    : { anonymousSessionId: owner.anonymousSessionId, userId: null };
}

function activeOwnerWhere(owner: CandidateMemoryOwner) {
  return {
    archivedAt: null,
    ...ownerWhere(owner),
  };
}

export function sourceTypeFromProfileSource(source: string | null | undefined): CandidateMemorySourceType {
  if (source === "linkedin_url") return "linkedin";
  if (source === "background") return "background";
  if (source === "manual") return "manual";
  return "cv_upload";
}

function profileContentHash(profile: CandidateProfilerOutput) {
  return hash({
    contactInfo: profile.contactInfo,
    links: profile.links,
    summary: profile.summary,
    skills: profile.skills,
    projects: profile.projects,
    education: profile.education,
    certifications: profile.certifications,
    experience: profile.experience,
    tools: profile.tools,
    achievements: profile.achievements,
  });
}

function profileStructuredWhere(profile: CandidateProfilerOutput) {
  return {
    summary: profile.summary,
    skillsJson: { equals: inputJson(profile.skills) },
    projectsJson: { equals: inputJson(profile.projects) },
    educationJson: { equals: inputJson(profile.education) },
    certificationsJson: { equals: inputJson(profile.certifications) },
    experienceJson: { equals: inputJson(profile.experience) },
    toolsJson: { equals: inputJson(profile.tools) },
    achievementsJson: { equals: inputJson(profile.achievements) },
  };
}

export async function loadLatestCandidateProfile(owner: CandidateMemoryOwner) {
  return db.candidateProfile.findFirst({
    where: activeOwnerWhere(owner),
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCandidateMemorySummary(owner: CandidateMemoryOwner) {
  const [latestProfile, chunkCount, gapAnswerCount] = await Promise.all([
    loadLatestCandidateProfile(owner),
    db.candidateChunk.count({ where: activeOwnerWhere(owner) }),
    db.candidateChunk.count({
      where: { ...activeOwnerWhere(owner), sourceType: "gap_answer" },
    }),
  ]);

  return {
    hasMemory: chunkCount > 0,
    chunkCount,
    gapAnswerCount,
    latestProfileId: latestProfile?.id ?? null,
    latestProfileSummary: latestProfile?.summary ?? null,
    latestProfileSource: latestProfile?.profileSource ?? latestProfile?.sourceType ?? null,
    latestProfileUpdatedAt: latestProfile?.lastSeenAt ?? latestProfile?.createdAt ?? null,
  };
}

export async function upsertCandidateProfileMemory(args: {
  owner: CandidateMemoryOwner;
  sourceApplicationId: string;
  profileOutput: CandidateProfilerOutput;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  profileSource?: string | null;
  sourceSummary?: string | null;
  sourceUrl?: string | null;
}) {
  const sourceType = sourceTypeFromProfileSource(args.profileSource);
  const sourceHash = hash({
    rawCvText: args.rawCvText ?? "",
    rawBackgroundText: args.rawBackgroundText ?? "",
    sourceUrl: args.sourceUrl ?? "",
  });
  const contentHash = profileContentHash(args.profileOutput);
  const sourceKey = `${sourceType}:${args.sourceUrl?.trim() || sourceHash}`;
  const now = new Date();

  const existingBySource = await db.candidateProfile.findFirst({
    where: {
      ...activeOwnerWhere(args.owner),
      sourceKey,
    },
  });

  if (existingBySource?.contentHash === contentHash) {
    return db.candidateProfile.update({
      where: { id: existingBySource.id },
      data: {
        sourceApplicationId: args.sourceApplicationId,
        rawCvText: args.rawCvText,
        rawBackgroundText: args.rawBackgroundText,
        sourceSummary: args.sourceSummary ?? args.profileOutput.sourceSummary,
        sourceUrl: args.sourceUrl,
        lastSeenAt: now,
      },
    });
  }

  if (existingBySource) {
    await db.candidateProfile.update({
      where: { id: existingBySource.id },
      data: { archivedAt: now },
    });
  }

  const existingByContent = await db.candidateProfile.findFirst({
    where: {
      ...activeOwnerWhere(args.owner),
      contentHash,
    },
  });

  const reusableProfile =
    existingByContent ??
    (await db.candidateProfile.findFirst({
      where: {
        ...activeOwnerWhere(args.owner),
        ...profileStructuredWhere(args.profileOutput),
      },
    }));

  if (reusableProfile) {
    return db.candidateProfile.update({
      where: { id: reusableProfile.id },
      data: {
        sourceApplicationId: args.sourceApplicationId,
        sourceType,
        sourceKey,
        sourceHash,
        contentHash,
        rawCvText: args.rawCvText,
        rawBackgroundText: args.rawBackgroundText,
        sourceSummary: args.sourceSummary ?? args.profileOutput.sourceSummary,
        sourceUrl: args.sourceUrl,
        lastSeenAt: now,
      },
    });
  }

  return db.candidateProfile.create({
    data: {
      anonymousSessionId: args.owner.anonymousSessionId,
      userId: args.owner.userId,
      sourceApplicationId: args.sourceApplicationId,
      rawCvText: args.rawCvText,
      rawBackgroundText: args.rawBackgroundText,
      contactInfoJson: inputJson(args.profileOutput.contactInfo),
      linksJson: inputJson(args.profileOutput.links),
      sourceType,
      profileSource: args.profileSource,
      sourceSummary: args.sourceSummary ?? args.profileOutput.sourceSummary,
      sourceUrl: args.sourceUrl,
      sourceKey,
      sourceHash,
      contentHash,
      profileConfirmedAt: null,
      summary: args.profileOutput.summary,
      skillsJson: inputJson(args.profileOutput.skills),
      projectsJson: inputJson(args.profileOutput.projects),
      educationJson: inputJson(args.profileOutput.education),
      certificationsJson: inputJson(args.profileOutput.certifications),
      experienceJson: inputJson(args.profileOutput.experience),
      toolsJson: inputJson(args.profileOutput.tools),
      achievementsJson: inputJson(args.profileOutput.achievements),
      cautionNotesJson: inputJson(args.profileOutput.cautionNotes ?? []),
      metricOpportunitiesJson: inputJson(args.profileOutput.metricOpportunities ?? []),
      strongProofCandidatesJson: inputJson(args.profileOutput.strongProofCandidates ?? []),
      scopeOpportunitiesJson: inputJson(args.profileOutput.scopeOpportunities ?? []),
      likelyTopEvidenceJson: inputJson(args.profileOutput.likelyTopEvidence ?? []),
      lastSeenAt: now,
    },
  });
}

async function loadCandidateChunksByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.$queryRaw<CandidateMemoryChunkRow[]>`
    SELECT
      id,
      anonymous_session_id AS "anonymousSessionId",
      user_id AS "userId",
      source_application_id AS "sourceApplicationId",
      candidate_profile_id AS "candidateProfileId",
      source_type AS "sourceType",
      source_id AS "sourceId",
      source_key AS "sourceKey",
      source_hash AS "sourceHash",
      content_hash AS "contentHash",
      chunk_type AS "chunkType",
      content,
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      embedded_at AS "embeddedAt",
      last_seen_at AS "lastSeenAt",
      created_at AS "createdAt"
    FROM candidate_chunks
    WHERE id = ANY(${ids})
    ORDER BY created_at ASC
  `;
}

export async function upsertCandidateMemoryChunks(args: {
  owner: CandidateMemoryOwner;
  chunks: NewCandidateChunk[];
  applicationId?: string | null;
}) {
  const now = new Date();
  const insertedIds: string[] = [];
  const reusedIds: string[] = [];
  const toInsert: Array<NewCandidateChunk & {
    id: string;
    sourceKey: string;
    sourceHash: string;
    contentHash: string;
  }> = [];
  const plannedContentHashes = new Set<string>();
  const plannedSourceKeys = new Set<string>();

  await timedStep(
    "candidate memory dedupe/hashing",
    async () => {
      for (const chunk of args.chunks) {
        const contentHash = chunk.contentHash ?? normalizedContentHash(chunk.content);
        if (plannedContentHashes.has(contentHash)) continue;
        const sourceHash = chunk.sourceHash ?? hash({
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId ?? null,
          metadata: chunk.metadata ?? {},
        });
        const sourceKey =
          chunk.sourceKey ??
          `${chunk.sourceType}:${chunk.sourceId ?? sourceHash}`;

        if (plannedSourceKeys.has(sourceKey)) continue;

        const existingBySource = await db.candidateChunk.findFirst({
          where: {
            ...activeOwnerWhere(args.owner),
            sourceKey,
          },
          select: { id: true, contentHash: true },
        });

        if (existingBySource?.contentHash === contentHash) {
          await db.candidateChunk.update({
            where: { id: existingBySource.id },
            data: { lastSeenAt: now, sourceApplicationId: chunk.sourceApplicationId ?? null },
          });
          reusedIds.push(existingBySource.id);
          plannedContentHashes.add(contentHash);
          plannedSourceKeys.add(sourceKey);
          continue;
        }

        if (existingBySource) {
          await db.candidateChunk.update({
            where: { id: existingBySource.id },
            data: { archivedAt: now },
          });
        }

        const existingByContent = await db.candidateChunk.findFirst({
          where: {
            ...activeOwnerWhere(args.owner),
            contentHash,
          },
          select: { id: true },
        });

        const reusableChunk =
          existingByContent ??
          (await db.candidateChunk.findFirst({
            where: {
              ...activeOwnerWhere(args.owner),
              content: chunk.content,
            },
            select: { id: true },
          }));

        if (reusableChunk) {
          await db.candidateChunk.update({
            where: { id: reusableChunk.id },
            data: {
              lastSeenAt: now,
              sourceApplicationId: chunk.sourceApplicationId ?? null,
              sourceKey,
              sourceHash,
              contentHash,
            },
          });
          reusedIds.push(reusableChunk.id);
          plannedContentHashes.add(contentHash);
          plannedSourceKeys.add(sourceKey);
          continue;
        }

        toInsert.push({
          ...chunk,
          id: randomUUID(),
          anonymousSessionId: args.owner.anonymousSessionId,
          userId: args.owner.userId,
          sourceKey,
          sourceHash,
          contentHash,
        });
        plannedContentHashes.add(contentHash);
        plannedSourceKeys.add(sourceKey);
      }
    },
    { applicationId: args.applicationId ?? undefined, chunkCount: args.chunks.length }
  );

  const embeddings = await timedStep(
    "candidate chunk embedding",
    () =>
      toInsert.length > 0
        ? createEmbeddings(toInsert.map((chunk) => chunk.content))
        : Promise.resolve([]),
    { applicationId: args.applicationId ?? undefined, chunkCount: toInsert.length }
  );

  let persistedChunks: CandidateMemoryChunkRow[] = [];
  await timedStep(
    "candidate memory DB persistence",
    async () => {
      for (let index = 0; index < toInsert.length; index += 1) {
        const chunk = toInsert[index];
        const embedding = embeddings[index];
        if (!chunk || !embedding) continue;
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
            ${chunk.id},
            ${args.owner.anonymousSessionId},
            ${args.owner.userId},
            ${chunk.sourceApplicationId ?? null},
            ${chunk.candidateProfileId ?? null},
            ${chunk.sourceType}::"SourceType",
            ${chunk.sourceId ?? null},
            ${chunk.sourceKey},
            ${chunk.sourceHash},
            ${chunk.contentHash},
            ${chunk.chunkType}::"ChunkType",
            ${chunk.content},
            ${toVectorLiteral(embedding)}::vector,
            ${JSON.stringify(chunk.tags)}::jsonb,
            ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
            NOW(),
            NOW()
          )
        `;
        insertedIds.push(chunk.id);
      }
      persistedChunks = await loadCandidateChunksByIds([...reusedIds, ...insertedIds]);
    },
    {
      applicationId: args.applicationId ?? undefined,
      insertedCount: toInsert.length,
      reusedCount: reusedIds.length,
    }
  );

  return {
    chunks: persistedChunks,
    insertedCount: insertedIds.length,
    reusedCount: reusedIds.length,
  };
}

export async function loadCandidateMemoryChunks(owner: CandidateMemoryOwner) {
  return db.$queryRaw<CandidateMemoryChunkRow[]>`
    SELECT
      id,
      anonymous_session_id AS "anonymousSessionId",
      user_id AS "userId",
      source_application_id AS "sourceApplicationId",
      candidate_profile_id AS "candidateProfileId",
      source_type AS "sourceType",
      source_id AS "sourceId",
      source_key AS "sourceKey",
      source_hash AS "sourceHash",
      content_hash AS "contentHash",
      chunk_type AS "chunkType",
      content,
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      embedded_at AS "embeddedAt",
      last_seen_at AS "lastSeenAt",
      created_at AS "createdAt"
    FROM candidate_chunks
    WHERE archived_at IS NULL
      AND (
        (${owner.userId}::text IS NOT NULL AND user_id = ${owner.userId})
        OR (${owner.userId}::text IS NULL AND anonymous_session_id = ${owner.anonymousSessionId} AND user_id IS NULL)
        OR (${owner.userId}::text IS NOT NULL AND user_id IS NULL AND anonymous_session_id = ${owner.anonymousSessionId})
      )
    ORDER BY last_seen_at DESC, created_at ASC
  `;
}

type RequirementEmbeddingRow = {
  id: string;
  queryEmbedding: string | null;
  queryEmbeddingModel: string | null;
  queryEmbeddingInputHash: string | null;
};

export async function ensureRequirementQueryEmbeddings(args: {
  requirements: Array<{ id: string; label: string; description: string }>;
  applicationId?: string | null;
  forceRefresh?: boolean;
}) {
  const model = getActiveEmbeddingModelName();
  if (!model) {
    throw new Error("OPENAI_EMBEDDING_MODEL is required when USE_MOCK_AI is false");
  }
  const planned = args.requirements.map((requirement) => ({
    ...requirement,
    queryText: requirementQueryText(requirement),
    queryHash: requirementQueryHash(requirement),
  }));
  const ids = planned.map((requirement) => requirement.id);
  if (ids.length === 0) return new Map<string, number[]>();

  const rows = await db.$queryRaw<RequirementEmbeddingRow[]>`
    SELECT
      id,
      "query_embedding"::text AS "queryEmbedding",
      "query_embedding_model" AS "queryEmbeddingModel",
      "query_embedding_input_hash" AS "queryEmbeddingInputHash"
    FROM "job_requirements"
    WHERE id = ANY(${ids})
  `;
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const embeddingsByRequirementId = new Map<string, number[]>();
  const toEmbed = planned.filter((requirement) => {
    const row = rowById.get(requirement.id);
    const embedding = parseVectorLiteral(row?.queryEmbedding);
    const reusable =
      !args.forceRefresh &&
      !!embedding &&
      row?.queryEmbeddingModel === model &&
      row?.queryEmbeddingInputHash === requirement.queryHash;
    if (reusable && embedding) {
      embeddingsByRequirementId.set(requirement.id, embedding);
      return false;
    }
    return true;
  });

  if (toEmbed.length > 0) {
    const embeddings = await timedStep(
      "requirement query embedding",
      () => createEmbeddings(toEmbed.map((requirement) => requirement.queryText)),
      { applicationId: args.applicationId ?? undefined, requirementCount: toEmbed.length }
    );
    for (let index = 0; index < toEmbed.length; index += 1) {
      const requirement = toEmbed[index];
      const embedding = embeddings[index];
      if (!requirement || !embedding) continue;
      await db.$executeRaw`
        UPDATE "job_requirements"
        SET
          "query_embedding" = ${toVectorLiteral(embedding)}::vector,
          "query_embedding_model" = ${model},
          "query_embedding_input_hash" = ${requirement.queryHash},
          "query_embedded_at" = NOW()
        WHERE id = ${requirement.id}
      `;
      embeddingsByRequirementId.set(requirement.id, embedding);
    }
  }

  return embeddingsByRequirementId;
}

export async function searchCandidateMemoryForRequirements(args: {
  owner: CandidateMemoryOwner;
  requirements: Array<{ id: string; label: string; description: string }>;
  topK?: number;
  applicationId?: string | null;
}) {
  const topK = Math.min(args.topK ?? 5, 8);
  const embeddingsByRequirementId = await ensureRequirementQueryEmbeddings({
    requirements: args.requirements,
    applicationId: args.applicationId,
  });
  const results = new Map<string, RetrievedCandidateChunk[]>();

  await timedStep(
    "retrieval / pgvector search",
    async () => {
      for (let index = 0; index < args.requirements.length; index += 1) {
        const requirement = args.requirements[index];
        const embedding = requirement ? embeddingsByRequirementId.get(requirement.id) : null;
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
          WHERE archived_at IS NULL
            AND (
              (${args.owner.userId}::text IS NOT NULL AND user_id = ${args.owner.userId})
              OR (${args.owner.userId}::text IS NULL AND anonymous_session_id = ${args.owner.anonymousSessionId} AND user_id IS NULL)
              OR (${args.owner.userId}::text IS NOT NULL AND user_id IS NULL AND anonymous_session_id = ${args.owner.anonymousSessionId})
            )
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
          LIMIT ${topK}
        `;
        results.set(requirement.id, rows);
      }
    },
    { applicationId: args.applicationId ?? undefined, requirementCount: args.requirements.length }
  );

  return results;
}

async function hasActiveUserChunkConflict(args: {
  userId: string;
  sourceKey: string | null;
  contentHash: string | null;
}) {
  const or = [
    ...(args.sourceKey ? [{ sourceKey: args.sourceKey }] : []),
    ...(args.contentHash ? [{ contentHash: args.contentHash }] : []),
  ];
  if (or.length === 0) return null;
  return db.candidateChunk.findFirst({
    where: {
      userId: args.userId,
      archivedAt: null,
      OR: or,
    },
    select: { id: true },
  });
}

export async function claimAnonymousCandidateMemory(args: {
  anonymousSessionId: string;
  userId: string;
}) {
  const now = new Date();
  const profiles = await db.candidateProfile.findMany({
    where: { anonymousSessionId: args.anonymousSessionId, userId: null, archivedAt: null },
    select: { id: true, sourceKey: true, contentHash: true },
  });
  for (const profile of profiles) {
    const conflict = await db.candidateProfile.findFirst({
      where: {
        userId: args.userId,
        archivedAt: null,
        OR: [
          ...(profile.sourceKey ? [{ sourceKey: profile.sourceKey }] : []),
          ...(profile.contentHash ? [{ contentHash: profile.contentHash }] : []),
        ],
      },
      select: { id: true },
    });
    await db.candidateProfile.update({
      where: { id: profile.id },
      data: conflict ? { archivedAt: now } : { userId: args.userId, lastSeenAt: now },
    });
  }

  const chunks = await db.candidateChunk.findMany({
    where: { anonymousSessionId: args.anonymousSessionId, userId: null, archivedAt: null },
    select: { id: true, sourceKey: true, contentHash: true },
  });
  for (const chunk of chunks) {
    const conflict = await hasActiveUserChunkConflict({
      userId: args.userId,
      sourceKey: chunk.sourceKey,
      contentHash: chunk.contentHash,
    });
    await db.candidateChunk.update({
      where: { id: chunk.id },
      data: conflict ? { archivedAt: now } : { userId: args.userId, lastSeenAt: now },
    });
  }
}
