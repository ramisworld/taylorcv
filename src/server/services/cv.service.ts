import "server-only";

import { db } from "~/server/db";
import type { CvStrategyContext } from "~/server/agents/cvStrategy.agent";
import { buildRequirementEvidenceMap } from "~/server/services/rag.service";

export async function buildCvStrategyContext(applicationId: string) {
  const job = await db.job.findUnique({
    where: { applicationId },
    include: { requirements: true },
  });
  const candidateProfile = await db.candidateProfile.findUnique({
    where: { applicationId },
  });

  if (!job || !candidateProfile) {
    throw new Error("Job and candidate profile are required for CV strategy");
  }

  const evidenceMap = await buildRequirementEvidenceMap(applicationId);

  const strongEvidence = evidenceMap.flatMap((row) =>
    row.bestEvidence.map((evidence) => ({
      requirementId: row.requirementId,
      requirementLabel: row.requirementLabel,
      chunkId: evidence.chunkId,
      content: evidence.contentPreview,
      confidence: evidence.confidence,
    }))
  );

  const weakOrMissingRequirements = evidenceMap
    .filter(
      (row) =>
        row.overallConfidence === "weak" || row.overallConfidence === "missing"
    )
    .map((row) => ({
      id: row.requirementId,
      label: row.requirementLabel,
      description:
        job.requirements.find((requirement) => requirement.id === row.requirementId)
          ?.description ?? "",
      importance: row.requirementImportance,
    }));

  return {
    jobSummary: {
      title: job.title,
      company: job.company,
      seniority: job.seniority,
      summary: job.summary,
    },
    requirements: job.requirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      description: requirement.description,
      importance: requirement.importance,
      type: requirement.type,
    })),
    candidateProfileSummary: candidateProfile.summary,
    evidenceMap,
    strongEvidence,
    weakOrMissingRequirements,
  } satisfies CvStrategyContext;
}

export async function buildCvWriterContext(args: {
  applicationId: string;
  strategyId: string;
}) {
  const job = await db.job.findUnique({
    where: { applicationId: args.applicationId },
    include: { requirements: true },
  });
  const candidateProfile = await db.candidateProfile.findUnique({
    where: { applicationId: args.applicationId },
  });
  const strategy = await db.cvStrategy.findFirst({
    where: { id: args.strategyId, applicationId: args.applicationId },
  });
  const matches = await db.evidenceMatch.findMany({
    where: {
      applicationId: args.applicationId,
      confidence: { in: ["high", "medium"] },
      candidateChunkId: { not: null },
    },
    include: { jobRequirement: true, candidateChunk: true },
  });

  if (!job || !candidateProfile || !strategy) {
    throw new Error("Job, candidate profile, and strategy are required");
  }

  return {
    job,
    requirements: job.requirements,
    candidateProfile,
    strategy,
    selectedEvidence: matches
      .filter((match) => match.candidateChunk)
      .map((match) => ({
        requirementId: match.jobRequirementId,
        requirementLabel: match.jobRequirement.label,
        chunkId: match.candidateChunkId,
        content: match.candidateChunk!.content,
        confidence: match.confidence,
      })),
  };
}
