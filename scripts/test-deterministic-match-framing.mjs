import assert from "node:assert/strict";

import { buildDeterministicMatchFraming } from "../src/lib/deterministicMatchFraming.ts";
import { selectGapQuestionTargets } from "../src/lib/gapQuestionSelection.ts";

const requirements = [
  {
    id: "req-rag",
    label: "RAG systems",
    description: "Build retrieval-augmented generation systems.",
    importance: "high",
  },
  {
    id: "req-collab",
    label: "Cross-functional collaboration",
    description: "Work with product, design, research, clients, or other stakeholders.",
    importance: "high",
  },
  {
    id: "req-latency",
    label: "Latency and cost optimization",
    description: "Measure or improve latency, cost, reliability, throughput, or response quality.",
    importance: "high",
  },
  {
    id: "req-typescript",
    label: "TypeScript",
    description: "Use TypeScript in application development.",
    importance: "medium",
  },
  {
    id: "req-ownership",
    label: "Project ownership",
    description: "Own delivery of project work.",
    importance: "medium",
  },
  {
    id: "req-scope",
    label: "Usage scope",
    description: "Show user, customer, or impact scope.",
    importance: "medium",
  },
];

const fitScores = [
  {
    jobRequirementId: "req-rag",
    finalConfidence: "high",
    bestCandidateChunkId: "chunk-rag",
    reason: "Direct project evidence shows RAG application work.",
  },
  {
    jobRequirementId: "req-collab",
    finalConfidence: "missing",
    bestCandidateChunkId: null,
    reason: "No direct stakeholder or collaboration evidence was found.",
  },
  {
    jobRequirementId: "req-latency",
    finalConfidence: "low",
    bestCandidateChunkId: "chunk-platform",
    reason: "Evidence is adjacent but lacks measured latency, cost, or reliability outcomes.",
  },
  {
    jobRequirementId: "req-typescript",
    finalConfidence: "medium",
    bestCandidateChunkId: "chunk-ts",
    reason: "Relevant TypeScript evidence exists but the project scope is incomplete.",
  },
  {
    jobRequirementId: "req-ownership",
    finalConfidence: "low",
    bestCandidateChunkId: "chunk-project",
    reason: "Some delivery evidence exists but ownership is unclear.",
  },
  {
    jobRequirementId: "req-scope",
    finalConfidence: "medium",
    bestCandidateChunkId: "chunk-project",
    reason: "Relevant project evidence exists but user scope and impact are incomplete.",
  },
];

const targetByRequirement = new Map(requirements.map((requirement) => [requirement.id, requirement]));
const targets = selectGapQuestionTargets(
  fitScores.flatMap((fit) => {
    const requirement = targetByRequirement.get(fit.jobRequirementId);
    if (!requirement) return [];
    return {
      jobRequirementId: requirement.id,
      label: requirement.label,
      description: requirement.description,
      importance: requirement.importance,
      finalConfidence: fit.finalConfidence,
      reason: fit.reason,
    };
  })
);
assert.deepEqual(
  targets.map((target) => target.jobRequirementId),
  ["req-collab", "req-latency", "req-ownership"],
  "gap targets should include only low or missing requirement IDs"
);

const framing = buildDeterministicMatchFraming({
  job: {
    title: "Applied AI Engineer",
    company: "Taylor Labs",
    summary: "Build applied AI products with strong evidence and practical delivery.",
    roleDomain: "software_ai_data",
    archetypeHint: "applied_ai_engineering",
  },
  candidateProfileSummary: "Candidate has RAG and TypeScript project evidence.",
  metricOpportunities: ["Add usage counts."],
  scopeOpportunities: ["Clarify project ownership."],
  requirements,
  fitScores,
  evidenceMatches: [
    { jobRequirementId: "req-rag", claimRisk: "safe", cvUsefulness: "headline" },
    { jobRequirementId: "req-typescript", claimRisk: "careful_wording", cvUsefulness: "supporting" },
    { jobRequirementId: "req-latency", claimRisk: "careful_wording", cvUsefulness: "keyword_only" },
  ],
  gapTargets: targets,
  scoreSummary: { score: 63 },
});

assert.equal(framing.matchLabel, "Promising evidence match");
assert.equal(
  framing.topStrengths.some((strength) => strength.includes("RAG systems")),
  true,
  "strengths should derive from strongest supported fits"
);
assert.equal(
  framing.weakSpots.some((spot) => spot.includes("Cross-functional collaboration")),
  true,
  "weak spots should derive from missing or weak strategic fits"
);
assert.equal(framing.coachInsight.candidateStrengths.length > 0, true);
assert.equal(framing.coachInsight.candidateConcerns.length > 0, true);
assert.equal(framing.cvAngle.includes("Lead with"), true);
assert.equal(framing.roleArchetype, "applied ai engineering");

console.log("Deterministic match framing tests passed.");
