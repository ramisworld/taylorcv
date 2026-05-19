import { confidenceValue, importanceWeight } from "./scoring.ts";

type EvidenceConfidence = "high" | "medium" | "low" | "missing";

export type BatchFitRequirement = {
  id: string;
  label: string;
  importance: string;
};

export type BatchFitSummaryItem = {
  confidence: EvidenceConfidence;
  selectedEvidenceIndex: number | null;
  reason: string;
  claimRisk: string;
  cvUsefulness: string;
};

export type BatchFitPersistenceOutput = {
  requirementFitByRequirementId: Record<string, BatchFitSummaryItem>;
};

export type RetrievedEvidenceRef = {
  displayLabel?: string | null;
  id: string;
  similarityScore: number;
  content?: string;
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
  jobRequirementId: string;
  selectedEvidenceIndex: number | null;
  selectedCandidateChunkId?: string | null;
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
  evidenceRefsByRequirement: Record<string, RetrievedEvidenceRef[]>;
  validCandidateChunkIds: Set<string>;
}) {
  const evidenceMatches: EvidenceMatchPersistenceRow[] = [];
  const requirementFitScores: RequirementFitPersistenceRow[] = [];
  const rejectedMatches: RejectedEvidenceMatch[] = [];

  for (const requirement of args.jobRequirements) {
    const fit = args.output.requirementFitByRequirementId[requirement.id] ?? null;
    const retrieved = args.evidenceRefsByRequirement[requirement.id] ?? [];
    const requestedEvidenceIndex = fit?.selectedEvidenceIndex ?? null;
    const selectedEvidence =
      requestedEvidenceIndex === null ? null : retrieved[requestedEvidenceIndex] ?? null;
    const chunkIsPersisted =
      !!selectedEvidence && args.validCandidateChunkIds.has(selectedEvidence.id);
    const canPersistChunk = !!selectedEvidence && chunkIsPersisted;

    if (fit && fit.confidence !== "missing" && requestedEvidenceIndex === null) {
      rejectedMatches.push({
        jobRequirementId: requirement.id,
        selectedEvidenceIndex: null,
        selectedCandidateChunkId: null,
        reason: "Non-missing confidence must include a selected evidence index.",
      });
      continue;
    }

    if (fit && fit.confidence === "missing" && requestedEvidenceIndex !== null) {
      rejectedMatches.push({
        jobRequirementId: requirement.id,
        selectedEvidenceIndex: requestedEvidenceIndex,
        selectedCandidateChunkId: selectedEvidence?.id ?? null,
        reason: "Missing confidence must use a null selected evidence index.",
      });
      continue;
    }

    if (requestedEvidenceIndex !== null && !canPersistChunk) {
      rejectedMatches.push({
        jobRequirementId: requirement.id,
        selectedEvidenceIndex: requestedEvidenceIndex,
        selectedCandidateChunkId: selectedEvidence?.id ?? null,
        reason: !selectedEvidence
          ? "Selected evidence index was not in the ordered evidence list for this requirement."
          : "Selected evidence is outside the persisted candidate memory set.",
      });
      continue;
    }

    const confidence: EvidenceConfidence =
      fit?.confidence === "missing" ? "missing" : fit && canPersistChunk ? fit.confidence : "missing";
    const bestCandidateChunkId = canPersistChunk ? selectedEvidence.id : null;
    const parts = scoreParts(requirement.importance, confidence);
    const similarity =
      bestCandidateChunkId && selectedEvidence ? selectedEvidence.similarityScore : null;
    const reason =
      fit?.reason ??
      (bestCandidateChunkId
        ? "Relevant persisted candidate evidence found for this requirement."
        : "No usable persisted evidence found for this requirement.");
    const persistedReason =
      confidence === "missing" && requestedEvidenceIndex !== null
        ? "No validated evidence could be confirmed for this requirement."
        : reason;

    evidenceMatches.push({
      applicationId: args.applicationId,
      jobRequirementId: requirement.id,
      candidateChunkId: bestCandidateChunkId,
      similarityScore: similarity ?? null,
      confidence,
      cvUsefulness: bestCandidateChunkId ? fit?.cvUsefulness ?? "keyword_only" : "do_not_use",
      claimRisk: bestCandidateChunkId ? fit?.claimRisk ?? "careful_wording" : "avoid_claim",
      reason: persistedReason,
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
