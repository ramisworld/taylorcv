import "server-only";

import { TRPCError } from "@trpc/server";
import type { Prisma } from "../../../generated/prisma/index.js";

import type { CandidateProfilerOutput } from "~/lib/types";
import { buildEvidenceMatchPersistencePlan } from "~/lib/evidenceMatchPersistence";
import { parseStructuredCv } from "~/lib/cvDocument";
import { stripCvPresentationDebug } from "~/lib/cvPresentation";
import { runBatchEvidenceFitAndGapPlannerAgent } from "~/server/agents/batchEvidenceFitAndGapPlanner.agent";
import { runCandidateProfilerAgent } from "~/server/agents/candidateProfiler.agent";
import { runCvBuilderAgent } from "~/server/agents/cvBuilder.agent";
import { runJobParserAgent } from "~/server/agents/jobParser.agent";
import { db } from "~/server/db";
import {
  buildEvidenceChunksFromProfile,
  buildGapAnswerEvidenceChunk,
} from "~/server/services/evidenceChunkBuilder.service";
import {
  buildRequirementEvidenceMap,
  calculateEvidenceMatchScore,
} from "~/server/services/rag.service";
import {
  calculateDeterministicAfterScore,
  compactCvRepairInstructions,
  composeDeterministicPresentation,
  repairCvOutput,
  runDeterministicCvQa,
} from "~/server/services/cvQa.service";
import { timedStep } from "~/server/services/timing.service";
import {
  insertCandidateChunksWithEmbeddings,
  searchCandidateChunksForRequirements,
} from "~/server/tools/vectorSearch.tool";

const MAX_JOB_DESCRIPTION_CHARS = 20_000;
const MAX_CANDIDATE_BACKGROUND_CHARS = 30_000;
const LINKEDIN_FAILURE_MESSAGE =
  "We couldn’t read this LinkedIn profile automatically. Please upload your CV instead.";

function inputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function jsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

type GapAnswerTrustLevel = "usable" | "use_carefully" | "suspicious" | "do_not_use";

const suspiciousGapAnswerPattern =
  /\b(model calls?|batching|batch(?:ed)? slower steps|timing logs?|latency logs?|refactor|pipeline|unnecessary model calls?|backend optimisation|backend optimization)\b/i;

function classifyGapAnswerTrust(text: string): GapAnswerTrustLevel {
  const normalized = text.trim();
  if (!normalized) return "do_not_use";
  if (suspiciousGapAnswerPattern.test(normalized)) return "suspicious";
  if (/\b(owned|built|created|tested|used|implemented|worked on|delivered|improved)\b/i.test(normalized)) {
    return "usable";
  }
  return "use_carefully";
}

function chunkTrustLevel(chunk: { metadataJson: unknown; content: string }) {
  if (isRecord(chunk.metadataJson) && typeof chunk.metadataJson.trustLevel === "string") {
    return chunk.metadataJson.trustLevel;
  }
  return classifyGapAnswerTrust(chunk.content);
}

function normalizeJobRequirements<T extends { label: string; description: string; importance: string }>(
  requirements: T[]
) {
  const seen = new Set<string>();
  const importanceRank = { high: 0, medium: 1, low: 2 } as const;
  const deduped = [...requirements]
    .sort(
      (a, b) =>
        (importanceRank[a.importance as keyof typeof importanceRank] ?? 3) -
        (importanceRank[b.importance as keyof typeof importanceRank] ?? 3)
    )
    .filter((requirement) => {
      const key = requirement.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14);

  let highCount = 0;
  return deduped.map((requirement) => {
    if (requirement.importance !== "high") return requirement;
    highCount += 1;
    return highCount <= 8 ? requirement : { ...requirement, importance: "medium" };
  });
}

function questionJson(question: {
  question: string;
  shortQuestion: string;
  linkedJobRequirement: string | null;
  whyThisMatters: string;
  howYourAnswerHelps: string;
  quickOptions: string[];
  selectedOptionRequiresDetail: boolean;
  followUpPrompt: string | null;
  dynamicGuidance: string;
  questionType: string;
}) {
  return {
    shortQuestion: question.shortQuestion,
    linkedJobRequirement: question.linkedJobRequirement,
    whyThisMatters: question.whyThisMatters,
    howYourAnswerHelps: question.howYourAnswerHelps,
    quickOptions: question.quickOptions.slice(0, 4),
    selectedOptionRequiresDetail: question.selectedOptionRequiresDetail,
    followUpPrompt: question.followUpPrompt,
    dynamicGuidance: question.dynamicGuidance,
    questionType: question.questionType,
  };
}

async function clearGeneratedWork(applicationId: string) {
  await db.cvDraft.deleteMany({ where: { applicationId } });
  await db.cvStrategy.deleteMany({ where: { applicationId } });
  await db.gapAnswer.deleteMany({ where: { applicationId } });
  await db.gapQuestion.deleteMany({ where: { applicationId } });
  await db.gapCoachInsight.deleteMany({ where: { applicationId } });
  await db.evidenceMatch.deleteMany({ where: { applicationId } });
  await db.requirementFitScore.deleteMany({ where: { applicationId } });
}

export async function assertApplicationForSession(args: {
  applicationId: string;
  anonymousSessionId: string;
  clerkUserId?: string | null;
}) {
  const user = args.clerkUserId
    ? await db.user.findUnique({ where: { clerkUserId: args.clerkUserId } })
    : null;
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      OR: [
        { anonymousSessionId: args.anonymousSessionId },
        ...(user ? [{ userId: user.id }] : []),
      ],
    },
  });

  if (!application) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Application does not belong to this anonymous session",
    });
  }

  return application;
}

async function getOrCreateUser(args: {
  clerkUserId: string;
  email?: string | null;
  name?: string | null;
}) {
  return db.user.upsert({
    where: { clerkUserId: args.clerkUserId },
    update: { email: optionalText(args.email), name: optionalText(args.name) },
    create: {
      clerkUserId: args.clerkUserId,
      email: optionalText(args.email),
      name: optionalText(args.name),
    },
  });
}

async function fetchLinkedInPublicText(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TaylorCV/1.0; +https://taylorcv.local)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const text = (await response.text())
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text.length >= 300 ? text.slice(0, MAX_CANDIDATE_BACKGROUND_CHARS) : null;
  } catch {
    return null;
  }
}

async function upsertCandidateProfileFromOutput(args: {
  anonymousSessionId: string;
  applicationId: string;
  profileOutput: CandidateProfilerOutput;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  profileSource?: string | null;
  sourceSummary?: string | null;
  sourceUrl?: string | null;
}) {
  const profile = args.profileOutput;
  return db.candidateProfile.upsert({
    where: { applicationId: args.applicationId },
    update: {
      rawCvText: args.rawCvText,
      rawBackgroundText: args.rawBackgroundText,
      contactInfoJson: inputJson(profile.contactInfo),
      linksJson: inputJson(profile.links),
      profileSource: args.profileSource,
      sourceSummary: args.sourceSummary ?? profile.sourceSummary,
      sourceUrl: args.sourceUrl,
      profileConfirmedAt: null,
      summary: profile.summary,
      skillsJson: inputJson(profile.skills),
      projectsJson: inputJson(profile.projects),
      educationJson: inputJson(profile.education),
      certificationsJson: inputJson(profile.certifications),
      experienceJson: inputJson(profile.experience),
      toolsJson: inputJson(profile.tools),
      achievementsJson: inputJson(profile.achievements),
      cautionNotesJson: inputJson(profile.cautionNotes ?? []),
      metricOpportunitiesJson: inputJson(profile.metricOpportunities ?? []),
      strongProofCandidatesJson: inputJson(profile.strongProofCandidates ?? []),
      scopeOpportunitiesJson: inputJson(profile.scopeOpportunities ?? []),
      likelyTopEvidenceJson: inputJson(profile.likelyTopEvidence ?? []),
    },
    create: {
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      rawCvText: args.rawCvText,
      rawBackgroundText: args.rawBackgroundText,
      contactInfoJson: inputJson(profile.contactInfo),
      linksJson: inputJson(profile.links),
      profileSource: args.profileSource,
      sourceSummary: args.sourceSummary ?? profile.sourceSummary,
      sourceUrl: args.sourceUrl,
      profileConfirmedAt: null,
      summary: profile.summary,
      skillsJson: inputJson(profile.skills),
      projectsJson: inputJson(profile.projects),
      educationJson: inputJson(profile.education),
      certificationsJson: inputJson(profile.certifications),
      experienceJson: inputJson(profile.experience),
      toolsJson: inputJson(profile.tools),
      achievementsJson: inputJson(profile.achievements),
      cautionNotesJson: inputJson(profile.cautionNotes ?? []),
      metricOpportunitiesJson: inputJson(profile.metricOpportunities ?? []),
      strongProofCandidatesJson: inputJson(profile.strongProofCandidates ?? []),
      scopeOpportunitiesJson: inputJson(profile.scopeOpportunities ?? []),
      likelyTopEvidenceJson: inputJson(profile.likelyTopEvidence ?? []),
    },
  });
}

async function loadCandidateChunks(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  return db.$queryRaw<
    Array<{
      id: string;
      anonymousSessionId: string;
      applicationId: string;
      candidateProfileId: string | null;
      sourceType: string;
      sourceId: string | null;
      chunkType: string;
      content: string;
      tagsJson: unknown;
      metadataJson: unknown;
      createdAt: Date;
    }>
  >`
    SELECT
      id,
      anonymous_session_id AS "anonymousSessionId",
      application_id AS "applicationId",
      candidate_profile_id AS "candidateProfileId",
      source_type AS "sourceType",
      source_id AS "sourceId",
      chunk_type AS "chunkType",
      content,
      tags_json AS "tagsJson",
      metadata_json AS "metadataJson",
      created_at AS "createdAt"
    FROM candidate_chunks
    WHERE application_id = ${args.applicationId}
      AND anonymous_session_id = ${args.anonymousSessionId}
    ORDER BY created_at ASC
  `;
}

async function persistBatchFit(args: {
  anonymousSessionId: string;
  applicationId: string;
  jobRequirements: Array<{ id: string; label: string; importance: string }>;
  output: Awaited<ReturnType<typeof runBatchEvidenceFitAndGapPlannerAgent>>;
  retrievedEvidenceByRequirement: Record<
    string,
    Array<{ id: string; similarityScore: number }>
  >;
}) {
  const persistedChunks = await db.candidateChunk.findMany({
    where: {
      applicationId: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
    },
    select: { id: true },
  });
  const validCandidateChunkIds = new Set(persistedChunks.map((chunk) => chunk.id));
  const persistencePlan = buildEvidenceMatchPersistencePlan({
    applicationId: args.applicationId,
    jobRequirements: args.jobRequirements,
    output: args.output,
    retrievedEvidenceByRequirement: args.retrievedEvidenceByRequirement,
    validCandidateChunkIds,
  });
  if (persistencePlan.rejectedMatches.length > 0) {
    console.warn("taylor_rejected_evidence_matches", {
      applicationId: args.applicationId,
      rejectedMatches: persistencePlan.rejectedMatches,
    });
  }

  await db.$transaction(async (tx) => {
    await tx.evidenceMatch.deleteMany({ where: { applicationId: args.applicationId } });
    await tx.requirementFitScore.deleteMany({ where: { applicationId: args.applicationId } });
    await tx.gapAnswer.deleteMany({ where: { applicationId: args.applicationId } });
    await tx.gapQuestion.deleteMany({ where: { applicationId: args.applicationId } });
    await tx.gapCoachInsight.deleteMany({ where: { applicationId: args.applicationId } });

    for (const match of persistencePlan.evidenceMatches) {
      await tx.evidenceMatch.create({
        data: {
          applicationId: match.applicationId,
          jobRequirementId: match.jobRequirementId,
          candidateChunkId: match.candidateChunkId,
          similarityScore: match.similarityScore,
          confidence: match.confidence,
          cvUsefulness: match.cvUsefulness,
          claimRisk: match.claimRisk,
          reason: match.reason,
        },
      });
    }
    for (const fitScore of persistencePlan.requirementFitScores) {
      await tx.requirementFitScore.create({
        data: {
          applicationId: fitScore.applicationId,
          jobRequirementId: fitScore.jobRequirementId,
          finalConfidence: fitScore.finalConfidence,
          bestCandidateChunkId: fitScore.bestCandidateChunkId,
          reason: fitScore.reason,
          importanceWeight: fitScore.importanceWeight,
          confidenceValue: fitScore.confidenceValue,
          earnedPoints: fitScore.earnedPoints,
          possiblePoints: fitScore.possiblePoints,
        },
      });
    }

    await tx.gapCoachInsight.create({
      data: {
        applicationId: args.applicationId,
        openingMessage:
          args.output.recommendedGapQuestions.length > 0
            ? "Taylor found a few quick questions that could make the final CV stronger."
            : "Taylor found enough evidence to build the CV now.",
        jobWants: args.output.cvAngle,
        candidateStrengthsJson: inputJson(args.output.topStrengths),
        candidateConcernsJson: inputJson(args.output.weakSpots),
      },
    });

    if (args.output.recommendedGapQuestions.length > 0) {
      const liveRequirementIds = new Set(args.jobRequirements.map((item) => item.id));
      await tx.gapQuestion.createMany({
        data: args.output.recommendedGapQuestions.slice(0, 4).map((question) => ({
          applicationId: args.applicationId,
          targetRequirementId:
            question.targetRequirementId && liveRequirementIds.has(question.targetRequirementId)
              ? question.targetRequirementId
              : null,
          question: question.question,
          reason: question.dynamicGuidance,
          whyItMatters: question.whyThisMatters,
          answerGuidance: question.howYourAnswerHelps,
          exampleAnglesJson: inputJson([question.dynamicGuidance]),
          questionJson: inputJson(questionJson(question)),
          status: "unanswered" as const,
        })),
      });
    }
  });
}

async function prepareFastMatch(args: {
  anonymousSessionId: string;
  applicationId: string;
  candidateProfileId: string;
  profileOutput: CandidateProfilerOutput;
}) {
  const job = await db.job.findUnique({
    where: { applicationId: args.applicationId },
    include: { requirements: true },
  });
  if (!job) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a job before scanning your background.",
    });
  }

  await db.evidenceMatch.deleteMany({ where: { applicationId: args.applicationId } });
  await db.requirementFitScore.deleteMany({ where: { applicationId: args.applicationId } });
  await db.gapAnswer.deleteMany({ where: { applicationId: args.applicationId } });
  await db.gapQuestion.deleteMany({ where: { applicationId: args.applicationId } });
  await db.gapCoachInsight.deleteMany({ where: { applicationId: args.applicationId } });
  await db.cvDraft.deleteMany({ where: { applicationId: args.applicationId } });
  await db.candidateChunk.deleteMany({
    where: {
      applicationId: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
    },
  });

  const chunks = await timedStep(
    "deterministic chunk builder",
    async () =>
      buildEvidenceChunksFromProfile({
        anonymousSessionId: args.anonymousSessionId,
        applicationId: args.applicationId,
        candidateProfileId: args.candidateProfileId,
        profile: args.profileOutput,
      }),
    { applicationId: args.applicationId }
  );

  await timedStep(
    "batch embedding call",
    () => insertCandidateChunksWithEmbeddings(chunks),
    { applicationId: args.applicationId, chunkCount: chunks.length }
  );

  const rankedRequirements = [...job.requirements]
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.importance] - rank[b.importance];
    })
    .slice(0, 14);
  const requirementsForRetrieval = rankedRequirements.filter(
    (requirement) => requirement.importance !== "low"
  );

  const retrievalMap = await timedStep(
    "retrieval",
    () =>
      searchCandidateChunksForRequirements({
        anonymousSessionId: args.anonymousSessionId,
        applicationId: args.applicationId,
        requirements: requirementsForRetrieval,
        topK: 4,
      }),
    { applicationId: args.applicationId, requirementCount: requirementsForRetrieval.length }
  );
  const retrievedEvidenceByRequirement = Object.fromEntries(
    rankedRequirements.map((requirement) => [
      requirement.id,
      (retrievalMap.get(requirement.id) ?? []).map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        similarityScore: Number(chunk.similarityScore),
        chunkType: chunk.chunkType,
        sourceType: chunk.sourceType,
        tagsJson: chunk.tagsJson,
        metadataJson: chunk.metadataJson,
      })),
    ])
  );

  const fitOutput = await timedStep(
    "Batch Evidence Fit + Gap Planner",
    () =>
      runBatchEvidenceFitAndGapPlannerAgent({
        applicationId: args.applicationId,
        input: {
          parsedJob: {
            title: job.title,
            company: job.company,
            seniority: job.seniority,
            summary: job.summary,
            roleDomain: job.roleDomain,
            archetypeHint: job.archetypeHint,
          },
          requirements: rankedRequirements.map((requirement) => ({
            id: requirement.id,
            label: requirement.label,
            description: requirement.description,
            importance: requirement.importance,
          })),
          candidateProfileSummary: args.profileOutput.summary,
          retrievedEvidenceByRequirement,
          metricOpportunities: args.profileOutput.metricOpportunities ?? [],
          scopeOpportunities: args.profileOutput.scopeOpportunities ?? [],
          roleDomain: job.roleDomain,
          archetypeHint: job.archetypeHint,
        },
      }),
    { applicationId: args.applicationId }
  );

  await persistBatchFit({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    jobRequirements: rankedRequirements,
    output: fitOutput,
    retrievedEvidenceByRequirement,
  });

  await db.application.update({
    where: { id: args.applicationId },
    data: {
      status: "questions_ready",
      currentStep: "match_ready",
      originalEvidenceMatchScore: fitOutput.currentMatchScore,
      updatedEvidenceMatchScore: fitOutput.currentMatchScore,
      matchLabel: fitOutput.matchLabel,
      cvAngle: fitOutput.cvAngle,
      roleArchetype: fitOutput.roleArchetype,
      matchAnalysisJson: inputJson(fitOutput),
    },
  });

  return fitOutput;
}

export async function createApplication(args: {
  anonymousSessionId: string;
  clerkUserId?: string | null;
}) {
  const user = args.clerkUserId
    ? await getOrCreateUser({ clerkUserId: args.clerkUserId })
    : null;
  const application = await db.application.create({
    data: {
      anonymousSessionId: args.anonymousSessionId,
      userId: user?.id,
      status: "started",
      currentStep: "started",
    },
  });
  return { applicationId: application.id, anonymousSessionId: args.anonymousSessionId };
}

export async function resetApplication(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
}) {
  await assertApplicationForSession(args);
  await db.application.delete({ where: { id: args.applicationId } });
  return createApplication({
    anonymousSessionId: args.anonymousSessionId,
    clerkUserId: args.clerkUserId,
  });
}

export async function submitJob(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
  rawJobText: string;
}) {
  await assertApplicationForSession(args);
  if (args.rawJobText.length > MAX_JOB_DESCRIPTION_CHARS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Job description must be 20,000 characters or fewer",
    });
  }

  const parsedJob = await timedStep(
    "Job Parser",
    () => runJobParserAgent({ applicationId: args.applicationId, rawJobText: args.rawJobText }),
    { applicationId: args.applicationId }
  );
  const requirements = normalizeJobRequirements(parsedJob.requirements);
  const existingJob = await db.job.findUnique({
    where: { applicationId: args.applicationId },
  });

  await clearGeneratedWork(args.applicationId);
  if (existingJob) {
    await db.jobRequirement.deleteMany({ where: { jobId: existingJob.id } });
  }

  const job = existingJob
    ? await db.job.update({
        where: { id: existingJob.id },
        data: {
          rawText: args.rawJobText,
          title: parsedJob.title,
          company: parsedJob.company,
          seniority: parsedJob.seniority,
          summary: parsedJob.summary,
          roleDomain: parsedJob.roleDomain ?? null,
          archetypeHint: parsedJob.archetypeHint ?? null,
        },
      })
    : await db.job.create({
        data: {
          applicationId: args.applicationId,
          rawText: args.rawJobText,
          title: parsedJob.title,
          company: parsedJob.company,
          seniority: parsedJob.seniority,
          summary: parsedJob.summary,
          roleDomain: parsedJob.roleDomain ?? null,
          archetypeHint: parsedJob.archetypeHint ?? null,
        },
      });

  await db.jobRequirement.createMany({
    data: requirements.map((requirement) => ({
      jobId: job.id,
      type: requirement.type,
      label: requirement.label,
      description: requirement.description,
      importance: requirement.importance,
    })),
  });
  await db.application.update({
    where: { id: args.applicationId },
    data: {
      status: "job_added",
      currentStep: "job_added",
      originalEvidenceMatchScore: null,
      updatedEvidenceMatchScore: null,
      matchLabel: null,
      cvAngle: null,
      roleArchetype: null,
      matchAnalysisJson: undefined,
    },
  });
  const jobRequirements = await db.jobRequirement.findMany({
    where: { jobId: job.id },
    orderBy: { label: "asc" },
  });
  return { job, jobRequirements };
}

export async function submitCandidateProfileSource(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
  source: "cv_upload" | "linkedin_url";
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  sourceUrl?: string | null;
}) {
  await assertApplicationForSession(args);
  const sourceUrl = optionalText(args.sourceUrl);
  let rawCvText = args.rawCvText ?? null;
  let rawBackgroundText = args.rawBackgroundText ?? null;

  if (args.source === "linkedin_url") {
    if (!sourceUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Add a LinkedIn URL first." });
    }
    const importedText = await fetchLinkedInPublicText(sourceUrl);
    if (!importedText) {
      return {
        importStatus: "needs_upload" as const,
        message: LINKEDIN_FAILURE_MESSAGE,
      };
    }
    rawBackgroundText = importedText;
  }

  const combinedLength = (rawCvText?.length ?? 0) + (rawBackgroundText?.length ?? 0);
  if (combinedLength > MAX_CANDIDATE_BACKGROUND_CHARS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Candidate background must be 30,000 characters or fewer",
    });
  }
  if (combinedLength === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Upload your CV before Taylor scans your background.",
    });
  }

  const profileOutput = await timedStep(
    "Candidate Profiler",
    () =>
      runCandidateProfilerAgent({
        applicationId: args.applicationId,
        rawCvText,
        rawBackgroundText,
      }),
    { applicationId: args.applicationId }
  );
  const candidateProfile = await upsertCandidateProfileFromOutput({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    rawCvText,
    rawBackgroundText,
    profileOutput,
    profileSource: args.source,
    sourceSummary: profileOutput.sourceSummary,
    sourceUrl,
  });
  let matchAnalysis: Awaited<ReturnType<typeof prepareFastMatch>>;
  try {
    matchAnalysis = await prepareFastMatch({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      candidateProfileId: candidateProfile.id,
      profileOutput,
    });
  } catch (error) {
    console.error("taylor_candidate_scan_failed", {
      applicationId: args.applicationId,
      error: safeErrorMessage(error),
    });
    await db.application.update({
      where: { id: args.applicationId },
      data: {
        status: "candidate_added",
        currentStep: "candidate_scan_failed",
      },
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong while scanning your background. Please try again.",
    });
  }

  return {
    importStatus: "match_ready" as const,
    candidateProfile,
    matchAnalysis,
    missingEssentials: [],
  };
}

export async function answerGapQuestions(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
  answers: Array<{
    gapQuestionId: string;
    answerText?: string | null;
    selectedOption?: string | null;
    followUpText?: string | null;
    metricText?: string | null;
    skipped?: boolean | null;
  }>;
}) {
  await assertApplicationForSession(args);

  const chunks = await timedStep(
    "gap answer processing",
    async () => {
      const newChunks = [];
      for (const answer of args.answers) {
        const gapQuestion = await db.gapQuestion.findFirst({
          where: { id: answer.gapQuestionId, applicationId: args.applicationId },
          include: { targetRequirement: true },
        });
        if (!gapQuestion) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Gap question does not belong to this application",
          });
        }
        const selectedOption = optionalText(answer.selectedOption);
        const followUpText = optionalText(answer.followUpText);
        const metricText = optionalText(answer.metricText);
        const answerText = optionalText(answer.answerText);
        const skipped =
          !!answer.skipped ||
          selectedOption?.toLowerCase() === "skip" ||
          (!selectedOption && !followUpText && !metricText && !answerText);
        const gapAnswer = await db.gapAnswer.create({
          data: {
            gapQuestionId: gapQuestion.id,
            applicationId: args.applicationId,
            buttonAnswer: skipped ? "skip" : followUpText || metricText || answerText ? "yes" : "kind_of",
            elaboration: skipped ? null : [followUpText, metricText, answerText].filter(Boolean).join(" "),
            selectedOption,
            followUpText,
            metricText,
            skipped,
          },
        });
        await db.gapQuestion.update({
          where: { id: gapQuestion.id },
          data: { status: skipped ? "skipped" : "answered" },
        });
        if (skipped) continue;
        const answerContent = [selectedOption, followUpText, metricText, answerText]
          .filter(Boolean)
          .join(" ");
        const trustLevel = classifyGapAnswerTrust(answerContent);
        if (trustLevel === "suspicious" || trustLevel === "do_not_use") {
          console.warn("taylor_gap_answer_excluded", {
            applicationId: args.applicationId,
            gapAnswerId: gapAnswer.id,
            trustLevel,
          });
          continue;
        }
        const chunk = buildGapAnswerEvidenceChunk({
          anonymousSessionId: args.anonymousSessionId,
          applicationId: args.applicationId,
          gapAnswerId: gapAnswer.id,
          gapQuestionId: gapQuestion.id,
          targetRequirementId: gapQuestion.targetRequirementId,
          targetRequirementLabel: gapQuestion.targetRequirement?.label ?? null,
          selectedOption,
          followUpText,
          metricText,
          answerText,
          trustLevel,
        });
        if (chunk) newChunks.push(chunk);
      }
      return newChunks;
    },
    { applicationId: args.applicationId }
  );

  if (chunks.length > 0) {
    await timedStep(
      "batch embedding call",
      () => insertCandidateChunksWithEmbeddings(chunks),
      { applicationId: args.applicationId, chunkCount: chunks.length, source: "gap_answers" }
    );
  }
  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "answers_added", currentStep: "answers_added" },
  });

  return {
    updatedEvidenceMap: await buildRequirementEvidenceMap(args.applicationId),
    evidenceMatchScore: await calculateEvidenceMatchScore(args.applicationId),
    newCandidateChunks: chunks,
  };
}

function matchAnalysisObject(value: unknown) {
  return isRecord(value) ? value : {};
}

export async function generateCv(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
  strategyId?: string | null;
}) {
  const application = await assertApplicationForSession(args);
  const [job, candidateProfile, candidateChunks, gapAnswers] = await Promise.all([
    db.job.findUnique({ where: { applicationId: args.applicationId } }),
    db.candidateProfile.findUnique({ where: { applicationId: args.applicationId } }),
    loadCandidateChunks(args),
    db.gapAnswer.findMany({
      where: { applicationId: args.applicationId, skipped: false },
      include: { gapQuestion: true },
    }),
  ]);
  if (!job || !candidateProfile || candidateChunks.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Taylor needs a job and background scan before generating the CV.",
    });
  }

  const matchAnalysis = matchAnalysisObject(application.matchAnalysisJson);
  const trustedGapEvidence = candidateChunks.filter(
    (chunk) =>
      chunk.sourceType === "gap_answer" &&
      (chunkTrustLevel(chunk) === "usable" || chunkTrustLevel(chunk) === "use_carefully")
  );
  const cvBuilderContext = {
    job,
    candidateProfile,
    candidateChunks,
    matchAnalysis,
    gapEvidence: trustedGapEvidence,
    gapAnswers,
    gapAnswerTrust: gapAnswers.map((answer) => ({
      id: answer.id,
      trustLevel: classifyGapAnswerTrust(
        [answer.selectedOption, answer.followUpText, answer.metricText, answer.elaboration]
          .filter(Boolean)
          .join(" ")
      ),
    })),
  };
  const draftGeneration = await (async () => {
    try {
      let cvOutput = await timedStep(
        "CV Builder",
        () =>
          runCvBuilderAgent({
            applicationId: args.applicationId,
            context: cvBuilderContext,
          }),
        { applicationId: args.applicationId }
      );
      const qaContext = { job, candidateChunks, gapAnswers, matchAnalysis };
      let qa = await timedStep(
        "deterministic QA",
        async () => runDeterministicCvQa(cvOutput, qaContext),
        { applicationId: args.applicationId }
      );
      if (!qa.passed) {
        const repairedOutput = repairCvOutput(cvOutput);
        const repairedQa = await timedStep(
          "deterministic QA repair",
          async () => runDeterministicCvQa(repairedOutput, qaContext),
          { applicationId: args.applicationId }
        );
        cvOutput = repairedOutput;
        qa = repairedQa;
      }
      if (!qa.passed) {
        const repairInstructions = compactCvRepairInstructions(qa.issues);
        cvOutput = await timedStep(
          "CV Builder repair",
          () =>
            runCvBuilderAgent({
              applicationId: args.applicationId,
              context: {
                repairInstructions,
                originalCvJson: cvOutput.cvJson,
                job: {
                  title: job.title,
                  company: job.company,
                  roleDomain: job.roleDomain,
                  archetypeHint: job.archetypeHint,
                },
                candidateProfile: {
                  summary: candidateProfile.summary,
                  skillsJson: candidateProfile.skillsJson,
                  experienceJson: candidateProfile.experienceJson,
                  projectsJson: candidateProfile.projectsJson,
                  educationJson: candidateProfile.educationJson,
                },
                candidateChunks,
                matchAnalysis,
                gapEvidence: trustedGapEvidence,
              },
            }),
          { applicationId: args.applicationId }
        );
        qa = await timedStep(
          "deterministic QA repair check",
          async () => runDeterministicCvQa(cvOutput, qaContext),
          { applicationId: args.applicationId }
        );
      }
      if (!qa.passed) {
        throw new Error(`CV QA failed: ${qa.issues.slice(0, 5).join("; ")}`);
      }
      const finalAfterScore = calculateDeterministicAfterScore({
        output: cvOutput,
        qaPassed: qa.passed,
        context: qaContext,
      });
      const presentationJson = await timedStep(
        "layout/page composer",
        async () => composeDeterministicPresentation({ cvOutput, context: { job, matchAnalysis } }),
        { applicationId: args.applicationId }
      );
      return { cvOutput, finalAfterScore, presentationJson };
    } catch (error) {
      console.error("taylor_cv_draft_generation_failed", {
        applicationId: args.applicationId,
        error: safeErrorMessage(error),
      });
      await db.application
        .update({
          where: { id: args.applicationId },
          data: {
            status: "strategy_ready",
            currentStep: "draft_failed",
          },
        })
        .catch((updateError) =>
          console.error("taylor_cv_draft_failure_state_update_failed", {
            applicationId: args.applicationId,
            error: safeErrorMessage(updateError),
          })
        );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Taylor created the CV strategy, but had trouble writing the final CV. Try again.",
      });
    }
  })();
  const { cvOutput, finalAfterScore, presentationJson } = draftGeneration;
  const latestDraft = await db.cvDraft.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { version: "desc" },
  });
  const cvDraft = await db.cvDraft.create({
    data: {
      applicationId: args.applicationId,
      strategyId: null,
      version: (latestDraft?.version ?? 0) + 1,
      cvJson: inputJson(cvOutput.cvJson),
      cvText: cvOutput.cvText,
      presentationJson: inputJson(presentationJson),
      builderOutputJson: inputJson(cvOutput),
    },
  });
  await db.application.update({
    where: { id: args.applicationId },
    data: {
      status: "cv_ready",
      currentStep: "draft_ready",
      updatedEvidenceMatchScore: finalAfterScore,
      cvAngle: cvOutput.cvAngle,
      roleArchetype: cvOutput.roleArchetype,
    },
  });
  return { cvDraft };
}

export async function getApplicationState(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId?: string | null;
}) {
  const application = await assertApplicationForSession(args);

  const [
    job,
    candidateProfile,
    candidateChunks,
    evidenceMatches,
    requirementFitScores,
    evidenceMatchScore,
    gapQuestions,
    gapAnswers,
    gapCoachInsight,
    cvDraft,
    agentRuns,
  ] = await Promise.all([
    db.job.findUnique({
      where: { applicationId: args.applicationId },
      include: { requirements: true },
    }),
    db.candidateProfile.findUnique({ where: { applicationId: args.applicationId } }),
    loadCandidateChunks(args),
    buildRequirementEvidenceMap(args.applicationId),
    db.requirementFitScore.findMany({
      where: { applicationId: args.applicationId },
      include: {
        bestCandidateChunk: { select: { id: true, content: true } },
        jobRequirement: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    calculateEvidenceMatchScore(args.applicationId),
    db.gapQuestion.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
    db.gapAnswer.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
    db.gapCoachInsight.findUnique({ where: { applicationId: args.applicationId } }),
    db.cvDraft.findFirst({
      where: { applicationId: args.applicationId },
      orderBy: { version: "desc" },
    }),
    db.agentRun.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const sortedRequirements = [...(job?.requirements ?? [])].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.importance] - rank[b.importance];
  });
  const topRequirements = sortedRequirements.slice(0, 6);
  const strongMatches = evidenceMatches.filter(
    (match) => match.overallConfidence === "high" || match.overallConfidence === "medium"
  );
  const matchAnalysis = matchAnalysisObject(application.matchAnalysisJson);
  const weakSpots = Array.isArray(matchAnalysis.weakSpots)
    ? stringArray(matchAnalysis.weakSpots).map((spot, index) => ({
        id: `weak-${index}`,
        targetRequirementId: null,
        label: spot,
        reason: spot,
        question: spot,
      }))
    : gapQuestions.map((question) => ({
        id: question.id,
        targetRequirementId: question.targetRequirementId,
        label:
          job?.requirements.find((requirement) => requirement.id === question.targetRequirementId)
            ?.label ?? "Clarification needed",
        reason: question.reason,
        question: question.question,
      }));
  const clientCvDraft = cvDraft
    ? { ...cvDraft, presentationJson: stripCvPresentationDebug(cvDraft.presentationJson) }
    : null;

  return {
    application,
    job,
    jobRequirements: job?.requirements ?? [],
    dreamRole: application.dreamRole,
    jobProfileSummary: job
      ? {
          role: job.title,
          company: job.company,
          summary: job.summary,
          hiddenHiringSignal: job.archetypeHint ?? job.roleDomain ?? job.summary,
          topRequirements,
        }
      : null,
    topRequirements,
    hiddenHiringSignal: job?.archetypeHint ?? job?.roleDomain ?? null,
    candidateProfile,
    candidateDiscoverySummary: candidateProfile
      ? {
          summary: candidateProfile.summary,
          projectsFound: jsonArrayLength(candidateProfile.projectsJson),
          skillsFound: stringArray(candidateProfile.skillsJson).length,
          toolsFound: stringArray(candidateProfile.toolsJson).length,
          experienceFound: jsonArrayLength(candidateProfile.experienceJson),
          educationFound: jsonArrayLength(candidateProfile.educationJson),
          certificationsFound: jsonArrayLength(candidateProfile.certificationsJson),
          strongEvidenceSignalsFound: candidateChunks.length,
        }
      : null,
    candidateChunks,
    evidenceMatches,
    requirementFitScores,
    evidenceMatchScore,
    originalEvidenceMatchScore: application.originalEvidenceMatchScore,
    updatedEvidenceMatchScore:
      application.updatedEvidenceMatchScore ?? evidenceMatchScore.score,
    matchLabel: application.matchLabel,
    cvAngle: application.cvAngle,
    roleArchetype: application.roleArchetype,
    matchAnalysis,
    strongMatches,
    weakSpots,
    gapQuestions,
    gapAnswers,
    gapCoachInsight,
    cvStrategy: null,
    cvDraft: clientCvDraft,
    cvJson: cvDraft?.cvJson ?? null,
    cvText: cvDraft?.cvText ?? null,
    agentRuns,
  };
}

export async function claimApplication(args: {
  anonymousSessionId: string;
  applicationId: string;
  clerkUserId: string;
}) {
  const user = await getOrCreateUser({ clerkUserId: args.clerkUserId });
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      OR: [{ anonymousSessionId: args.anonymousSessionId }, { userId: user.id }],
    },
  });
  if (!application) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Application does not belong to this session." });
  }
  return {
    application: await db.application.update({
      where: { id: args.applicationId },
      data: { userId: user.id },
    }),
  };
}

export async function listUserApplications(args: { clerkUserId: string }) {
  const user = await getOrCreateUser({ clerkUserId: args.clerkUserId });
  const applications = await db.application.findMany({
    where: { userId: user.id },
    include: {
      job: true,
      cvDrafts: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return {
    applications: applications.map((application) => ({
      id: application.id,
      dreamRole: application.dreamRole,
      jobTitle: application.job?.title ?? application.dreamRole ?? "Untitled role",
      company: application.job?.company,
      evidenceMatchScore: application.updatedEvidenceMatchScore,
      status: application.cvDrafts[0] ? "CV ready" : "Draft",
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      hasCv: !!application.cvDrafts[0],
    })),
  };
}

export async function getApplicationExportData(args: {
  clerkUserId: string;
  applicationId: string;
}) {
  const user = await getOrCreateUser({ clerkUserId: args.clerkUserId });
  const application = await db.application.findFirst({
    where: { id: args.applicationId, userId: user.id },
  });
  if (!application) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Application does not belong to your account." });
  }
  const cvDraft = await db.cvDraft.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { version: "desc" },
  });
  if (!cvDraft) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This application does not have a generated CV yet.",
    });
  }
  return {
    cvDraft: { ...cvDraft, presentationJson: stripCvPresentationDebug(cvDraft.presentationJson) },
  };
}
