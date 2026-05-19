export const scorerPayloadFieldsRemoved = ["displayLabel", "tagsJson", "metadataJson"] as const;

export type EvidenceFitScorerRunInput = {
  parsedJob: unknown;
  requirements: Array<{ id: string; label: string; description: string; importance: string }>;
  candidateProfileSummary: string;
  retrievedEvidenceByRequirement: Record<
    string,
    Array<{
      id: string;
      content: string;
      similarityScore: number;
      chunkType: string;
      sourceType: string;
      tagsJson: unknown;
      metadataJson: unknown;
      displayLabel?: string | null;
    }>
  >;
  metricOpportunities: string[];
  scopeOpportunities: string[];
  roleDomain?: string | null;
  archetypeHint?: string | null;
  repairInstructions?: Array<{
    jobRequirementId: string;
    selectedEvidenceIndex: number | null;
    reason: string;
  }>;
};

export type EvidenceFitScorerPayload = Omit<
  EvidenceFitScorerRunInput,
  "retrievedEvidenceByRequirement" | "repairInstructions"
> & {
  retrievedEvidenceByRequirement: Record<
    string,
    Array<{
      evidenceIndex: number;
      content: string;
      similarityScore: number;
      chunkType?: string;
      sourceType?: string;
    }>
  >;
  repairInstructions?: Array<{
    jobRequirementId: string;
    selectedEvidenceIndex: number | null;
    reason: string;
  }>;
};

function normalizeEvidenceContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

export function buildEvidenceFitScorerPayload(
  input: EvidenceFitScorerRunInput
): EvidenceFitScorerPayload {
  return {
    ...input,
    repairInstructions: input.repairInstructions?.map((item) => ({
      jobRequirementId: item.jobRequirementId,
      selectedEvidenceIndex: item.selectedEvidenceIndex,
      reason: item.reason,
    })),
    retrievedEvidenceByRequirement: Object.fromEntries(
      Object.entries(input.retrievedEvidenceByRequirement).map(([requirementId, evidence]) => [
        requirementId,
        evidence.map((item, evidenceIndex) => ({
          evidenceIndex,
          content: normalizeEvidenceContent(item.content),
          similarityScore: Number(item.similarityScore.toFixed(4)),
          chunkType: item.chunkType,
          sourceType: item.sourceType,
        })),
      ])
    ),
  };
}

export function legacyScorerPayloadWithoutChunkIds(input: EvidenceFitScorerRunInput) {
  return {
    ...input,
    repairInstructions: input.repairInstructions?.map((item) => ({
      jobRequirementId: item.jobRequirementId,
      selectedEvidenceIndex: item.selectedEvidenceIndex,
      reason: item.reason,
    })),
    retrievedEvidenceByRequirement: Object.fromEntries(
      Object.entries(input.retrievedEvidenceByRequirement).map(([requirementId, evidence]) => [
        requirementId,
        evidence.map((item, evidenceIndex) => ({
          evidenceIndex,
          displayLabel: item.displayLabel ?? null,
          content: item.content,
          similarityScore: item.similarityScore,
          chunkType: item.chunkType,
          sourceType: item.sourceType,
          tagsJson: item.tagsJson,
          metadataJson: item.metadataJson,
        })),
      ])
    ),
  };
}
