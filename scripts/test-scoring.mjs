import assert from "node:assert/strict";

import { calibrateEvidenceConfidence } from "../src/lib/evidenceScoringCalibration.ts";
import {
  calculateEvidenceMatchScoreFromRows,
  confidenceValue,
  importanceWeight,
} from "../src/lib/scoring.ts";
import { buildEvidenceMatchPersistencePlan } from "../src/lib/evidenceMatchPersistence.ts";
import { buildEvidenceFitScorerPayload } from "../src/lib/evidenceFitScorerPayload.ts";

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
  fitScore({ importance: "high", confidence: "low" }),
  fitScore({ importance: "medium", confidence: "missing" }),
  fitScore({ importance: "low", confidence: "medium" }),
];

assert.equal(rows.length, 4, "one fit score row should exist per requirement");
assert.equal(
  rows.filter((row) => row.finalConfidence === "missing")[0]?.bestCandidateChunkId,
  null,
  "missing confidence must not point at an unrelated chunk"
);

const score = calculateEvidenceMatchScoreFromRows(rows);
const expectedEarned = 5 * 1 + 5 * 0.3 + 3 * 0 + 1 * 0.65;
const expectedPossible = 5 + 5 + 3 + 1;

assert.equal(score.earnedPoints, expectedEarned);
assert.equal(score.possiblePoints, expectedPossible);
assert.equal(score.score, Math.round((expectedEarned / expectedPossible) * 100));

const invalidChunkPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-rag", label: "RAG", importance: "high" }],
  output: {
    requirementFitByRequirementId: {
      "req-rag": {
        confidence: "high",
        selectedEvidenceIndex: 4,
        reason: "Agent selected an unavailable local index.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-rag": [{ id: "real-db-chunk-1", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["real-db-chunk-1"]),
});

assert.equal(invalidChunkPlan.rejectedMatches.length, 1);
assert.equal(invalidChunkPlan.rejectedMatches[0]?.selectedEvidenceIndex, 4);
assert.equal(
  invalidChunkPlan.evidenceMatches.length,
  0,
  "invalid non-missing evidence indexes must not be silently persisted as missing"
);
assert.equal(
  invalidChunkPlan.requirementFitScores.length,
  0,
  "invalid non-missing selections must force repair or abort before fit rows are stored"
);

const missingSelectedChunkPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-rag", label: "RAG", importance: "high" }],
  output: {
    requirementFitByRequirementId: {
      "req-rag": {
        confidence: "medium",
        selectedEvidenceIndex: null,
        reason: "Agent omitted the supporting chunk.",
        claimRisk: "careful_wording",
        cvUsefulness: "supporting",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-rag": [{ id: "real-db-chunk-1", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["real-db-chunk-1"]),
});
assert.equal(missingSelectedChunkPlan.rejectedMatches.length, 1);
assert.equal(
  missingSelectedChunkPlan.rejectedMatches[0]?.reason,
  "Non-missing confidence must include a selected evidence index."
);

const validChunkPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-rag", label: "RAG", importance: "high" }],
  output: {
    requirementFitByRequirementId: {
      "req-rag": {
        confidence: "high",
        selectedEvidenceIndex: 0,
        reason: "Agent selected a provided local evidence index.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-rag": [{ id: "real-db-chunk-1", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["real-db-chunk-1"]),
});

assert.equal(validChunkPlan.rejectedMatches.length, 0);
assert.equal(validChunkPlan.evidenceMatches[0]?.candidateChunkId, "real-db-chunk-1");
assert.equal(validChunkPlan.requirementFitScores[0]?.bestCandidateChunkId, "real-db-chunk-1");

const missingPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-none", label: "Rust", importance: "medium" }],
  output: {
    requirementFitByRequirementId: {
      "req-none": {
        confidence: "missing",
        selectedEvidenceIndex: null,
        reason: "No useful evidence exists.",
        claimRisk: "avoid_claim",
        cvUsefulness: "do_not_use",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-none": [],
  },
  validCandidateChunkIds: new Set(),
});
assert.equal(missingPlan.rejectedMatches.length, 0);
assert.equal(missingPlan.evidenceMatches[0]?.candidateChunkId, null);
assert.equal(missingPlan.requirementFitScores[0]?.finalConfidence, "missing");

const missingWithIndexPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-none", label: "Rust", importance: "medium" }],
  output: {
    requirementFitByRequirementId: {
      "req-none": {
        confidence: "missing",
        selectedEvidenceIndex: 0,
        reason: "No useful evidence exists.",
        claimRisk: "avoid_claim",
        cvUsefulness: "do_not_use",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-none": [{ id: "not-usable-for-missing", similarityScore: 0.3 }],
  },
  validCandidateChunkIds: new Set(["not-usable-for-missing"]),
});
assert.equal(missingWithIndexPlan.rejectedMatches.length, 1);
assert.equal(
  missingWithIndexPlan.rejectedMatches[0]?.reason,
  "Missing confidence must use a null selected evidence index."
);

const localIndexPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [
    { id: "req-a", label: "Requirement A", importance: "high" },
    { id: "req-b", label: "Requirement B", importance: "high" },
  ],
  output: {
    requirementFitByRequirementId: {
      "req-a": {
        confidence: "high",
        selectedEvidenceIndex: 0,
        reason: "Valid for requirement A.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
      "req-b": {
        confidence: "high",
        selectedEvidenceIndex: 0,
        reason: "Valid for requirement B.",
        claimRisk: "safe",
        cvUsefulness: "headline",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-a": [{ id: "local-chunk", similarityScore: 0.88 }],
    "req-b": [{ id: "chunk-only-for-b", similarityScore: 0.91 }],
  },
  validCandidateChunkIds: new Set(["local-chunk", "chunk-only-for-b"]),
});
assert.equal(
  localIndexPlan.rejectedMatches.length,
  0,
  "selectedEvidenceIndex must be interpreted within each requirement's local evidence list"
);
assert.deepEqual(
  localIndexPlan.evidenceMatches.map((match) => match.candidateChunkId),
  ["local-chunk", "chunk-only-for-b"]
);

const orderedScorerInputPlan = buildEvidenceMatchPersistencePlan({
  applicationId: "app-1",
  jobRequirements: [{ id: "req-order", label: "Ordered retrieval", importance: "high" }],
  output: {
    requirementFitByRequirementId: {
      "req-order": {
        confidence: "medium",
        selectedEvidenceIndex: 0,
        reason: "Agent selected the first evidence item it saw.",
        claimRisk: "careful_wording",
        cvUsefulness: "supporting",
      },
    },
  },
  evidenceRefsByRequirement: {
    "req-order": [
      { id: "chunk-second-by-score", similarityScore: 0.2 },
      { id: "chunk-first-by-score", similarityScore: 0.99 },
    ],
  },
  validCandidateChunkIds: new Set(["chunk-second-by-score", "chunk-first-by-score"]),
});
assert.equal(orderedScorerInputPlan.rejectedMatches.length, 0);
assert.equal(
  orderedScorerInputPlan.evidenceMatches[0]?.candidateChunkId,
  "chunk-second-by-score",
  "selectedEvidenceIndex must map against the exact ordered evidence list sent to the scorer"
);

const scorerPayload = buildEvidenceFitScorerPayload({
  parsedJob: { title: "AI Engineer" },
  requirements: [
    { id: "req-a", label: "Requirement A", description: "First requirement.", importance: "high" },
    { id: "req-b", label: "Requirement B", description: "Second requirement.", importance: "high" },
  ],
  candidateProfileSummary: "Candidate summary.",
  metricOpportunities: [],
  scopeOpportunities: [],
  roleDomain: "software_ai_data",
  archetypeHint: "applied_ai_engineering",
  retrievedEvidenceByRequirement: {
    "req-a": [
      {
        id: "real-db-chunk-a",
        displayLabel: "R1E1",
        content: "  Evidence for A.   ",
        similarityScore: 0.912345,
        chunkType: "project",
        sourceType: "cv_upload",
        tagsJson: ["private-tag"],
        metadataJson: { sourceKey: "private-source-key" },
      },
    ],
    "req-b": [
      {
        id: "real-db-chunk-b",
        displayLabel: "R2E1",
        content: "Evidence for B.",
        similarityScore: 0.812345,
        chunkType: "experience",
        sourceType: "cv_upload",
        tagsJson: ["private-tag-b"],
        metadataJson: { sourceKey: "private-source-key-b" },
      },
    ],
  },
});
const scorerPayloadText = JSON.stringify(scorerPayload);
assert.equal(
  scorerPayloadText.includes("real-db-chunk"),
  false,
  "scorer payload must not expose real candidate chunk IDs"
);
assert.equal(scorerPayloadText.includes("displayLabel"), false);
assert.equal(scorerPayloadText.includes("tagsJson"), false);
assert.equal(scorerPayloadText.includes("metadataJson"), false);
assert.equal(
  scorerPayload.retrievedEvidenceByRequirement["req-a"]?.[0]?.evidenceIndex,
  0,
  "evidenceIndex remains local to each requirement"
);
assert.equal(
  scorerPayload.retrievedEvidenceByRequirement["req-b"]?.[0]?.evidenceIndex,
  0,
  "same evidenceIndex value is valid under a different requirement"
);
assert.equal(
  scorerPayload.retrievedEvidenceByRequirement["req-a"]?.[0]?.content,
  "Evidence for A.",
  "scorer evidence content should be whitespace-normalized without truncation"
);

assert.equal(
  calibrateEvidenceConfidence({
    requirementLabel: "RAG and retrieval systems",
    evidenceContent:
      "Built a document-grounded RAG chatbot using OpenAI, PostgreSQL, pgvector, and TypeScript.",
    similarityScore: 0.9,
  }),
  "high",
  "direct explicit proof can be high"
);
assert.equal(
  calibrateEvidenceConfidence({
    requirementLabel: "Cross-functional collaboration",
    requirementDescription: "Work with product, design, research, clients, and stakeholders.",
    evidenceContent: "Owned product direction and shipped an MVP independently.",
    similarityScore: 0.82,
  }),
  "low",
  "adjacent product ownership should be low, not automatically medium"
);
assert.equal(
  calibrateEvidenceConfidence({
    requirementLabel: "Latency, cost, and reliability optimization",
    evidenceContent: "Deployed a backend with PostgreSQL and Docker.",
    similarityScore: 0.86,
  }),
  "low",
  "deployment/infrastructure evidence alone should not become medium optimization proof"
);
assert.equal(
  calibrateEvidenceConfidence({
    requirementLabel: "Rust programming",
    evidenceContent: "",
    similarityScore: 0,
  }),
  "missing",
  "no evidence should be missing"
);

console.log("Deterministic scoring tests passed.");
