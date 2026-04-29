import {
  AgentJsonSchemas,
  EvidenceScoringOutputSchema,
} from "~/lib/schemas";
import type { RetrievedCandidateChunk } from "~/lib/types";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { evidenceScoringPrompt } from "~/server/prompts/evidenceScoring.prompt";

function confidenceFromSimilarity(
  similarityScore: number
): "high" | "medium" | "weak" | "missing" {
  if (similarityScore >= 0.78) return "high";
  if (similarityScore >= 0.45) return "medium";
  if (similarityScore >= 0.15) return "weak";
  return "missing";
}

export async function runEvidenceScoringAgent(args: {
  applicationId: string;
  requirement: {
    id: string;
    label: string;
    description: string;
    importance: string;
  };
  retrievedChunks: RetrievedCandidateChunk[];
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Evidence Scoring Agent",
    model: "fast",
    systemPrompt: evidenceScoringPrompt,
    userPrompt: JSON.stringify({
      requirement: args.requirement,
      retrievedChunks: args.retrievedChunks,
    }),
    schema: EvidenceScoringOutputSchema,
    jsonSchema: AgentJsonSchemas.evidenceScoring,
    mockOutput: () => {
      if (args.retrievedChunks.length === 0) {
        return {
          matches: [
            {
              jobRequirementId: args.requirement.id,
              candidateChunkId: null,
              confidence: "missing" as const,
              reason: "No candidate evidence was retrieved for this requirement.",
            },
          ],
        };
      }

      return {
        matches: args.retrievedChunks.map((chunk) => {
          const confidence = confidenceFromSimilarity(chunk.similarityScore);
          return {
            jobRequirementId: args.requirement.id,
            candidateChunkId: confidence === "missing" ? null : chunk.id,
            confidence,
            reason:
              confidence === "missing"
                ? "Retrieved chunks were not usable evidence for this requirement."
                : `${confidence} evidence based on semantic overlap with: ${chunk.content.slice(0, 160)}`,
          };
        }),
      };
    },
  });
}
