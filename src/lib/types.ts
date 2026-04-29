import type { z } from "zod";

import type {
  ButtonAnswerSchema,
  CandidateProfilerOutputSchema,
  CvRewriteOutputSchema,
  CvStrategyOutputSchema,
  CvWriterOutputSchema,
  EvidenceChunkCreatorOutputSchema,
  EvidenceConfidenceSchema,
  EvidenceScoringOutputSchema,
  GapQuestionOutputSchema,
  ImportanceSchema,
  JobParserOutputSchema,
  RequirementTypeSchema,
} from "~/lib/schemas";

export type RequirementType = z.infer<typeof RequirementTypeSchema>;
export type Importance = z.infer<typeof ImportanceSchema>;
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>;
export type ButtonAnswer = z.infer<typeof ButtonAnswerSchema>;

export type JobParserOutput = z.infer<typeof JobParserOutputSchema>;
export type CandidateProfilerOutput = z.infer<
  typeof CandidateProfilerOutputSchema
>;
export type EvidenceChunkCreatorOutput = z.infer<
  typeof EvidenceChunkCreatorOutputSchema
>;
export type EvidenceScoringOutput = z.infer<typeof EvidenceScoringOutputSchema>;
export type GapQuestionOutput = z.infer<typeof GapQuestionOutputSchema>;
export type CvStrategyOutput = z.infer<typeof CvStrategyOutputSchema>;
export type CvWriterOutput = z.infer<typeof CvWriterOutputSchema>;
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
