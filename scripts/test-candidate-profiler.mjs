import assert from "node:assert/strict";

import {
  expandCandidateProfilerOutput,
  extractCandidateContactAndLinks,
} from "../src/lib/candidateProfilerPostprocess.ts";
import {
  CandidateProfilerAgentOutputSchema,
  CandidateProfilerOutputSchema,
} from "../src/lib/schemas.ts";
import { buildEvidenceChunksFromProfile } from "../src/server/services/evidenceChunkBuilder.service.ts";

const rawCvText = [
  "Ava Taylor",
  "Applied AI Engineer",
  "ava.taylor@example.com | +64 21 555 0199 | Auckland",
  "https://www.linkedin.com/in/avataylor",
  "github.com/avataylor",
  "https://avataylor.dev",
  "Built a RAG support assistant with PostgreSQL, pgvector, TypeScript, and OpenAI.",
].join("\n");

const extracted = extractCandidateContactAndLinks(rawCvText);
assert.equal(extracted.contactInfo.email, "ava.taylor@example.com");
assert.equal(extracted.contactInfo.phone, "+64 21 555 0199");
assert.equal(extracted.links.linkedin, "https://www.linkedin.com/in/avataylor");
assert.equal(extracted.links.github, "https://github.com/avataylor");
assert.equal(extracted.links.portfolio, "https://avataylor.dev");

const minimalOutput = {
  contactInfo: {
    fullName: "Ava Taylor",
    professionalTitle: "Applied AI Engineer",
    location: "Auckland",
  },
  summary:
    "Applied AI engineer with RAG, TypeScript, PostgreSQL, pgvector, and production workflow experience.",
  skills: ["RAG", "TypeScript", "PostgreSQL", "pgvector"],
  projects: [
    {
      name: "RAG Support Assistant",
      description:
        "Built a document-grounded support assistant using PostgreSQL, pgvector, TypeScript, and OpenAI.",
      tools: ["PostgreSQL", "pgvector", "TypeScript", "OpenAI"],
      outcomes: ["Improved answer grounding and support response quality."],
      links: [],
    },
  ],
  experience: [
    {
      role: "Applied AI Engineer",
      organization: "ExampleCo",
      startDate: "2024",
      endDate: null,
      current: true,
      description:
        "Built retrieval workflows and production-facing AI application features.",
      bullets: [
        "Delivered RAG workflows with PostgreSQL, pgvector, TypeScript, and OpenAI.",
      ],
      technologies: ["TypeScript", "PostgreSQL", "pgvector"],
      tools: ["OpenAI", "Prisma"],
      achievements: ["Reduced unsupported answer risk through source-grounded responses."],
      outcomes: ["Improved answer quality for support workflows."],
    },
  ],
  education: [],
  certifications: [],
  tools: ["OpenAI", "Prisma"],
  achievements: ["Shipped source-grounded AI workflow improvements."],
  cautionNotes: [],
};

assert.equal(CandidateProfilerAgentOutputSchema.safeParse(minimalOutput).success, true);
const expanded = expandCandidateProfilerOutput({
  rawCvText,
  output: minimalOutput,
});
assert.equal(CandidateProfilerOutputSchema.safeParse(expanded).success, true);
assert.equal(expanded.contactInfo.email, "ava.taylor@example.com");
assert.equal(expanded.links.github, "https://github.com/avataylor");
assert.equal(expanded.sourceSummary.includes("CV parsed into"), true);
assert.equal(Array.isArray(expanded.metricOpportunities), true);
assert.equal(Array.isArray(expanded.scopeOpportunities), true);
assert.equal(expanded.strongProofCandidates.length > 0, true);
assert.equal(expanded.likelyTopEvidence.length > 0, true);

const chunks = buildEvidenceChunksFromProfile({
  anonymousSessionId: "candidate-profiler-test-session",
  sourceApplicationId: "candidate-profiler-test-app",
  candidateProfileId: "candidate-profiler-test-profile",
  profile: expanded,
});
assert.equal(chunks.length >= 2, true);
assert.equal(
  chunks.some((chunk) => /RAG Support Assistant|Delivered RAG workflows/.test(chunk.content)),
  true,
  "post-processed profiler output must still build useful evidence chunks"
);

const malformed = extractCandidateContactAndLinks("No contact details here.");
assert.equal(malformed.contactInfo.email, null);
assert.equal(malformed.contactInfo.phone, null);
assert.equal(malformed.links.linkedin, null);
assert.deepEqual(malformed.links.other, []);

console.log("Candidate profiler contract tests passed.");
