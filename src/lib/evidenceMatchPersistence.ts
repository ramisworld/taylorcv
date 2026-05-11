import { confidenceValue, importanceWeight } from "./scoring.ts";

type EvidenceConfidence = "high" | "medium" | "weak" | "missing";

export type BatchFitRequirement = {
  id: string;
  label: string;
  importance: string;
};

export type BatchFitSummaryItem = {
  requirementId: string;
  confidence: EvidenceConfidence;
  bestCandidateChunkId: string | null;
  reason: string;
  claimRisk: string;
  cvUsefulness: string;
};

export type BatchFitPersistenceOutput = {
  requirementFitSummary: BatchFitSummaryItem[];
};

export type RetrievedEvidenceRef = {
  id: string;
  similarityScore: number;
};

export type EvidenceMatchPersistenceRow = {
  applicationId: string;
  jobRequirementId: string;
  candidateChunkId: string | null;
  similarityScore: number | null;
  confidence: EvidenceConfidence;
  cvUsefulness: string;
  claimRisk: string;
  reason: string;
};

export type RequirementFitPersistenceRow = {
  applicationId: string;
  jobRequirementId: string;
  finalConfidence: EvidenceConfidence;
  bestCandidateChunkId: string | null;
  reason: string;
  importanceWeight: number;
  confidenceValue: number;
  earnedPoints: number;
  possiblePoints: number;
};

export type RejectedEvidenceMatch = {
  requirementId: string;
  rejectedCandidateChunkId: string;
  reason: string;
};

function scoreParts(importance: string, confidence: EvidenceConfidence) {
  const weight = importanceWeight(importance);
  const value = confidenceValue(confidence);
  return {
    importanceWeight: weight,
    confidenceValue: value,
    earnedPoints: weight * value,
    possiblePoints: weight,
  };
}

export function buildEvidenceMatchPersistencePlan(args: {
  applicationId: string;
  jobRequirements: BatchFitRequirement[];
  output: BatchFitPersistenceOutput;
  retrievedEvidenceByRequirement: Record<string, RetrievedEvidenceRef[]>;
  validCandidateChunkIds: Set<string>;
}) {
  const evidenceMatches: EvidenceMatchPersistenceRow[] = [];
  const requirementFitScores: RequirementFitPersistenceRow[] = [];
  const rejectedMatches: RejectedEvidenceMatch[] = [];

  for (const requirement of args.jobRequirements) {
    const fit =
      args.output.requirementFitSummary.find(
        (item) => item.requirementId === requirement.id
      ) ?? null;
    const requestedChunkId =
      fit?.confidence === "missing" ? null : fit?.bestCandidateChunkId ?? null;
    const retrieved = args.retrievedEvidenceByRequirement[requirement.id] ?? [];
    const retrievedIds = new Set(retrieved.map((item) => item.id));
    const chunkIsPersisted =
      !!requestedChunkId && args.validCandidateChunkIds.has(requestedChunkId);
    const chunkWasRetrieved = !!requestedChunkId && retrievedIds.has(requestedChunkId);
    const canPersistChunk = !!requestedChunkId && chunkIsPersisted && chunkWasRetrieved;

    if (requestedChunkId && !canPersistChunk) {
      rejectedMatches.push({
        requirementId: requirement.id,
        rejectedCandidateChunkId: requestedChunkId,
        reason: !chunkIsPersisted
          ? "Candidate chunk ID does not exist for this application."
          : "Candidate chunk ID was not retrieved for this requirement.",
      });
    }

    const confidence: EvidenceConfidence =
      fit && (canPersistChunk || fit.confidence === "missing") ? fit.confidence : "missing";
    const bestCandidateChunkId = canPersistChunk ? requestedChunkId : null;
    const parts = scoreParts(requirement.importance, confidence);
    const similarity = bestCandidateChunkId
      ? retrieved.find((item) => item.id === bestCandidateChunkId)?.similarityScore
      : null;
    const reason =
      fit?.reason ??
      (bestCandidateChunkId
        ? "Relevant persisted candidate evidence found for this requirement."
        : "No usable persisted evidence found for this requirement.");

    evidenceMatches.push({
      applicationId: args.applicationId,
      jobRequirementId: requirement.id,
      candidateChunkId: bestCandidateChunkId,
      similarityScore: similarity ?? null,
      confidence,
      cvUsefulness: bestCandidateChunkId ? fit?.cvUsefulness ?? "keyword_only" : "do_not_use",
      claimRisk: bestCandidateChunkId ? fit?.claimRisk ?? "careful_wording" : "avoid_claim",
      reason: bestCandidateChunkId
        ? reason
        : requestedChunkId
          ? `${reason} Rejected invalid candidate chunk reference.`
          : reason,
    });
    requirementFitScores.push({
      applicationId: args.applicationId,
      jobRequirementId: requirement.id,
      finalConfidence: confidence,
      bestCandidateChunkId,
      reason: evidenceMatches[evidenceMatches.length - 1]?.reason ?? reason,
      ...parts,
    });
  }

  return {
    evidenceMatches,
    requirementFitScores,
    rejectedMatches,
  };
}
