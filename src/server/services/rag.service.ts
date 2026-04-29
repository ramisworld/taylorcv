import "server-only";

import { db } from "~/server/db";
import { searchCandidateChunks } from "~/server/tools/vectorSearch.tool";
import type {
  EvidenceConfidence,
  EvidenceScoringOutput,
  Importance,
  RetrievedCandidateChunk,
} from "~/lib/types";

const confidenceRank = {
  missing: 0,
  weak: 1,
  medium: 2,
  high: 3,
} satisfies Record<EvidenceConfidence, number>;

export type RequirementEvidenceMapRow = {
  requirementId: string;
  requirementLabel: string;
  requirementImportance: Importance;
  overallConfidence: EvidenceConfidence;
  bestEvidence: Array<{
    chunkId: string;
    contentPreview: string;
    confidence: "high" | "medium";
    reason: string;
  }>;
  weakEvidence: Array<{
    chunkId: string;
    contentPreview: string;
    confidence: "weak";
    reason: string;
  }>;
  reason: string;
};

function preview(content: string) {
  return content.length > 280 ? `${content.slice(0, 277)}...` : content;
}

function rankedConfidence(matches: Array<{ confidence: EvidenceConfidence }>) {
  if (matches.some((match) => match.confidence === "high")) return "high";
  if (matches.some((match) => match.confidence === "medium")) return "medium";
  if (matches.some((match) => match.confidence === "weak")) return "weak";
  return "missing";
}

export async function retrieveCandidateEvidenceForRequirement(args: {
  anonymousSessionId: string;
  applicationId: string;
  requirement: {
    id: string;
    label: string;
    description: string;
  };
}) {
  await db.evidenceMatch.deleteMany({
    where: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirement.id,
    },
  });

  const retrievedChunks = await searchCandidateChunks({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    requirementText: `${args.requirement.label}\n${args.requirement.description}`,
    topK: 3,
  });

  return retrievedChunks;
}

export async function replaceWithScoredEvidenceMatches(args: {
  applicationId: string;
  requirementId: string;
  retrievedChunks: RetrievedCandidateChunk[];
  scoring: EvidenceScoringOutput;
}) {
  type ScoredEvidenceMatch = {
    jobRequirementId: string;
    candidateChunkId: string | null;
    confidence: EvidenceConfidence;
    reason: string;
  };

  const similarityByChunkId = new Map(
    args.retrievedChunks.map((chunk) => [chunk.id, chunk.similarityScore])
  );

  await db.evidenceMatch.deleteMany({
    where: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirementId,
    },
  });

  const scoringByChunkId = new Map(
    args.scoring.matches
      .filter((match) => match.candidateChunkId)
      .map((match) => [match.candidateChunkId!, match])
  );

  const scoredMatches: ScoredEvidenceMatch[] =
    args.retrievedChunks.length > 0
      ? args.retrievedChunks.map((chunk) => {
          const scored = scoringByChunkId.get(chunk.id);
          const confidence =
            scored?.confidence === "high" || scored?.confidence === "medium"
              ? scored.confidence
              : "weak";

          return {
            jobRequirementId: args.requirementId,
            candidateChunkId: chunk.id,
            confidence,
            reason:
              scored?.reason ??
              "Retrieved candidate evidence was only weakly related to this requirement.",
          };
        })
      : [
          {
            jobRequirementId: args.requirementId,
            candidateChunkId: null,
            confidence: "missing" as const,
            reason: "No usable evidence found for this requirement.",
          },
        ];

  await db.evidenceMatch.createMany({
    data: scoredMatches.map((match) => ({
      applicationId: args.applicationId,
      jobRequirementId: args.requirementId,
      candidateChunkId: match.candidateChunkId,
      similarityScore: match.candidateChunkId
        ? similarityByChunkId.get(match.candidateChunkId)
        : null,
      confidence: match.confidence,
      reason: match.reason,
    })),
  });
}

export async function buildRequirementEvidenceMap(
  applicationId: string
): Promise<RequirementEvidenceMapRow[]> {
  const job = await db.job.findUnique({
    where: { applicationId },
    include: { requirements: true },
  });

  if (!job) {
    return [];
  }

  const matches = await db.evidenceMatch.findMany({
    where: { applicationId },
    include: {
      candidateChunk: {
        select: {
          id: true,
          content: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (matches.length === 0) {
    return [];
  }

  const matchesByRequirement = new Map<string, typeof matches>();
  for (const match of matches) {
    const requirementMatches =
      matchesByRequirement.get(match.jobRequirementId) ?? [];
    requirementMatches.push(match);
    matchesByRequirement.set(match.jobRequirementId, requirementMatches);
  }

  return job.requirements.map((requirement) => {
    const requirementMatches = matchesByRequirement.get(requirement.id) ?? [];
    const overallConfidence = rankedConfidence(requirementMatches);
    const sortedMatches = [...requirementMatches].sort(
      (a, b) =>
        confidenceRank[b.confidence] - confidenceRank[a.confidence] ||
        (b.similarityScore ?? 0) - (a.similarityScore ?? 0)
    );

    const bestEvidence = sortedMatches
      .filter(
        (
          match
        ): match is typeof match & {
          candidateChunk: NonNullable<typeof match.candidateChunk>;
          confidence: "high" | "medium";
        } =>
          !!match.candidateChunk &&
          (match.confidence === "high" || match.confidence === "medium")
      )
      .slice(0, 3)
      .map((match) => ({
        chunkId: match.candidateChunk.id,
        contentPreview: preview(match.candidateChunk.content),
        confidence: match.confidence,
        reason: match.reason,
      }));

    const weakEvidence = sortedMatches
      .filter(
        (
          match
        ): match is typeof match & {
          candidateChunk: NonNullable<typeof match.candidateChunk>;
          confidence: "weak";
        } => !!match.candidateChunk && match.confidence === "weak"
      )
      .map((match) => ({
        chunkId: match.candidateChunk.id,
        contentPreview: preview(match.candidateChunk.content),
        confidence: match.confidence,
        reason: match.reason,
      }));

    const reason =
      bestEvidence[0]?.reason ??
      weakEvidence[0]?.reason ??
      requirementMatches.find((match) => match.confidence === "missing")
        ?.reason ??
      "No usable evidence found for this requirement.";

    return {
      requirementId: requirement.id,
      requirementLabel: requirement.label,
      requirementImportance: requirement.importance,
      overallConfidence,
      bestEvidence,
      weakEvidence,
      reason,
    };
  });
}
