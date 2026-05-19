import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { GapQuestionAgentOutputSchema } from "../src/lib/schemas.ts";
import { selectGapQuestionTargets } from "../src/lib/gapQuestionSelection.ts";
import {
  buildGapQuestionJsonSchema,
  mockGapQuestionOutput,
} from "../src/lib/gapQuestionAgentContract.ts";

const targets = [
  {
    jobRequirementId: "high-strong",
    label: "Strong requirement",
    description: "Already supported",
    importance: "high",
    finalConfidence: "high",
    reason: "Strong evidence exists.",
  },
  {
    jobRequirementId: "medium-missing",
    label: "Medium missing",
    description: "Missing medium priority",
    importance: "medium",
    finalConfidence: "missing",
    reason: "No evidence found.",
  },
  {
    jobRequirementId: "high-medium",
    label: "High medium",
    description: "Important partial evidence with unclear scope",
    importance: "high",
    finalConfidence: "medium",
    reason: "Partial evidence found.",
  },
  {
    jobRequirementId: "high-low",
    label: "High low",
    description: "Important low evidence",
    importance: "high",
    finalConfidence: "low",
    reason: "Weak evidence found.",
  },
  {
    jobRequirementId: "high-missing",
    label: "High missing",
    description: "Important missing evidence",
    importance: "high",
    finalConfidence: "missing",
    reason: "No evidence found.",
  },
];

const selected = selectGapQuestionTargets(targets);
assert.deepEqual(
  selected.map((target) => target.jobRequirementId),
  ["high-missing", "high-low", "medium-missing"]
);
assert.equal(
  selected.some((target) => target.finalConfidence === "high"),
  false,
  "high confidence requirements must not be gap-question targets"
);
assert.equal(
  selected.some((target) => target.finalConfidence === "medium"),
  false,
  "medium confidence requirements must not be gap-question targets"
);

const validOutput = {
  questions: [
    {
      targetRequirementId: "high-missing",
      question: "Have you done this work in a real project? What did you do?",
      reason: "The current evidence does not show this requirement.",
      whyItMatters: "A real example could materially strengthen the CV.",
      answerGuidance: "Share the context, your role, and the result.",
      exampleAnswer:
        "Example: Yes, I owned the backend change and shipped it into a working product flow.",
      exampleAngles: ["Context", "Role", "Result"],
    },
  ],
};
assert.equal(GapQuestionAgentOutputSchema.safeParse(validOutput).success, true);
assert.equal(
  GapQuestionAgentOutputSchema.safeParse({
    questions: [validOutput.questions[0], validOutput.questions[0], validOutput.questions[0], validOutput.questions[0]],
  }).success,
  false,
  "schema must enforce at most three questions"
);

const jsonSchema = buildGapQuestionJsonSchema({
  job: {
    title: "AI Engineer",
    company: "Taylor Labs",
    summary: "Build AI applications.",
  },
  candidateContext: {
    summary: "Candidate summary.",
    strongestAreas: ["RAG"],
  },
  targets: selected,
});
assert.deepEqual(
  jsonSchema.properties.questions.items.properties.targetRequirementId.enum,
  ["high-missing", "high-low", "medium-missing"],
  "structured output must restrict question targets to weak requirement IDs"
);

const duplicateThemeOutput = mockGapQuestionOutput({
  job: {
    title: "Product Engineer",
    company: null,
    summary: "Collaborate with product, design, and customers.",
  },
  candidateContext: {
    summary: "Candidate summary.",
    strongestAreas: [],
  },
  targets: [
    {
      jobRequirementId: "stakeholders",
      label: "Stakeholder collaboration",
      description: "Work with stakeholders and product teams.",
      importance: "high",
      finalConfidence: "missing",
      reason: "No stakeholder proof.",
    },
    {
      jobRequirementId: "design",
      label: "Design collaboration",
      description: "Work with product and design partners.",
      importance: "high",
      finalConfidence: "missing",
      reason: "No design collaboration proof.",
    },
    {
      jobRequirementId: "reliability",
      label: "Reliability improvement",
      description: "Improve reliability or latency.",
      importance: "medium",
      finalConfidence: "low",
      reason: "Only thin optimization evidence.",
    },
  ],
});
assert.equal(duplicateThemeOutput.questions.length, 2);
assert.equal(
  duplicateThemeOutput.questions.filter((question) =>
    /stakeholder|teams|collaboration/i.test(question.question)
  ).length,
  1,
  "mock gap agent should avoid near-duplicate collaboration themes"
);
assert.equal(
  duplicateThemeOutput.questions.every((question) => question.exampleAnswer),
  true,
  "every question must include an example answer"
);

const workflowSource = readFileSync("src/server/services/applicationWorkflow.service.ts", "utf8");
assert.equal(
  workflowSource.includes("deterministic gap question generation"),
  false,
  "old deterministic gap question timing path must be removed"
);
assert.equal(
  workflowSource.includes("buildDeterministicGapQuestions"),
  false,
  "old deterministic gap question builder must not be used"
);
assert.equal(
  workflowSource.includes("Gap Question Agent"),
  true,
  "workflow must time the dedicated gap question agent"
);

const scorerPrompt = readFileSync("src/server/prompts/evidenceFitScorer.prompt.ts", "utf8");
const scorerAgent = readFileSync("src/server/agents/evidenceFitScorer.agent.ts", "utf8");
assert.equal(/gap questions?|recommendedGapQuestions/i.test(scorerPrompt), false);
assert.equal(/gapQuestionsGeneratedBy|recommendedGapQuestions/i.test(scorerAgent), false);

console.log("Gap question agent tests passed.");
