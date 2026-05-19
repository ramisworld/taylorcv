import { randomUUID } from "crypto";
import { createHash } from "crypto";

import { PrismaClient } from "../generated/prisma/index.js";
import { createMockEmbedding } from "../src/server/tools/mockEmbedding.ts";

const prisma = new PrismaClient();
const seedAnonymousSessionId = "seed-anonymous-session";
const seedApplicationId = "seed-application";
const seedJobId = "seed-job";
const seedProfileId = "seed-candidate-profile";

function toVectorLiteral(embedding) {
  return `[${embedding.map((value) => value.toFixed(8)).join(",")}]`;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function insertChunk(chunk) {
  await prisma.$executeRaw`
    INSERT INTO candidate_chunks (
      id,
      anonymous_session_id,
      source_application_id,
      candidate_profile_id,
      source_type,
      source_id,
      source_key,
      source_hash,
      content_hash,
      chunk_type,
      content,
      embedding,
      tags_json,
      metadata_json,
      embedded_at,
      last_seen_at
    )
    VALUES (
      ${chunk.id},
      ${seedAnonymousSessionId},
      ${seedApplicationId},
      ${seedProfileId},
      'cv_upload'::"SourceType",
      ${seedProfileId},
      ${`seed:${chunk.id}`},
      ${hash({ source: "seed", id: chunk.id })},
      ${hash(chunk.content.toLowerCase())},
      ${chunk.chunkType}::"ChunkType",
      ${chunk.content},
      ${toVectorLiteral(createMockEmbedding(chunk.content))}::vector,
      ${JSON.stringify(chunk.tags)}::jsonb,
      ${JSON.stringify({ seed: true })}::jsonb,
      NOW(),
      NOW()
    )
  `;
}

async function main() {
  await prisma.anonymousSession.upsert({
    where: { id: seedAnonymousSessionId },
    update: {},
    create: { id: seedAnonymousSessionId },
  });

  await prisma.application.upsert({
    where: { id: seedApplicationId },
    update: {
      anonymousSessionId: seedAnonymousSessionId,
      status: "candidate_added",
      currentStep: "candidate_added",
    },
    create: {
      id: seedApplicationId,
      anonymousSessionId: seedAnonymousSessionId,
      status: "candidate_added",
      currentStep: "candidate_added",
    },
  });

  await prisma.job.upsert({
    where: { applicationId: seedApplicationId },
    update: {
      rawText:
        "Build an AI application using RAG, agents, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment workflows.",
      title: "AI Application Engineer",
      company: "Taylor Labs",
      seniority: "Mid-level",
      summary:
        "A role building end-to-end AI applications with RAG, agents, OpenAI, pgvector, and full-stack TypeScript.",
    },
    create: {
      id: seedJobId,
      applicationId: seedApplicationId,
      rawText:
        "Build an AI application using RAG, agents, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment workflows.",
      title: "AI Application Engineer",
      company: "Taylor Labs",
      seniority: "Mid-level",
      summary:
        "A role building end-to-end AI applications with RAG, agents, OpenAI, pgvector, and full-stack TypeScript.",
    },
  });

  await prisma.jobRequirement.deleteMany({ where: { jobId: seedJobId } });
  await prisma.jobRequirement.createMany({
    data: [
      {
        id: randomUUID(),
        jobId: seedJobId,
        type: "skill",
        label: "RAG",
        description: "Build retrieval augmented generation workflows.",
        importance: "high",
      },
      {
        id: randomUUID(),
        jobId: seedJobId,
        type: "skill",
        label: "Agents",
        description: "Build agentic workflows with tool orchestration.",
        importance: "high",
      },
      {
        id: randomUUID(),
        jobId: seedJobId,
        type: "tool",
        label: "PostgreSQL and pgvector",
        description: "Store embeddings and search vectors in PostgreSQL.",
        importance: "medium",
      },
      {
        id: randomUUID(),
        jobId: seedJobId,
        type: "tool",
        label: "Next.js and TypeScript",
        description: "Build full-stack UI and API workflows.",
        importance: "medium",
      },
      {
        id: randomUUID(),
        jobId: seedJobId,
        type: "responsibility",
        label: "Deployment",
        description: "Deploy AI apps and connect inference to a frontend.",
        importance: "medium",
      },
    ],
  });

  await prisma.candidateProfile.upsert({
    where: { id: seedProfileId },
    update: {
      anonymousSessionId: seedAnonymousSessionId,
      sourceApplicationId: seedApplicationId,
      sourceType: "cv_upload",
      sourceKey: "seed:profile",
      sourceHash: hash("seed-profile-source"),
      contentHash: hash("seed-profile-content"),
      summary:
        "Fake candidate with practical RAG, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment experience.",
      skillsJson: ["RAG", "OpenAI", "PostgreSQL", "pgvector", "Next.js"],
      projectsJson: [],
      educationJson: [],
      certificationsJson: [],
      experienceJson: [],
      toolsJson: ["OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
      achievementsJson: [],
    },
    create: {
      id: seedProfileId,
      anonymousSessionId: seedAnonymousSessionId,
      sourceApplicationId: seedApplicationId,
      sourceType: "cv_upload",
      sourceKey: "seed:profile",
      sourceHash: hash("seed-profile-source"),
      contentHash: hash("seed-profile-content"),
      rawCvText: null,
      rawBackgroundText:
        "Built RenovAI with RAG, OpenAI workflows, pgvector, Next.js, TypeScript, and deployment experience.",
      summary:
        "Fake candidate with practical RAG, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment experience.",
      skillsJson: ["RAG", "OpenAI", "PostgreSQL", "pgvector", "Next.js"],
      projectsJson: [],
      educationJson: [],
      certificationsJson: [],
      experienceJson: [],
      toolsJson: ["OpenAI", "PostgreSQL", "pgvector", "Next.js", "TypeScript"],
      achievementsJson: [],
    },
  });

  await prisma.candidateChunk.deleteMany({
      where: {
      sourceApplicationId: seedApplicationId,
      anonymousSessionId: seedAnonymousSessionId,
    },
  });

  await insertChunk({
    id: "seed-chunk-rag",
    chunkType: "project",
    content:
      "Built RenovAI, a RAG application using retrieval augmented generation over domain-specific renovation data.",
    tags: ["RAG", "retrieval", "RenovAI"],
  });
  await insertChunk({
    id: "seed-chunk-agents",
    chunkType: "project",
    content:
      "Built Taylor CV, an agentic workflow that orchestrates job parsing, evidence chunking, retrieval, scoring, strategy, and CV writing.",
    tags: ["agents", "workflow", "orchestration"],
  });
  await insertChunk({
    id: "seed-chunk-pgvector",
    chunkType: "skill",
    content:
      "Used PostgreSQL and pgvector to store embeddings and run vector search over candidate evidence chunks.",
    tags: ["PostgreSQL", "pgvector", "embeddings"],
  });
  await insertChunk({
    id: "seed-chunk-next-typescript",
    chunkType: "experience",
    content:
      "Built full-stack applications using Next.js, React, tRPC, Prisma, and TypeScript.",
    tags: ["Next.js", "React", "tRPC", "Prisma", "TypeScript"],
  });
  await insertChunk({
    id: "seed-chunk-deployment",
    chunkType: "achievement",
    content:
      "Deployed AI application workflows on a hosted server and connected model inference to a frontend.",
    tags: ["deployment", "server", "AI app"],
  });

  console.log("Seed complete");
  console.log(`Anonymous session ID: ${seedAnonymousSessionId}`);
  console.log(`Application ID: ${seedApplicationId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
