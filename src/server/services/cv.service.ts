import "server-only";

import { db } from "~/server/db";
import type { CvStrategyContext } from "~/server/agents/cvStrategy.agent";
import { buildRequirementEvidenceMap } from "~/server/services/rag.service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

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

  const evidenceByChunkId = new Map<
    string,
    {
      requirementId: string;
      requirementLabels: string[];
      chunkId: string | null;
      content: string;
      confidence: string;
    }
  >();

  for (const match of matches) {
    if (!match.candidateChunk) continue;

    const existing = evidenceByChunkId.get(match.candidateChunk.id);
    if (existing) {
      existing.requirementLabels.push(match.jobRequirement.label);
      if (existing.confidence !== "high" && match.confidence === "high") {
        existing.confidence = "high";
      }
      continue;
    }

    evidenceByChunkId.set(match.candidateChunk.id, {
      requirementId: match.jobRequirementId,
      requirementLabels: [match.jobRequirement.label],
      chunkId: match.candidateChunkId,
      content: match.candidateChunk.content,
      confidence: match.confidence,
    });
  }

  return {
    job,
    requirements: job.requirements,
    candidateProfile,
    confirmedProfile: {
      contactInfo: isRecord(candidateProfile.contactInfoJson)
        ? candidateProfile.contactInfoJson
        : null,
      links: isRecord(candidateProfile.linksJson)
        ? candidateProfile.linksJson
        : null,
      education: candidateProfile.educationJson,
      experience: candidateProfile.experienceJson,
      projects: candidateProfile.projectsJson,
      certifications: candidateProfile.certificationsJson,
      skills: candidateProfile.skillsJson,
      tools: candidateProfile.toolsJson,
      achievements: candidateProfile.achievementsJson,
      profileConfirmedAt: candidateProfile.profileConfirmedAt,
    },
    strategy,
    selectedEvidence: [...evidenceByChunkId.values()].map((evidence) => ({
      ...evidence,
      requirementLabel: evidence.requirementLabels.join(", "),
      requirementLabels: [...new Set(evidence.requirementLabels)],
    })),
  };
}
