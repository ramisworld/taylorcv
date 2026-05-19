import assert from "node:assert/strict";

import {
  selectBalancedMatchPreviewFits,
  selectMatchSnapshotFits,
} from "../src/lib/matchSnapshotSelection.ts";

const fits = [
  {
    jobRequirementId: "strong-1",
    finalConfidence: "high",
    jobRequirement: { id: "strong-1", label: "RAG", importance: "high" },
  },
  {
    jobRequirementId: "strong-2",
    finalConfidence: "high",
    jobRequirement: { id: "strong-2", label: "LLM APIs", importance: "high" },
  },
  {
    jobRequirementId: "strong-3",
    finalConfidence: "high",
    jobRequirement: { id: "strong-3", label: "Backend", importance: "medium" },
  },
  {
    jobRequirementId: "strong-4",
    finalConfidence: "high",
    jobRequirement: { id: "strong-4", label: "TypeScript", importance: "medium" },
  },
  {
    jobRequirementId: "medium-collaboration",
    finalConfidence: "medium",
    jobRequirement: {
      id: "medium-collaboration",
      label: "Cross-functional collaboration",
      importance: "high",
    },
  },
  {
    jobRequirementId: "low-optimization",
    finalConfidence: "low",
    jobRequirement: {
      id: "low-optimization",
      label: "Latency and cost optimization",
      importance: "high",
    },
  },
];

const selected = selectMatchSnapshotFits({
  fits,
  topRequirementIds: fits.map((fit) => fit.jobRequirementId),
  gapQuestions: [
    {
      targetRequirementId: "medium-collaboration",
      status: "unanswered",
    },
  ],
});

assert.deepEqual(
  selected.map((fit) => fit.jobRequirementId),
  ["strong-1", "strong-2", "medium-collaboration", "low-optimization"]
);
assert.equal(
  selected.filter((fit) => fit.finalConfidence === "high").length,
  2,
  "snapshot should not render four Strong rows when improvement opportunities exist"
);
assert.equal(
  selected.some((fit) => fit.finalConfidence === "medium" || fit.finalConfidence === "low"),
  true,
  "snapshot should show strengths plus improvement opportunities"
);

const balancedFits = [
  {
    jobRequirementId: "high-1",
    finalConfidence: "high",
    jobRequirement: { id: "high-1", label: "AI development", importance: "high" },
  },
  {
    jobRequirementId: "high-2",
    finalConfidence: "high",
    jobRequirement: { id: "high-2", label: "Backend systems", importance: "medium" },
  },
  {
    jobRequirementId: "medium-1",
    finalConfidence: "medium",
    jobRequirement: { id: "medium-1", label: "Cloud", importance: "high" },
  },
  {
    jobRequirementId: "low-1",
    finalConfidence: "low",
    jobRequirement: { id: "low-1", label: "Data engineering", importance: "high" },
  },
  {
    jobRequirementId: "low-2",
    finalConfidence: "low",
    jobRequirement: { id: "low-2", label: "Observability", importance: "medium" },
  },
  {
    jobRequirementId: "missing-1",
    finalConfidence: "missing",
    jobRequirement: { id: "missing-1", label: "Leadership", importance: "high" },
  },
];

assert.deepEqual(
  selectBalancedMatchPreviewFits({
    fits: balancedFits,
    topRequirementIds: balancedFits.map((fit) => fit.jobRequirementId),
  }).map((fit) => fit.finalConfidence),
  ["high", "medium", "low", "missing"],
  "balanced preview should select one high, medium, low, and missing when available"
);

assert.deepEqual(
  selectBalancedMatchPreviewFits({
    fits: balancedFits.filter((fit) => fit.finalConfidence !== "missing"),
    topRequirementIds: balancedFits.map((fit) => fit.jobRequirementId),
  }).map((fit) => fit.finalConfidence),
  ["high", "medium", "low", "low"],
  "balanced preview should add an extra low row when missing does not exist"
);

assert.deepEqual(
  selectBalancedMatchPreviewFits({
    fits: balancedFits.filter((fit) => fit.finalConfidence !== "medium"),
    topRequirementIds: balancedFits.map((fit) => fit.jobRequirementId),
  }).map((fit) => fit.finalConfidence),
  ["high", "low", "missing", "high"],
  "balanced preview should add the strongest extra row when medium does not exist"
);

const onlyHighFits = balancedFits
  .filter((fit) => fit.finalConfidence === "high")
  .concat([
    {
      jobRequirementId: "high-3",
      finalConfidence: "high",
      jobRequirement: { id: "high-3", label: "Frontend", importance: "low" },
    },
    {
      jobRequirementId: "high-4",
      finalConfidence: "high",
      jobRequirement: { id: "high-4", label: "APIs", importance: "low" },
    },
  ]);

assert.deepEqual(
  selectBalancedMatchPreviewFits({
    fits: onlyHighFits,
    topRequirementIds: onlyHighFits.map((fit) => fit.jobRequirementId),
  }).map((fit) => fit.jobRequirementId),
  ["high-1", "high-2", "high-3", "high-4"],
  "balanced preview should return up to four high rows when only high rows exist"
);

console.log("Match snapshot selection tests passed.");
