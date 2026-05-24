import assert from "node:assert/strict";

import { calculateGapAnswerBoost } from "../src/lib/gapAnswerBoost.ts";
import {
  buildGapAnswerEvaluatorJsonSchema,
  mockGapAnswerEvaluatorOutput,
} from "../src/lib/gapAnswerEvaluatorContract.ts";
import { GapAnswerEvaluatorOutputSchema } from "../src/lib/schemas.ts";
import { buildGapAnswerEvidenceChunk } from "../src/server/services/evidenceChunkBuilder.service.ts";

const input = {
  gapQuestion: {
    id: "gap-1",
    question: "What evidence can you share for this requirement?",
    answerGuidance: "Share a real example, your role, and the result.",
    targetRequirementId: "req-1",
  },
  targetRequirement: {
    id: "req-1",
    label: "Relevant delivery",
    description: "Deliver real work tied to the role.",
    importance: "high",
    currentConfidence: "missing",
    weaknessReason: "No evidence found.",
  },
  userMessage: "I don't understand.",
  job: {
    title: "Target Role",
    company: null,
    summary: "Role summary.",
    roleDomain: null,
    archetypeHint: null,
  },
  candidateProfileSummary: "Candidate summary.",
  relevantCandidateChunks: [],
  previousGapAnswers: [],
  matchAnalysis: {},
};

const clarification = mockGapAnswerEvaluatorOutput(input);
assert.equal(GapAnswerEvaluatorOutputSchema.safeParse(clarification).success, true);
assert.equal(clarification.shouldSaveEvidence, false);
assert.equal(clarification.usableStatus, "not_usable");
assert.equal(clarification.shouldMoveToNextQuestion, false);

const vague = mockGapAnswerEvaluatorOutput({ ...input, userMessage: "Yes." });
assert.equal(vague.messageType, "vague_answer");
assert.equal(vague.shouldSaveEvidence, false);
assert.ok(vague.followUpQuestion);

const strong = mockGapAnswerEvaluatorOutput({
  ...input,
  userMessage:
    "I built a role-relevant workflow, worked with reviewers to test it, and delivered the working change with documented scope and outcomes for the team.",
});
assert.equal(strong.shouldSaveEvidence, true);
assert.equal(strong.usableStatus, "usable");
assert.equal(strong.evidenceQuality, "strong");

const careful = mockGapAnswerEvaluatorOutput({
  ...input,
  userMessage:
    "I barely worked on this but implemented one related change with a teammate and tested the result.",
});
assert.equal(careful.usableStatus, "use_carefully");

const schema = buildGapAnswerEvaluatorJsonSchema(input);
assert.deepEqual(schema.properties.targetRequirementId.enum, ["req-1", null]);

const largeBoost = calculateGapAnswerBoost({
  output: strong,
  importance: "high",
  currentConfidence: "missing",
  previousBoostTotal: 0,
  originalMatchScore: 62,
});
assert.equal(largeBoost.boostPercent >= 9, true);
assert.equal(largeBoost.boostPercent <= 15, true);

const cappedCarefulBoost = calculateGapAnswerBoost({
  output: careful,
  importance: "high",
  currentConfidence: "missing",
  previousBoostTotal: 19,
  originalMatchScore: 42,
});
assert.equal(cappedCarefulBoost.boostPercent, 1);
assert.notEqual(cappedCarefulBoost.boostBand, "large");

const unsavedBoost = calculateGapAnswerBoost({
  output: clarification,
  importance: "high",
  currentConfidence: "missing",
  previousBoostTotal: 4,
  originalMatchScore: 60,
});
assert.deepEqual(unsavedBoost, {
  boostPercent: 0,
  boostBand: "none",
  totalBoostPercent: 4,
});

const memoryChunk = buildGapAnswerEvidenceChunk({
  anonymousSessionId: "anon",
  sourceApplicationId: "app",
  gapAnswerId: "answer",
  gapQuestionId: "gap-1",
  targetRequirementId: "req-1",
  targetRequirementLabel: "Relevant delivery",
  selectedOption: null,
  followUpText: null,
  metricText: null,
  answerText: strong.extractedEvidenceSummary,
  trustLevel: "usable",
  rawUserAnswer: "Raw user assertion.",
  extractedEvidenceSummary: strong.extractedEvidenceSummary,
  evidenceQuality: "strong",
  boostPercent: 11,
  originalQuestion: input.gapQuestion.question,
  source: "gap_question_chat",
});
assert.ok(memoryChunk);
assert.equal(memoryChunk.content, strong.extractedEvidenceSummary);
assert.equal(memoryChunk.metadata.trustLevel, "usable");
assert.equal(memoryChunk.metadata.source, "gap_question_chat");
assert.equal(memoryChunk.metadata.rawUserAnswer, "Raw user assertion.");

console.log("Gap answer evaluator tests passed.");
