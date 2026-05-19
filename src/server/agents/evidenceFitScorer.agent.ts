import { BatchEvidenceFitOutputSchema } from "~/lib/schemas";
import type { BatchEvidenceFitOutput } from "~/lib/types";
import { calibrateEvidenceConfidence } from "~/lib/evidenceScoringCalibration";
import {
  buildEvidenceFitScorerPayload,
  legacyScorerPayloadWithoutChunkIds,
  scorerPayloadFieldsRemoved,
  type EvidenceFitScorerPayload,
  type EvidenceFitScorerRunInput,
} from "~/lib/evidenceFitScorerPayload";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { evidenceFitScorerPrompt } from "~/server/prompts/evidenceFitScorer.prompt";

function estimateTokens(chars: number) {
  return Math.ceil(chars / 4);
}

const legacyOutputSchemaChars = 10312;
const removedScorerOutputFields = [
  "matchLabel",
  "topStrengths",
  "weakSpots",
  "claimRisks",
  "coachInsight",
  "cvAngle",
  "roleArchetype",
] as const;

const requirementFitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "confidence",
    "selectedEvidenceIndex",
    "reason",
    "claimRisk",
    "cvUsefulness",
  ],
  properties: {
    confidence: { type: "string", enum: ["high", "medium", "low", "missing"] },
    selectedEvidenceIndex: { type: ["integer", "null"] },
    reason: { type: "string", maxLength: 140 },
    claimRisk: { type: "string", enum: ["safe", "careful_wording", "avoid_claim"] },
    cvUsefulness: {
      type: "string",
      enum: ["headline", "supporting", "keyword_only", "do_not_use"],
    },
  },
} as const;

function buildJsonSchema(input: EvidenceFitScorerPayload) {
  const requirementFitProperties = Object.fromEntries(
    input.requirements.map((requirement) => {
      const evidenceCount = input.retrievedEvidenceByRequirement[requirement.id]?.length ?? 0;
      const allowedIndexes = Array.from({ length: evidenceCount }, (_, index) => index);
      return [
        requirement.id,
        {
          ...requirementFitJsonSchema,
          properties: {
            ...requirementFitJsonSchema.properties,
            selectedEvidenceIndex: {
              type: ["integer", "null"],
              enum: [...allowedIndexes, null],
            },
          },
        },
      ];
    })
  );

  return {
    type: "object",
    additionalProperties: false,
    required: ["requirementFitByRequirementId"],
    properties: {
      requirementFitByRequirementId: {
        type: "object",
        additionalProperties: false,
        required: input.requirements.map((requirement) => requirement.id),
        properties: requirementFitProperties,
      },
    },
  } as const;
}

function fallbackOutput(input: EvidenceFitScorerPayload): BatchEvidenceFitOutput {
  const summary = input.requirements.map((requirement) => {
    const evidence = input.retrievedEvidenceByRequirement[requirement.id] ?? [];
    const best = evidence[0] ?? null;
    const confidence = best
      ? calibrateEvidenceConfidence({
          requirementLabel: requirement.label,
          requirementDescription: requirement.description,
          evidenceContent: best.content,
          similarityScore: best.similarityScore,
        })
      : "missing";
    return {
      requirement,
      best,
      confidence,
    };
  });

  return {
    requirementFitByRequirementId: Object.fromEntries(
      summary.map((item) => [
        item.requirement.id,
        {
          confidence: item.confidence,
          selectedEvidenceIndex:
            item.confidence === "missing" ? null : item.best?.evidenceIndex ?? null,
          reason:
            item.confidence === "missing"
              ? "No clear proof of this requirement appears yet."
              : item.confidence === "low"
                ? "Only thin or adjacent proof supports this requirement."
                : item.confidence === "medium"
                  ? "Relevant proof exists, but the match is still partial."
                  : "Direct proof strongly supports this requirement.",
          claimRisk:
            item.confidence === "high"
              ? "safe"
              : item.confidence === "missing"
                ? "avoid_claim"
                : "careful_wording",
          cvUsefulness:
            item.confidence === "high"
              ? "headline"
              : item.confidence === "medium"
                ? "supporting"
                : item.confidence === "low"
                  ? "keyword_only"
                  : "do_not_use",
        },
      ])
    ),
  };
}

function logPayloadMetrics(args: {
  applicationId: string;
  scorerInput: ReturnType<typeof buildEvidenceFitScorerPayload>;
  legacyInput: ReturnType<typeof legacyScorerPayloadWithoutChunkIds>;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
}) {
  const evidenceItems = Object.values(args.scorerInput.retrievedEvidenceByRequirement).flat();
  const evidenceContentLengths = evidenceItems.map((item) => item.content.length);
  const evidenceCount = evidenceItems.length;
  const scorerInputChars = args.userPrompt.length;
  const legacyScorerInputChars = JSON.stringify(args.legacyInput).length;
  const systemPromptChars = args.systemPrompt.length;
  const outputSchemaChars = JSON.stringify(args.jsonSchema).length;
  const totalRequestChars = systemPromptChars + scorerInputChars + outputSchemaChars;
  console.info("TAYLOR_PAYLOAD_METRICS", {
    applicationId: args.applicationId,
    agentName: "Evidence Fit Scorer Agent",
    systemPromptChars,
    scorerInputChars,
    legacyScorerInputChars,
    removedFieldChars: legacyScorerInputChars - scorerInputChars,
    outputSchemaChars,
    totalRequestChars,
    estimatedTokens: estimateTokens(totalRequestChars),
    requirementCount: args.scorerInput.requirements.length,
    retrievedEvidenceItemCount: evidenceCount,
    averageEvidenceContentChars:
      evidenceCount > 0
        ? Math.round(evidenceContentLengths.reduce((sum, length) => sum + length, 0) / evidenceCount)
        : 0,
    maxEvidenceContentChars: Math.max(0, ...evidenceContentLengths),
    retainedEvidencePayloadFields: [
      "evidenceIndex",
      "content",
      "similarityScore",
      "chunkType",
      "sourceType",
    ],
    removedEvidencePayloadFields: [...scorerPayloadFieldsRemoved],
    legacyOutputSchemaChars,
    minimalOutputSchemaChars: outputSchemaChars,
    outputSchemaCharsBeforeAfterDelta: legacyOutputSchemaChars - outputSchemaChars,
    removedScorerOutputFields: [...removedScorerOutputFields],
    coachInsightGeneratedBy: "deterministic",
    matchFramingGeneratedBy: "deterministic",
  });
}

export async function runEvidenceFitScorerAgent(args: {
  applicationId: string;
  input: EvidenceFitScorerRunInput;
}) {
  const scorerInput = buildEvidenceFitScorerPayload(args.input);
  const jsonSchema = buildJsonSchema(scorerInput);
  const userPrompt = JSON.stringify(scorerInput);
  logPayloadMetrics({
    applicationId: args.applicationId,
    scorerInput,
    legacyInput: legacyScorerPayloadWithoutChunkIds(args.input),
    systemPrompt: evidenceFitScorerPrompt,
    userPrompt,
    jsonSchema,
  });
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Evidence Fit Scorer Agent",
    model: "fast",
    systemPrompt: evidenceFitScorerPrompt,
    userPrompt,
    schema: BatchEvidenceFitOutputSchema,
    jsonSchema,
    temperature: 0,
    mockOutput: () => fallbackOutput(scorerInput),
  });
}
