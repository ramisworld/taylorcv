import { readFileSync } from "fs";

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const seedApplicationId = "seed-application";
const seedAnonymousSessionId = "seed-anonymous-session";

function loadDotEnv() {
  const envFile = readFileSync(".env", "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = valueParts
      .join("=")
      .trim()
      .replace(/^"|"$/g, "");
  }
}

const expectedMatches = [
  {
    requirementPattern: /rag/i,
    expectedChunkId: "seed-chunk-rag",
  },
  {
    requirementPattern: /agents?|tool calling/i,
    expectedChunkId: "seed-chunk-agents",
  },
  {
    requirementPattern: /pgvector|vector|postgres/i,
    expectedChunkId: "seed-chunk-pgvector",
  },
  {
    requirementPattern: /next\.?js|typescript|trpc/i,
    expectedChunkId: "seed-chunk-next-typescript",
  },
  {
    requirementPattern: /deployment|server|ollama/i,
    expectedChunkId: "seed-chunk-deployment",
  },
];

function expectedChunkForRequirement(requirement) {
  const text = `${requirement.label} ${requirement.description}`;
  return expectedMatches.find((match) => match.requirementPattern.test(text))
    ?.expectedChunkId;
}

async function main() {
  loadDotEnv();
  process.env.USE_MOCK_AI = "true";

  if (process.env.USE_MOCK_AI !== "true") {
    throw new Error("test:retrieval must run with USE_MOCK_AI=true");
  }

  const { searchCandidateChunks } = await import(
    "../src/server/tools/vectorSearch.tool.ts"
  );

  const application = await prisma.application.findFirst({
    where: {
      id: seedApplicationId,
      anonymousSessionId: seedAnonymousSessionId,
    },
    include: { job: { include: { requirements: true } } },
  });

  if (!application?.job) {
    throw new Error(
      "Seeded application/job not found. Run `npm run db:seed` first."
    );
  }

  let failures = 0;

  console.log("Retrieval-only pgvector test");
  console.log(`Application: ${seedApplicationId}`);
  console.log("");

  for (const requirement of application.job.requirements) {
    const expectedChunkId = expectedChunkForRequirement(requirement);
    const results = await searchCandidateChunks({
      anonymousSessionId: seedAnonymousSessionId,
      applicationId: seedApplicationId,
      requirementText: `${requirement.label}\n${requirement.description}`,
      topK: 3,
    });
    const retrievedIds = results.map((result) => result.id);
    const passed = expectedChunkId
      ? retrievedIds.includes(expectedChunkId)
      : true;

    if (!passed) failures += 1;

    console.log(`Requirement: ${requirement.label}`);
    console.log(`Expected: ${expectedChunkId ?? "no explicit expectation"}`);
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
    for (const result of results) {
      console.log(
        `  - ${result.id} | score=${Number(result.similarityScore).toFixed(4)}`
      );
      console.log(`    ${result.content}`);
    }
    console.log("");
  }

  if (failures > 0) {
    throw new Error(`${failures} retrieval expectation(s) failed`);
  }

  console.log("All retrieval expectations passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
