import {
  buildGapQuestionJsonSchema,
  mockGapQuestionOutput,
  type GapQuestionAgentInput,
} from "~/lib/gapQuestionAgentContract";
import { GapQuestionAgentOutputSchema } from "~/lib/schemas";
import type { GapQuestionAgentOutput } from "~/lib/types";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { gapQuestionPrompt } from "~/server/prompts/gapQuestion.prompt";

function estimateTokens(chars: number) {
  return Math.ceil(chars / 4);
}

function normalizeOutput(input: GapQuestionAgentInput, rawOutput: unknown): GapQuestionAgentOutput {
  const validTargetIds = new Set(input.targets.map((target) => target.jobRequirementId));
  const rawQuestions =
    rawOutput &&
    typeof rawOutput === "object" &&
    Array.isArray((rawOutput as { questions?: unknown }).questions)
      ? (rawOutput as { questions: unknown[] }).questions
      : [];
  const seenQuestionText = new Set<string>();
  const questions = rawQuestions
    .filter((item): item is GapQuestionAgentOutput["questions"][number] => {
      if (!item || typeof item !== "object") return false;
      const targetRequirementId = (item as { targetRequirementId?: unknown }).targetRequirementId;
      const question = (item as { question?: unknown }).question;
      if (typeof targetRequirementId !== "string" || !validTargetIds.has(targetRequirementId)) {
        return false;
      }
      if (typeof question !== "string" || !question.trim()) return false;
      const normalizedQuestion = question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seenQuestionText.has(normalizedQuestion)) return false;
      seenQuestionText.add(normalizedQuestion);
      return true;
    })
    .slice(0, 3);
  return { questions };
}

function logPayloadMetrics(args: {
  applicationId: string;
  input: GapQuestionAgentInput;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
}) {
  const systemPromptChars = gapQuestionPrompt.length;
  const userInputChars = args.userPrompt.length;
  const outputSchemaChars = JSON.stringify(args.jsonSchema).length;
  const totalRequestChars = systemPromptChars + userInputChars + outputSchemaChars;
  console.info("TAYLOR_PAYLOAD_METRICS", {
    applicationId: args.applicationId,
    agentName: "Gap Question Agent",
    systemPromptChars,
    userInputChars,
    outputSchemaChars,
    totalRequestChars,
    estimatedTokens: estimateTokens(totalRequestChars),
    targetCount: args.input.targets.length,
    strongestAreaCount: args.input.candidateContext.strongestAreas.length,
  });
}

export async function runGapQuestionAgent(args: {
  applicationId: string;
  input: GapQuestionAgentInput;
}) {
  if (args.input.targets.length === 0) {
    return { questions: [] };
  }
  const jsonSchema = buildGapQuestionJsonSchema(args.input);
  const userPrompt = JSON.stringify(args.input);
  logPayloadMetrics({
    applicationId: args.applicationId,
    input: args.input,
    userPrompt,
    jsonSchema,
  });
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Gap Question Agent",
    model: "fast",
    systemPrompt: gapQuestionPrompt,
    userPrompt,
    schema: GapQuestionAgentOutputSchema,
    jsonSchema,
    temperature: 0.2,
    normalizeRawOutput: (rawOutput) => normalizeOutput(args.input, rawOutput),
    mockOutput: () => mockGapQuestionOutput(args.input),
  });
}
