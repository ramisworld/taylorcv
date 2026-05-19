import assert from "node:assert/strict";
import { readFileSync } from "fs";

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

const rawCvText =
  "Built RAG applications with OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, deployment workflows, and grounded document Q&A.";

async function activeChunkCount(prisma, anonymousSessionId) {
  return prisma.candidateChunk.count({
    where: { anonymousSessionId, archivedAt: null },
  });
}

async function cleanup(prisma, anonymousSessionId) {
  const applications = await prisma.application.findMany({
    where: { anonymousSessionId },
    select: { id: true },
  });
  const applicationIds = applications.map((application) => application.id);
  await prisma.candidateChunk.deleteMany({
    where: {
      OR: [
        { anonymousSessionId },
        ...(applicationIds.length
          ? [{ sourceApplicationId: { in: applicationIds } }]
          : []),
      ],
    },
  });
  await prisma.candidateProfile.deleteMany({
    where: {
      OR: [
        { anonymousSessionId },
        ...(applicationIds.length
          ? [{ sourceApplicationId: { in: applicationIds } }]
          : []),
      ],
    },
  });
  await prisma.application.deleteMany({ where: { anonymousSessionId } });
  await prisma.anonymousSession.deleteMany({ where: { id: anonymousSessionId } });
}

async function main() {
  loadDotEnv();
  process.env.USE_MOCK_AI = "true";

  const { PrismaClient } = await import("../generated/prisma/index.js");
  const prisma = new PrismaClient();

  const {
    ensureRequirementQueryEmbeddings,
    searchCandidateMemoryForRequirements,
    upsertCandidateProfileMemory,
    upsertCandidateMemoryChunks,
  } = await import("../src/server/services/candidateMemory.service.ts");

  const anonymousSessionId = `memory-test-${Date.now()}`;
  const owner = { anonymousSessionId, userId: null };

  try {
    await cleanup(prisma, anonymousSessionId);
    await prisma.anonymousSession.create({ data: { id: anonymousSessionId } });

    const appA = await prisma.application.create({
      data: { anonymousSessionId, status: "started", currentStep: "started" },
    });
    const profileOutput = {
      contactInfo: {
        fullName: null,
        professionalTitle: "AI Application Builder",
        location: null,
        email: null,
        phone: null,
      },
      links: { linkedin: null, github: null, portfolio: null, other: [] },
      sourceSummary: "Memory test profile.",
      summary:
        "Full-stack AI builder with RAG, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment experience.",
      skills: ["RAG", "OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
      projects: [],
      experience: [],
      education: [],
      certifications: [],
      tools: ["OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
      achievements: ["Built grounded document Q&A workflows."],
      cautionNotes: [],
      metricOpportunities: [],
      strongProofCandidates: [],
      scopeOpportunities: [],
      likelyTopEvidence: [],
    };
    await upsertCandidateProfileMemory({
      owner,
      sourceApplicationId: appA.id,
      profileOutput,
      rawCvText,
      profileSource: "cv_upload",
    });
    await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appA.id,
          sourceType: "cv_upload",
          sourceId: "profile-rag",
          sourceKey: "cv_upload:profile-rag",
          chunkType: "project",
          content:
            "Built document-grounded RAG workflows with OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment.",
          tags: ["RAG", "OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
          metadata: { source: "profile" },
        },
      ],
    });
    const afterUploadCount = await activeChunkCount(prisma, anonymousSessionId);
    assert.equal(afterUploadCount > 0, true, "initial CV upload should create permanent memory chunks");

    const appB = await prisma.application.create({
      data: { anonymousSessionId, status: "started", currentStep: "started" },
    });
    const jobB = await prisma.job.create({
      data: {
        applicationId: appB.id,
        rawText: "Build RAG workflows with pgvector and TypeScript.",
        title: "AI Engineer",
        company: "Memory Test",
        seniority: "Mid-level",
        summary: "RAG and pgvector role.",
      },
    });
    const cachedRequirement = await prisma.jobRequirement.create({
      data: {
        jobId: jobB.id,
        type: "skill",
        label: "RAG and pgvector",
        description: "Build RAG workflows with pgvector and TypeScript.",
        importance: "high",
      },
    });
    await ensureRequirementQueryEmbeddings({
      requirements: [
        {
          id: cachedRequirement.id,
          label: cachedRequirement.label,
          description: cachedRequirement.description,
        },
      ],
      applicationId: appB.id,
    });
    const firstEmbeddingRow = await prisma.$queryRaw`
      SELECT
        query_embedding IS NOT NULL AS "hasEmbedding",
        query_embedding_model AS "model",
        query_embedding_input_hash AS "inputHash",
        query_embedded_at AS "embeddedAt"
      FROM job_requirements
      WHERE id = ${cachedRequirement.id}
      LIMIT 1
    `;
    assert.equal(firstEmbeddingRow[0]?.hasEmbedding, true, "requirement embedding should persist");
    assert.equal(firstEmbeddingRow[0]?.model, "mock-embedding");
    assert.ok(firstEmbeddingRow[0]?.inputHash);
    await ensureRequirementQueryEmbeddings({
      requirements: [
        {
          id: cachedRequirement.id,
          label: cachedRequirement.label,
          description: cachedRequirement.description,
        },
      ],
      applicationId: appB.id,
    });
    const secondEmbeddingRow = await prisma.$queryRaw`
      SELECT query_embedded_at AS "embeddedAt"
      FROM job_requirements
      WHERE id = ${cachedRequirement.id}
      LIMIT 1
    `;
    assert.deepEqual(
      secondEmbeddingRow[0]?.embeddedAt,
      firstEmbeddingRow[0]?.embeddedAt,
      "unchanged requirement text/model should reuse the stored embedding"
    );
    const legacyRequirement = await prisma.jobRequirement.create({
      data: {
        jobId: jobB.id,
        type: "tool",
        label: "Legacy embedding fallback",
        description: "Older requirement row with no stored vector yet.",
        importance: "medium",
      },
    });
    await ensureRequirementQueryEmbeddings({
      requirements: [
        {
          id: legacyRequirement.id,
          label: legacyRequirement.label,
          description: legacyRequirement.description,
        },
      ],
      applicationId: appB.id,
    });
    const legacyEmbeddingRow = await prisma.$queryRaw`
      SELECT query_embedding IS NOT NULL AS "hasEmbedding"
      FROM job_requirements
      WHERE id = ${legacyRequirement.id}
      LIMIT 1
    `;
    assert.equal(
      legacyEmbeddingRow[0]?.hasEmbedding,
      true,
      "old requirements without embeddings should compute and persist a fallback"
    );
    const appBRetrieval = await searchCandidateMemoryForRequirements({
      owner,
      requirements: [
        {
          id: "app-b-rag",
          label: "RAG and pgvector",
          description: "Build RAG workflows with pgvector and TypeScript.",
        },
      ],
      topK: 3,
    });
    const afterReuseCount = await activeChunkCount(prisma, anonymousSessionId);
    assert.equal(
      afterReuseCount,
      afterUploadCount,
      "using saved memory for a new application must not create or re-embed chunks"
    );
    assert.equal(appBRetrieval.get("app-b-rag")?.length > 0, true);

    await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appA.id,
          sourceType: "gap_answer",
          sourceId: "gap-red-team",
          sourceKey: "gap_answer:gap-red-team",
          chunkType: "gap_answer",
          content:
            "Created a red-team rubric for AI reliability checks on document Q&A answers.",
          tags: ["AI reliability", "gap_answer"],
          metadata: { gapAnswerId: "gap-red-team", trustLevel: "usable" },
        },
      ],
    });
    const gapChunk = await prisma.candidateChunk.findFirst({
      where: {
        anonymousSessionId,
        sourceType: "gap_answer",
        archivedAt: null,
      },
    });
    assert.ok(gapChunk, "gap answers should become permanent memory chunks");

    const gapRetrieval = await searchCandidateMemoryForRequirements({
      owner,
      requirements: [
        {
          id: "future-ai-reliability",
          label: "AI reliability evaluation",
          description: "Use red-team rubrics to evaluate document Q&A answers.",
        },
      ],
      topK: 3,
    });
    assert.equal(
      gapRetrieval.get("future-ai-reliability")?.some((chunk) => chunk.id === gapChunk.id),
      true,
      "future retrieval should find gap-answer memory"
    );

    const appC = await prisma.application.create({
      data: { anonymousSessionId, status: "started", currentStep: "started" },
    });
    const beforeReuploadCount = await activeChunkCount(prisma, anonymousSessionId);
    await upsertCandidateProfileMemory({
      owner,
      sourceApplicationId: appC.id,
      profileOutput,
      rawCvText,
      profileSource: "cv_upload",
    });
    await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appC.id,
          sourceType: "cv_upload",
          sourceId: "profile-rag",
          sourceKey: "cv_upload:profile-rag",
          chunkType: "project",
          content:
            "Built document-grounded RAG workflows with OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment.",
          tags: ["RAG", "OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
          metadata: { source: "profile" },
        },
      ],
    });
    assert.equal(
      await activeChunkCount(prisma, anonymousSessionId),
      beforeReuploadCount,
      "re-uploading identical profile text should reuse existing chunks"
    );

    const firstManual = await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appC.id,
          sourceType: "manual",
          sourceId: "change-test",
          sourceKey: "manual:change-test",
          chunkType: "achievement",
          content: "Original manual evidence about a support workflow.",
          tags: ["manual"],
          metadata: { test: true },
        },
      ],
    });
    const repeatedManual = await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appC.id,
          sourceType: "manual",
          sourceId: "change-test",
          sourceKey: "manual:change-test",
          chunkType: "achievement",
          content: "Original manual evidence about a support workflow.",
          tags: ["manual"],
          metadata: { test: true },
        },
      ],
    });
    const changedManual = await upsertCandidateMemoryChunks({
      owner,
      chunks: [
        {
          anonymousSessionId,
          sourceApplicationId: appC.id,
          sourceType: "manual",
          sourceId: "change-test",
          sourceKey: "manual:change-test",
          chunkType: "achievement",
          content: "Changed manual evidence about a support workflow with a measurable outcome.",
          tags: ["manual"],
          metadata: { test: true },
        },
      ],
    });
    assert.equal(firstManual.insertedCount, 1);
    assert.equal(repeatedManual.insertedCount, 0);
    assert.equal(changedManual.insertedCount, 1);
    assert.equal(
      await prisma.candidateChunk.count({
        where: { anonymousSessionId, sourceKey: "manual:change-test", archivedAt: null },
      }),
      1,
      "changed chunks should archive the old source-key version and keep one active chunk"
    );

    console.log("Permanent candidate memory tests passed.");
  } finally {
    await cleanup(prisma, anonymousSessionId).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
