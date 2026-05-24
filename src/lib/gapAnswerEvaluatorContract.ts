import type { GapAnswerEvaluatorOutput } from "~/lib/types";

export type GapAnswerEvaluatorInput = {
  gapQuestion: {
    id: string;
    question: string;
    answerGuidance: string | null;
    targetRequirementId: string | null;
  };
  targetRequirement: {
    id: string;
    label: string;
    description: string;
    importance: "high" | "medium" | "low";
    currentConfidence: "high" | "medium" | "low" | "missing";
    weaknessReason: string;
  } | null;
  userMessage: string;
  job: {
    title: string;
    company: string | null;
    summary: string;
    roleDomain: string | null;
    archetypeHint: string | null;
  };
  candidateProfileSummary: string;
  relevantCandidateChunks: Array<{
    id: string;
    content: string;
    chunkType: string;
    sourceType: string;
  }>;
  previousGapAnswers: Array<{
    question: string;
    extractedEvidenceSummary: string;
    usableStatus: "usable" | "use_carefully";
  }>;
  matchAnalysis: unknown;
};

export function buildGapAnswerEvaluatorJsonSchema(input: GapAnswerEvaluatorInput) {
  const targetRequirementId = input.gapQuestion.targetRequirementId
    ? { type: ["string", "null"], enum: [input.gapQuestion.targetRequirementId, null] }
    : { type: "null" };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "messageType",
      "assistantReply",
      "shouldSaveEvidence",
      "usableStatus",
      "evidenceQuality",
      "targetRequirementId",
      "extractedEvidenceSummary",
      "followUpQuestion",
      "shouldMoveToNextQuestion",
      "boostBand",
      "suggestedBoostPercent",
      "reason",
    ],
    properties: {
      messageType: {
        type: "string",
        enum: [
          "clarification_request",
          "answer",
          "vague_answer",
          "off_topic",
          "unsafe_or_unusable",
        ],
      },
      assistantReply: { type: "string", maxLength: 460 },
      shouldSaveEvidence: { type: "boolean" },
      usableStatus: {
        type: "string",
        enum: ["usable", "use_carefully", "not_usable"],
      },
      evidenceQuality: {
        type: "string",
        enum: ["none", "weak", "usable", "strong"],
      },
      targetRequirementId,
      extractedEvidenceSummary: { type: ["string", "null"], maxLength: 420 },
      followUpQuestion: { type: ["string", "null"], maxLength: 280 },
      shouldMoveToNextQuestion: { type: "boolean" },
      boostBand: {
        type: "string",
        enum: ["none", "small", "medium", "large"],
      },
      suggestedBoostPercent: { type: "integer", minimum: 0, maximum: 15 },
      reason: { type: "string", maxLength: 260 },
    },
  } as const;
}

function trim(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clarification(message: string) {
  return /\b(i do not understand|i don't understand|what do you mean|clarif|explain|example|not sure what you mean)\b/i.test(
    message
  );
}

function specific(message: string) {
  return /\b(built|created|delivered|led|owned|implemented|worked with|tested|improved|used|managed|designed|wrote|taught|supported|handled|resolved)\b/i.test(
    message
  );
}

export function mockGapAnswerEvaluatorOutput(
  input: GapAnswerEvaluatorInput
): GapAnswerEvaluatorOutput {
  const message = trim(input.userMessage);
  const targetRequirementId = input.gapQuestion.targetRequirementId;
  if (clarification(message)) {
    return {
      messageType: "clarification_request",
      assistantReply: input.gapQuestion.answerGuidance
        ? `I am asking for a real example. ${input.gapQuestion.answerGuidance}`
        : "I am asking for one real example from your background: what you did, the context, and the result or scope.",
      shouldSaveEvidence: false,
      usableStatus: "not_usable",
      evidenceQuality: "none",
      targetRequirementId,
      extractedEvidenceSummary: null,
      followUpQuestion: null,
      shouldMoveToNextQuestion: false,
      boostBand: "none",
      suggestedBoostPercent: 0,
      reason: "The user asked for clarification.",
    };
  }
  if (message.length < 24 || /^(yes|no|maybe|kind of|somewhat)\.?$/i.test(message)) {
    return {
      messageType: "vague_answer",
      assistantReply: "Can you give one concrete example of what you did and the result or scope?",
      shouldSaveEvidence: false,
      usableStatus: "not_usable",
      evidenceQuality: "weak",
      targetRequirementId,
      extractedEvidenceSummary: null,
      followUpQuestion: "What did you do, where did it happen, and what changed?",
      shouldMoveToNextQuestion: false,
      boostBand: "none",
      suggestedBoostPercent: 0,
      reason: "The answer needs a concrete example before it becomes CV evidence.",
    };
  }
  const risky = /\b(barely|a little|not really|only watched|might have|i think)\b/i.test(message);
  const usable = specific(message);
  if (!usable) {
    return {
      messageType: "off_topic",
      assistantReply: "That does not give me evidence for this gap yet. Share a real example tied to the question, or skip it.",
      shouldSaveEvidence: false,
      usableStatus: "not_usable",
      evidenceQuality: "none",
      targetRequirementId,
      extractedEvidenceSummary: null,
      followUpQuestion: null,
      shouldMoveToNextQuestion: false,
      boostBand: "none",
      suggestedBoostPercent: 0,
      reason: "The message is not specific evidence for the target question.",
    };
  }
  return {
    messageType: "answer",
    assistantReply: risky
      ? "I have saved that as careful evidence and will keep the wording conservative."
      : "I have saved that evidence. I will use it only where it strengthens the CV truthfully.",
    shouldSaveEvidence: true,
    usableStatus: risky ? "use_carefully" : "usable",
    evidenceQuality: risky ? "usable" : message.length > 110 ? "strong" : "usable",
    targetRequirementId,
    extractedEvidenceSummary: message,
    followUpQuestion: null,
    shouldMoveToNextQuestion: true,
    boostBand: risky ? "small" : message.length > 110 ? "large" : "medium",
    suggestedBoostPercent: risky ? 2 : message.length > 110 ? 10 : 5,
    reason: "The message contains role-relevant candidate evidence.",
  };
}
