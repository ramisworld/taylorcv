import "server-only";

import { db } from "~/server/db";
import type { CvStrategyContext } from "~/server/agents/cvStrategy.agent";

const confidenceRank = {
  missing: 0,
  weak: 1,
  medium: 2,
  high: 3,
} as const;

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

  const matches = await db.evidenceMatch.findMany({
    where: { applicationId },
    include: {
      jobRequirement: true,
      candidateChunk: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const bestConfidenceByRequirement = new Map<string, number>();
  for (const match of matches) {
    bestConfidenceByRequirement.set(
      match.jobRequirementId,
      Math.max(
        bestConfidenceByRequirement.get(match.jobRequirementId) ?? 0,
        confidenceRank[match.confidence]
      )
    );
  }

  const strongEvidence = matches
    .filter(
      (match) =>
        (match.confidence === "high" || match.confidence === "medium") &&
        match.candidateChunk
    )
    .map((match) => ({
      requirementId: match.jobRequirementId,
      requirementLabel: match.jobRequirement.label,
      chunkId: match.candidateChunkId!,
      content: match.candidateChunk!.content,
      confidence: match.confidence,
    }));

  const weakOrMissingRequirements = job.requirements
    .filter(
      (requirement) =>
        (bestConfidenceByRequirement.get(requirement.id) ?? 0) <
        confidenceRank.medium
    )
    .map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      description: requirement.description,
      importance: requirement.importance,
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
