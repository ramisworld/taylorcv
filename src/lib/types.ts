import type { z } from "zod";

import type {
  ButtonAnswerSchema,
  CandidateProfilerOutputSchema,
  BatchEvidenceFitOutputSchema,
  CvBuilderOutputSchema,
  CvRewriteOutputSchema,
  CvLayoutStyleOutputSchema,
  CvQualityReviewOutputSchema,
  CvStrategyOutputSchema,
  CvWriterOutputSchema,
  EvidenceChunkCreatorOutputSchema,
  EvidenceConfidenceSchema,
  EvidenceMatchCvUsefulnessSchema,
  EvidenceScoringOutputSchema,
  ClaimRiskSchema,
  GapQuestionOutputSchema,
  GapQuestionTypeSchema,
  ImportanceSchema,
  LayoutArchitectureSchema,
  ProofStyleSchema,
  RoleFamilySchema,
  SectionBudgetTreatmentSchema,
  JobParserOutputSchema,
  RequirementTypeSchema,
} from "~/lib/schemas";

export type RequirementType = z.infer<typeof RequirementTypeSchema>;
export type Importance = z.infer<typeof ImportanceSchema>;
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>;
export type EvidenceMatchCvUsefulness = z.infer<
  typeof EvidenceMatchCvUsefulnessSchema
>;
export type ClaimRisk = z.infer<typeof ClaimRiskSchema>;
export type RoleFamily = z.infer<typeof RoleFamilySchema>;
export type ProofStyle = z.infer<typeof ProofStyleSchema>;
export type SectionBudgetTreatment = z.infer<
  typeof SectionBudgetTreatmentSchema
>;
export type LayoutArchitecture = z.infer<typeof LayoutArchitectureSchema>;
export type GapQuestionType = z.infer<typeof GapQuestionTypeSchema>;
export type ButtonAnswer = z.infer<typeof ButtonAnswerSchema>;

export type JobParserOutput = z.infer<typeof JobParserOutputSchema>;
export type CandidateProfilerOutput = z.infer<
  typeof CandidateProfilerOutputSchema
>;
export type BatchEvidenceFitOutput = z.infer<
  typeof BatchEvidenceFitOutputSchema
>;
export type CvBuilderOutput = z.infer<typeof CvBuilderOutputSchema>;
export type EvidenceChunkCreatorOutput = z.infer<
  typeof EvidenceChunkCreatorOutputSchema
>;
export type EvidenceScoringOutput = z.infer<typeof EvidenceScoringOutputSchema>;
export type GapQuestionOutput = z.infer<typeof GapQuestionOutputSchema>;
export type CvStrategyOutput = z.infer<typeof CvStrategyOutputSchema>;
export type CvWriterOutput = z.infer<typeof CvWriterOutputSchema>;
export type CvQualityReviewOutput = z.infer<
  typeof CvQualityReviewOutputSchema
>;
export type CvLayoutStyleOutput = z.infer<typeof CvLayoutStyleOutputSchema>;
export type CvRewriteOutput = z.infer<typeof CvRewriteOutputSchema>;

export type RetrievedCandidateChunk = {
  id: string;
  content: string;
  chunkType: string;
  sourceType: string;
  tagsJson: unknown;
  metadataJson: unknown;
  similarityScore: number;
};
