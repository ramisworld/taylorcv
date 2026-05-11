import "server-only";

import {
  calculateEvidenceMatchScoreFromRows,
  confidenceValue,
  importanceWeight,
  type EvidenceMatchScoreSummary,
} from "~/lib/scoring";
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
  importanceWeight: number;
  confidenceValue: number;
  earnedPoints: number;
  possiblePoints: number;
  bestCandidateChunkId: string | null;
  bestEvidence: Array<{
    chunkId: string;
    contentPreview: string;
    confidence: "high" | "medium";
    reason: string;
    cvUsefulness: string | null;
    claimRisk: string | null;
    metadata: unknown;
  }>;
  weakEvidence: Array<{
    chunkId: string;
    contentPreview: string;
    confidence: "weak";
    reason: string;
    cvUsefulness: string | null;
    claimRisk: string | null;
    metadata: unknown;
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

function scoreParts(args: {
  importance: Importance | string;
  confidence: EvidenceConfidence;
}) {
  const weight = importanceWeight(args.importance);
  const value = confidenceValue(args.confidence);

  return {
    importanceWeight: weight,
    confidenceValue: value,
    earnedPoints: weight * value,
    possiblePoints: weight,
  };
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
  requirement: {
    id: string;
    importance: Importance | string;
  };
  retrievedChunks: RetrievedCandidateChunk[];
  scoring: EvidenceScoringOutput;
}) {
  type ScoredEvidenceMatch = {
    jobRequirementId: string;
    candidateChunkId: string | null;
    confidence: EvidenceConfidence;
    cvUsefulness: string;
    claimRisk: string;
    reason: string;
  };

  const similarityByChunkId = new Map(
    args.retrievedChunks.map((chunk) => [chunk.id, chunk.similarityScore])
  );

  await db.evidenceMatch.deleteMany({
    where: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirement.id,
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
            scored?.confidence === "high" ||
            scored?.confidence === "medium" ||
            scored?.confidence === "weak"
              ? scored.confidence
              : "weak";

          return {
            jobRequirementId: args.requirement.id,
            candidateChunkId: chunk.id,
            confidence,
            cvUsefulness:
              scored?.cvUsefulness ??
              (confidence === "high"
                ? "headline"
                : confidence === "medium"
                  ? "supporting"
                  : "keyword_only"),
            claimRisk:
              scored?.claimRisk ??
              (confidence === "high" ? "safe" : "careful_wording"),
            reason:
              scored?.reason ??
              "Retrieved candidate evidence was only weakly related to this requirement.",
          };
        })
      : [
          {
            jobRequirementId: args.requirement.id,
            candidateChunkId: null,
            confidence: "missing" as const,
            cvUsefulness: "do_not_use",
            claimRisk: "avoid_claim",
            reason: "No usable evidence found for this requirement.",
          },
        ];

  await db.evidenceMatch.createMany({
    data: scoredMatches.map((match) => ({
      applicationId: args.applicationId,
      jobRequirementId: args.requirement.id,
      candidateChunkId: match.candidateChunkId,
      similarityScore: match.candidateChunkId
        ? similarityByChunkId.get(match.candidateChunkId)
        : null,
      confidence: match.confidence,
      cvUsefulness: match.cvUsefulness,
      claimRisk: match.claimRisk,
      reason: match.reason,
    })),
  });

  const fitScore = deriveRequirementFitScore({
    requirementId: args.requirement.id,
    importance: args.requirement.importance,
    retrievedChunks: args.retrievedChunks,
    scoring: args.scoring,
    scoredMatches,
  });

  await db.requirementFitScore.upsert({
    where: {
      applicationId_jobRequirementId: {
        applicationId: args.applicationId,
        jobRequirementId: args.requirement.id,
      },
    },
    update: {
      finalConfidence: fitScore.finalConfidence,
      bestCandidateChunkId: fitScore.bestCandidateChunkId,
      reason: fitScore.reason,
      importanceWeight: fitScore.importanceWeight,
      confidenceValue: fitScore.confidenceValue,
      earnedPoints: fitScore.earnedPoints,
      possiblePoints: fitScore.possiblePoints,
    },
    create: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirement.id,
      finalConfidence: fitScore.finalConfidence,
      bestCandidateChunkId: fitScore.bestCandidateChunkId,
      reason: fitScore.reason,
      importanceWeight: fitScore.importanceWeight,
      confidenceValue: fitScore.confidenceValue,
      earnedPoints: fitScore.earnedPoints,
      possiblePoints: fitScore.possiblePoints,
    },
  });
}

function deriveRequirementFitScore(args: {
  requirementId: string;
  importance: Importance | string;
  retrievedChunks: RetrievedCandidateChunk[];
  scoring: EvidenceScoringOutput;
  scoredMatches: Array<{
    candidateChunkId: string | null;
    confidence: EvidenceConfidence;
    reason: string;
  }>;
}) {
  const explicitMissing = args.scoring.matches.find(
    (match) => match.confidence === "missing" && !match.candidateChunkId
  );
  const explicitlyScoredChunkIds = new Set(
    args.scoring.matches
      .filter((match) => match.candidateChunkId && match.confidence !== "missing")
      .map((match) => match.candidateChunkId)
  );
  const eligibleMatches = args.scoredMatches
    .filter(
      (match) =>
        match.candidateChunkId &&
        match.confidence !== "missing" &&
        (!explicitMissing || explicitlyScoredChunkIds.has(match.candidateChunkId))
    )
    .sort((a, b) => {
      const rankDelta =
        confidenceRank[b.confidence] - confidenceRank[a.confidence];
      if (rankDelta !== 0) return rankDelta;
      const aSimilarity =
        args.retrievedChunks.find((chunk) => chunk.id === a.candidateChunkId)
          ?.similarityScore ?? 0;
      const bSimilarity =
        args.retrievedChunks.find((chunk) => chunk.id === b.candidateChunkId)
          ?.similarityScore ?? 0;
      return bSimilarity - aSimilarity;
    });
  const bestMatch = eligibleMatches[0];
  const finalConfidence: EvidenceConfidence =
    bestMatch?.confidence ?? (explicitMissing ? "missing" : "missing");
  const bestCandidateChunkId =
    finalConfidence === "missing" ? null : (bestMatch?.candidateChunkId ?? null);
  const parts = scoreParts({
    importance: args.importance,
    confidence: finalConfidence,
  });

  return {
    finalConfidence,
    bestCandidateChunkId,
    reason:
      finalConfidence === "missing"
        ? (explicitMissing?.reason ??
          "No useful candidate evidence supports this requirement.")
        : (bestMatch?.reason ??
          "This is the strongest available evidence for the requirement."),
    ...parts,
  };
}

export async function calculateEvidenceMatchScore(
  applicationId: string
): Promise<EvidenceMatchScoreSummary> {
  const rows = await db.requirementFitScore.findMany({
    where: { applicationId },
  });

  return calculateEvidenceMatchScoreFromRows(rows);
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
          metadataJson: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  const fitScores = await db.requirementFitScore.findMany({
    where: { applicationId },
  });
  const fitScoreByRequirement = new Map(
    fitScores.map((score) => [score.jobRequirementId, score])
  );

  const matchesByRequirement = new Map<string, typeof matches>();
  for (const match of matches) {
    const requirementMatches =
      matchesByRequirement.get(match.jobRequirementId) ?? [];
    requirementMatches.push(match);
    matchesByRequirement.set(match.jobRequirementId, requirementMatches);
  }

  return job.requirements.map((requirement) => {
    const requirementMatches = matchesByRequirement.get(requirement.id) ?? [];
    const fitScore = fitScoreByRequirement.get(requirement.id);
    const fallbackParts = scoreParts({
      importance: requirement.importance,
      confidence: rankedConfidence(requirementMatches),
    });
    const overallConfidence =
      fitScore?.finalConfidence ?? rankedConfidence(requirementMatches);
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
        cvUsefulness: match.cvUsefulness,
        claimRisk: match.claimRisk,
        metadata: match.candidateChunk.metadataJson,
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
        cvUsefulness: match.cvUsefulness,
        claimRisk: match.claimRisk,
        metadata: match.candidateChunk.metadataJson,
      }));

    const reason =
      fitScore?.reason ??
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
      importanceWeight: fitScore?.importanceWeight ?? fallbackParts.importanceWeight,
      confidenceValue: fitScore?.confidenceValue ?? fallbackParts.confidenceValue,
      earnedPoints: fitScore?.earnedPoints ?? fallbackParts.earnedPoints,
      possiblePoints: fitScore?.possiblePoints ?? fallbackParts.possiblePoints,
      bestCandidateChunkId: fitScore?.bestCandidateChunkId ?? null,
      bestEvidence,
      weakEvidence,
      reason,
    };
  });
}
