import assert from "node:assert/strict";

import {
  calculateEvidenceMatchScoreFromRows,
  confidenceValue,
  importanceWeight,
} from "../src/lib/scoring.ts";
import { buildEvidenceMatchPersistencePlan } from "../src/lib/evidenceMatchPersistence.ts";

function fitScore({ importance, confidence }) {
  const possiblePoints = importanceWeight(importance);
  const value = confidenceValue(confidence);

  return {
    finalConfidence: confidence,
    bestCandidateChunkId: confidence === "missing" ? null : "chunk-1",
    earnedPoints: possiblePoints * value,
    possiblePoints,
  };
}

const rows = [
  fitScore({ importance: "high", confidence: "high" }),
  fitScore({ importance: "high", confidence: "weak" }),
  fitScore({ importance: "medium", confidence: "missing" }),
  fitScore({ importance: "low", confidence: "medium" }),
];

assert.equal(rows.length, 4, "one fit score row should exist per requirement");
assert.equal(
  rows.filter((row) => row.finalConfidence === "missing")[0]
    ?.bestCandidateChunkId,
  null,
  "missing confidence must not point at an unrelated chunk"
);

const score = calculateEvidenceMatchScoreFromRows(rows);
const expectedEarned = 5 * 1 + 5 * 0.3 + 3 * 0 + 1 * 0.65;
const expectedPossible = 5 + 5 + 3 + 1;

assert.equal(score.earnedPoints, expectedEarned);
assert.equal(score.possiblePoints, expectedPossible);
assert.equal(score.score, Math.round((expectedEarned / expectedPossible) * 100));

const traceRowsForOneRequirement = [
  { candidateChunkId: "chunk-a", similarityScore: 0.81 },
  { candidateChunkId: "chunk-b", similarityScore: 0.74 },
  { candidateChunkId: "chunk-c", similarityScore: 0.7 },
];
const requirementFitRows = [fitScore({ importance: "high", confidence: "high" })];

assert.equal(
  calculateEvidenceMatchScoreFromRows(requirementFitRows).possiblePoints,
  5,
  "top retrieved evidence_matches rows must not be double-counted"
);
assert.equal(traceRowsForOneRequirement.length, 3);

const fakeChunkPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-rag", label: "RAG", importance: "high" }],
  output: {
    requirementFitSummary: [
      {
        requirementId: "req-rag",
        confidence: "high",
        bestCandidateChunkId: "chunk-rag",
        reason: "Agent selected a fake fixture ID.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
    ],
  },
  retrievedEvidenceByRequirement: {
    "req-rag": [{ id: "real-db-chunk-1", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["real-db-chunk-1"]),
});

assert.equal(fakeChunkPlan.rejectedMatches.length, 1);
assert.equal(fakeChunkPlan.rejectedMatches[0]?.rejectedCandidateChunkId, "chunk-rag");
assert.equal(fakeChunkPlan.evidenceMatches[0]?.candidateChunkId, null);
assert.equal(fakeChunkPlan.evidenceMatches[0]?.confidence, "missing");
assert.equal(fakeChunkPlan.requirementFitScores[0]?.bestCandidateChunkId, null);

const validChunkPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-rag", label: "RAG", importance: "high" }],
  output: {
    requirementFitSummary: [
      {
        requirementId: "req-rag",
        confidence: "high",
        bestCandidateChunkId: "real-db-chunk-1",
        reason: "Agent selected a persisted chunk ID.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
    ],
  },
  retrievedEvidenceByRequirement: {
    "req-rag": [{ id: "real-db-chunk-1", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["real-db-chunk-1"]),
});

assert.equal(validChunkPlan.rejectedMatches.length, 0);
assert.equal(validChunkPlan.evidenceMatches[0]?.candidateChunkId, "real-db-chunk-1");
assert.equal(validChunkPlan.requirementFitScores[0]?.bestCandidateChunkId, "real-db-chunk-1");

console.log("Deterministic scoring tests passed.");
