import "server-only";

import { db } from "~/server/db";
import { searchCandidateChunks } from "~/server/tools/vectorSearch.tool";
import type { EvidenceScoringOutput, RetrievedCandidateChunk } from "~/lib/types";

export async function retrieveCandidateEvidenceForRequirement(args: {
  anonymousSessionId: string;
  applicationId: string;
  requirement: {
    id: string;
    label: string;
    description: string;
  };
}) {
  await db.evidenceMatch.deleteMany({
    where: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirement.id,
    },
  });

  const retrievedChunks = await searchCandidateChunks({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    requirementText: `${args.requirement.label}\n${args.requirement.description}`,
    topK: 3,
  });

  if (retrievedChunks.length > 0) {
    await db.evidenceMatch.createMany({
      data: retrievedChunks.map((chunk) => ({
        applicationId: args.applicationId,
        jobRequirementId: args.requirement.id,
        candidateChunkId: chunk.id,
        similarityScore: chunk.similarityScore,
        confidence: "weak",
        reason: "Retrieved by vector search; awaiting evidence scoring.",
      })),
    });
  }

  return retrievedChunks;
}

export async function replaceWithScoredEvidenceMatches(args: {
  applicationId: string;
  requirementId: string;
  retrievedChunks: RetrievedCandidateChunk[];
  scoring: EvidenceScoringOutput;
}) {
  const similarityByChunkId = new Map(
    args.retrievedChunks.map((chunk) => [chunk.id, chunk.similarityScore])
  );

  await db.evidenceMatch.deleteMany({
    where: {
      applicationId: args.applicationId,
      jobRequirementId: args.requirementId,
    },
  });

  const scoredMatches = args.scoring.matches.length
    ? args.scoring.matches
    : [
        {
          jobRequirementId: args.requirementId,
          candidateChunkId: null,
          confidence: "missing" as const,
          reason: "No usable candidate evidence was found.",
        },
      ];

  await db.evidenceMatch.createMany({
    data: scoredMatches.map((match) => ({
      applicationId: args.applicationId,
      jobRequirementId: args.requirementId,
      candidateChunkId: match.candidateChunkId,
      similarityScore: match.candidateChunkId
        ? similarityByChunkId.get(match.candidateChunkId)
        : null,
      confidence: match.confidence,
      reason: match.reason,
    })),
  });
}
