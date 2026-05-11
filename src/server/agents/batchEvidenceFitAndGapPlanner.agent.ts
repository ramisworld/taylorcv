import { BatchEvidenceFitOutputSchema } from "~/lib/schemas";
import type { BatchEvidenceFitOutput, EvidenceConfidence } from "~/lib/types";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { batchEvidenceFitAndGapPlannerPrompt } from "~/server/prompts/batchEvidenceFitAndGapPlanner.prompt";

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "currentMatchScore",
    "matchLabel",
    "topStrengths",
    "weakSpots",
    "evidenceCards",
    "requirementFitSummary",
    "claimRisks",
    "recommendedGapQuestions",
    "cvAngle",
    "roleArchetype",
  ],
  properties: {
    currentMatchScore: { type: "number" },
    matchLabel: { type: "string" },
    topStrengths: { type: "array", items: { type: "string" } },
    weakSpots: { type: "array", items: { type: "string" } },
    evidenceCards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "requirementId",
          "requirementLabel",
          "candidateChunkId",
          "content",
          "confidence",
          "reason",
          "claimRisk",
        ],
        properties: {
          requirementId: { type: ["string", "null"] },
          requirementLabel: { type: "string" },
          candidateChunkId: { type: ["string", "null"] },
          content: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "weak", "missing"] },
          reason: { type: "string" },
          claimRisk: { type: "string", enum: ["safe", "careful_wording", "avoid_claim"] },
        },
      },
    },
    requirementFitSummary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "requirementId",
          "confidence",
          "bestCandidateChunkId",
          "reason",
          "claimRisk",
          "cvUsefulness",
        ],
        properties: {
          requirementId: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "weak", "missing"] },
          bestCandidateChunkId: { type: ["string", "null"] },
          reason: { type: "string" },
          claimRisk: { type: "string", enum: ["safe", "careful_wording", "avoid_claim"] },
          cvUsefulness: {
            type: "string",
            enum: ["headline", "supporting", "keyword_only", "do_not_use"],
          },
        },
      },
    },
    claimRisks: { type: "array", items: { type: "string" } },
    recommendedGapQuestions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "targetRequirementId",
          "question",
          "shortQuestion",
          "linkedJobRequirement",
          "whyThisMatters",
          "howYourAnswerHelps",
          "quickOptions",
          "selectedOptionRequiresDetail",
          "followUpPrompt",
          "dynamicGuidance",
          "questionType",
        ],
        properties: {
          targetRequirementId: { type: ["string", "null"] },
          question: { type: "string" },
          shortQuestion: { type: "string" },
          linkedJobRequirement: { type: ["string", "null"] },
          whyThisMatters: { type: "string" },
          howYourAnswerHelps: { type: "string" },
          quickOptions: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" },
          },
          selectedOptionRequiresDetail: { type: "boolean" },
          followUpPrompt: { type: ["string", "null"] },
          dynamicGuidance: { type: "string" },
          questionType: {
            type: "string",
            enum: [
              "missing_requirement",
              "metric_enrichment",
              "scope_enrichment",
              "domain_specific_proof",
            ],
          },
        },
      },
    },
    cvAngle: { type: "string" },
    roleArchetype: { type: "string" },
  },
} as const;

function confidenceFromSimilarity(score: number): EvidenceConfidence {
  if (score >= 0.72) return "high";
  if (score >= 0.48) return "medium";
  if (score >= 0.24) return "weak";
  return "missing";
}

function fallbackOutput(input: {
  requirements: Array<{ id: string; label: string; importance: string }>;
  retrievedEvidenceByRequirement: Record<
    string,
    Array<{ id: string; content: string; similarityScore: number }>
  >;
  roleDomain?: string | null;
  archetypeHint?: string | null;
}): BatchEvidenceFitOutput {
  const summary = input.requirements.map((requirement) => {
    const evidence = input.retrievedEvidenceByRequirement[requirement.id] ?? [];
    const best = evidence[0] ?? null;
    const confidence = best ? confidenceFromSimilarity(best.similarityScore) : "missing";
    return {
      requirement,
      best,
      confidence,
    };
  });
  const highOrMedium = summary.filter(
    (item) => item.confidence === "high" || item.confidence === "medium"
  );
  const weighted = summary.reduce(
    (total, item) => {
      const weight =
        item.requirement.importance === "high"
          ? 5
          : item.requirement.importance === "medium"
            ? 3
            : 1;
      const value =
        item.confidence === "high"
          ? 0.86
          : item.confidence === "medium"
            ? 0.62
            : item.confidence === "weak"
              ? 0.28
              : 0;
      return {
        earned: total.earned + weight * value,
        possible: total.possible + weight,
      };
    },
    { earned: 0, possible: 0 }
  );
  const rawScore =
    weighted.possible > 0 ? Math.round((weighted.earned / weighted.possible) * 78) : 0;
  const currentMatchScore = Math.min(
    highOrMedium.length >= 5 ? 78 : highOrMedium.length >= 3 ? 68 : 58,
    Math.max(22, rawScore)
  );

  return {
    currentMatchScore,
    matchLabel:
      currentMatchScore >= 70
        ? "Strong raw evidence"
        : currentMatchScore >= 52
          ? "Promising but untailored"
          : "Needs stronger proof",
    topStrengths: highOrMedium
      .slice(0, 4)
      .map((item) => `${item.requirement.label}: ${item.best?.content.slice(0, 160)}`),
    weakSpots: summary
      .filter((item) => item.confidence === "weak" || item.confidence === "missing")
      .slice(0, 4)
      .map((item) => item.requirement.label),
    evidenceCards: summary
      .filter((item) => item.best)
      .slice(0, 8)
      .map((item) => ({
        requirementId: item.requirement.id,
        requirementLabel: item.requirement.label,
        candidateChunkId: item.best?.id ?? null,
        content: item.best?.content ?? "No evidence found.",
        confidence: item.confidence,
        reason: `Best retrieved evidence for ${item.requirement.label}.`,
        claimRisk: item.confidence === "high" ? "safe" : "careful_wording",
      })),
    requirementFitSummary: summary.map((item) => ({
      requirementId: item.requirement.id,
      confidence: item.confidence,
      bestCandidateChunkId: item.confidence === "missing" ? null : item.best?.id ?? null,
      reason:
        item.confidence === "missing"
          ? "No useful evidence found for this requirement."
          : `Relevant evidence found for ${item.requirement.label}.`,
      claimRisk: item.confidence === "high" ? "safe" : item.confidence === "missing" ? "avoid_claim" : "careful_wording",
      cvUsefulness:
        item.confidence === "high"
          ? "headline"
          : item.confidence === "medium"
            ? "supporting"
            : item.confidence === "weak"
              ? "keyword_only"
              : "do_not_use",
    })),
    claimRisks: summary
      .filter((item) => item.confidence === "weak" || item.confidence === "missing")
      .slice(0, 4)
      .map((item) => `Avoid overstating ${item.requirement.label}.`),
    recommendedGapQuestions: summary
      .filter((item) => item.requirement.importance !== "low" && item.confidence !== "high")
      .slice(0, 3)
      .map((item) => ({
        targetRequirementId: item.requirement.id,
        question: `Can you share one concrete example for ${item.requirement.label}?`,
        shortQuestion: `Any proof for ${item.requirement.label}?`,
        linkedJobRequirement: item.requirement.label,
        whyThisMatters: "This is one of the role signals where the current CV evidence could be stronger.",
        howYourAnswerHelps: "A short answer gives Taylor truthful proof to place in the final CV.",
        quickOptions: ["Yes", "Somewhat", "Not yet", "Skip"],
        selectedOptionRequiresDetail: true,
        followUpPrompt: "One line: what did you do, where did it happen, and what changed?",
        dynamicGuidance: "Use a real example only. A rough scope is fine if exact numbers are unknown.",
        questionType: "missing_requirement",
      })),
    cvAngle: `${input.archetypeHint ?? input.roleDomain ?? "Role"} candidate with the strongest credible evidence placed first.`,
    roleArchetype: input.archetypeHint ?? input.roleDomain ?? "general",
  };
}

export async function runBatchEvidenceFitAndGapPlannerAgent(args: {
  applicationId: string;
  input: {
    parsedJob: unknown;
    requirements: Array<{ id: string; label: string; description: string; importance: string }>;
    candidateProfileSummary: string;
    retrievedEvidenceByRequirement: Record<string, Array<{ id: string; content: string; similarityScore: number }>>;
    metricOpportunities: string[];
    scopeOpportunities: string[];
    roleDomain?: string | null;
    archetypeHint?: string | null;
  };
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Batch Evidence Fit + Gap Planner Agent",
    model: "fast",
    systemPrompt: batchEvidenceFitAndGapPlannerPrompt,
    userPrompt: JSON.stringify(args.input),
    schema: BatchEvidenceFitOutputSchema,
    jsonSchema,
    temperature: 0,
    mockOutput: () => fallbackOutput(args.input),
  });
}
