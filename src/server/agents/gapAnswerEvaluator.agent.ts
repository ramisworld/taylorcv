import {
  buildGapAnswerEvaluatorJsonSchema,
  mockGapAnswerEvaluatorOutput,
  type GapAnswerEvaluatorInput,
} from "~/lib/gapAnswerEvaluatorContract";
import { GapAnswerEvaluatorOutputSchema } from "~/lib/schemas";
import type { GapAnswerEvaluatorOutput } from "~/lib/types";
import { runStreamingJsonAgent } from "~/server/agents/agentRunner";
import { gapAnswerEvaluatorPrompt } from "~/server/prompts/gapAnswerEvaluator.prompt";

function replyPrefix(rawJson: string) {
  const keyIndex = rawJson.indexOf('"assistantReply"');
  if (keyIndex < 0) return "";
  const colonIndex = rawJson.indexOf(":", keyIndex);
  const quoteIndex = rawJson.indexOf('"', colonIndex + 1);
  if (colonIndex < 0 || quoteIndex < 0) return "";

  let encoded = "";
  let escaped = false;
  for (let index = quoteIndex + 1; index < rawJson.length; index += 1) {
    const char = rawJson[index];
    if (!escaped && char === '"') break;
    encoded += char;
    if (!escaped && char === "\\") {
      escaped = true;
    } else {
      escaped = false;
    }
  }
  if (escaped) encoded = encoded.slice(0, -1);
  try {
    return JSON.parse(`"${encoded}"`) as string;
  } catch {
    return encoded.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function normalizedOutput(output: GapAnswerEvaluatorOutput): GapAnswerEvaluatorOutput {
  if (
    output.shouldSaveEvidence &&
    output.usableStatus !== "not_usable" &&
    output.extractedEvidenceSummary?.trim()
  ) {
    return output;
  }
  return {
    ...output,
    shouldSaveEvidence: false,
    usableStatus: "not_usable",
    extractedEvidenceSummary: null,
    shouldMoveToNextQuestion: false,
    boostBand: "none",
    suggestedBoostPercent: 0,
  };
}

async function emitMockReply(
  reply: string,
  onAssistantReplyDelta: (delta: string) => void | Promise<void>
) {
  for (const token of reply.match(/\S+\s*|\s+/g) ?? [reply]) {
    await onAssistantReplyDelta(token);
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

export async function runGapAnswerEvaluatorAgent(args: {
  applicationId: string;
  input: GapAnswerEvaluatorInput;
  onAssistantReplyDelta: (delta: string) => void | Promise<void>;
}) {
  const mock = mockGapAnswerEvaluatorOutput(args.input);
  let rawJson = "";
  let streamedReply = "";
  const output = normalizedOutput(
    await runStreamingJsonAgent({
      applicationId: args.applicationId,
      agentName: "Gap Answer Evaluator Agent",
      model: "fast",
      systemPrompt: gapAnswerEvaluatorPrompt,
      userPrompt: JSON.stringify(args.input),
      schema: GapAnswerEvaluatorOutputSchema,
      jsonSchema: buildGapAnswerEvaluatorJsonSchema(args.input),
      temperature: 0.1,
      onRawOutputDelta: async (delta) => {
        rawJson += delta;
        const nextReply = replyPrefix(rawJson);
        const visibleDelta = nextReply.slice(streamedReply.length);
        streamedReply = nextReply;
        if (visibleDelta) await args.onAssistantReplyDelta(visibleDelta);
      },
      mockOutput: () => mock,
    })
  );

  if (!streamedReply) {
    await emitMockReply(output.assistantReply, args.onAssistantReplyDelta);
  }
  return output;
}
