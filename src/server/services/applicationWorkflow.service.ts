import "server-only";

import { TRPCError } from "@trpc/server";
import type { Prisma } from "../../../generated/prisma/index.js";

import type { CandidateProfilerOutput } from "~/lib/types";
import { buildDeterministicMatchFraming } from "~/lib/deterministicMatchFraming";
import { buildEvidenceMatchPersistencePlan } from "~/lib/evidenceMatchPersistence";
import { selectGapQuestionTargets } from "~/lib/gapQuestionSelection";
import { calculateEvidenceMatchScoreFromRows } from "~/lib/scoring";
import { calculateGapAnswerBoost } from "~/lib/gapAnswerBoost";
import { parseStructuredCv } from "~/lib/cvDocument";
import { stripCvPresentationDebug } from "~/lib/cvPresentation";
import { runEvidenceFitScorerAgent } from "~/server/agents/evidenceFitScorer.agent";
import { runGapQuestionAgent } from "~/server/agents/gapQuestion.agent";
import { runGapAnswerEvaluatorAgent } from "~/server/agents/gapAnswerEvaluator.agent";
import { runCandidateProfilerAgent } from "~/server/agents/candidateProfiler.agent";
import { runCvBuilderAgent } from "~/server/agents/cvBuilder.agent";
import { runJobParserAgent } from "~/server/agents/jobParser.agent";
import { db } from "~/server/db";
import {
  claimAnonymousCandidateMemory,
  ensureRequirementQueryEmbeddings,
  getCandidateMemorySummary,
  loadCandidateMemoryChunks,
  loadLatestCandidateProfile,
  searchCandidateMemoryForRequirements,
  sourceTypeFromProfileSource,
  type CandidateMemoryChunkRow,
  type CandidateMemoryOwner,
  upsertCandidateMemoryChunks,
  upsertCandidateProfileMemory,
} from "~/server/services/candidateMemory.service";
import {
  buildEvidenceChunksFromProfile,
  buildGapAnswerEvidenceChunk,
} from "~/server/services/evidenceChunkBuilder.service";
import {
  buildRequirementEvidenceMap,
  calculateEvidenceMatchScore,
} from "~/server/services/rag.service";
import {
  checkAndRecordAbuse,
  isAbuseDenied,
} from "~/server/services/abuse.service";
import {
  assertCanGenerateCv,
  recordSuccessfulCvGeneration,
} from "~/server/services/entitlement.service";
import {
  calculateDeterministicAfterScore,
  compactCvRepairInstructions,
  composeDeterministicPresentation,
  repairCvOutput,
  runDeterministicCvQa,
} from "~/server/services/cvQa.service";
import { runWithTimingSummary, timedStep } from "~/server/services/timing.service";

const MAX_JOB_DESCRIPTION_CHARS = 20_000;
const MAX_CANDIDATE_BACKGROUND_CHARS = 30_000;
const LINKEDIN_FAILURE_MESSAGE =
  "We couldn’t read this LinkedIn profile automatically. Please upload your CV instead.";

export async function getLandingActivity() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await db.cvDraft.count({
    where: {
      createdAt: { gte: since },
    },
  });
  return {
    source: "live" as const,
    count,
    windowMinutes: 60,
    generatedAt: new Date(),
  };
}

type CandidateScanStep =
  | "parsing_profile"
  | "saving_profile"
  | "building_candidate_evidence"
  | "creating_evidence_map"
  | "matching_requirements"
  | "validating_scores"
  | "generating_questions"
  | "finalizing_match"
  | "match_ready"
  | "candidate_scan_failed";

type CandidateScanStatus =
  | "job_added"
  | "candidate_added"
  | "evidence_ready"
  | "questions_ready";

async function markCandidateScanStep(args: {
  applicationId: string;
  currentStep: CandidateScanStep;
  status?: CandidateScanStatus;
}) {
  await db.application.update({
    where: { id: args.applicationId },
    data: {
      currentStep: args.currentStep,
      ...(args.status ? { status: args.status } : {}),
    },
  });
}

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

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd().replace(/[.,;:!?-]+$/, "")}.`;
}

function questionJson(question: {
  question: string;
  targetRequirementLabel: string | null;
  whyItMatters?: string | null;
  answerGuidance?: string | null;
  reason?: string | null;
  exampleAnswer?: string | null;
}) {
  const whyThisMatters = question.whyItMatters ?? "";
  const howYourAnswerHelps = question.answerGuidance ?? "";
  const dynamicGuidance = question.reason ?? "";
  return {
    shortQuestion: question.question,
    linkedJobRequirement: question.targetRequirementLabel,
    whyThisMatters,
    howYourAnswerHelps,
    quickOptions: ["Yes", "Somewhat", "Not yet", "Skip"],
    selectedOptionRequiresDetail: true,
    followUpPrompt: "One short paragraph is enough: what did you do, where did it happen, and what changed?",
    dynamicGuidance,
    exampleAnswer: question.exampleAnswer ?? null,
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
  userId?: string | null;
}) {
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      OR: [
        { anonymousSessionId: args.anonymousSessionId },
        ...(args.userId ? [{ userId: args.userId }] : []),
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

async function resolveMemoryOwnerForApplication(args: {
  application: { userId: string | null };
  anonymousSessionId: string;
  userId?: string | null;
}): Promise<CandidateMemoryOwner> {
  return {
    anonymousSessionId: args.anonymousSessionId,
    userId: args.application.userId ?? args.userId ?? null,
  };
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

async function loadCandidateChunks(args: {
  owner: CandidateMemoryOwner;
}) {
  return loadCandidateMemoryChunks(args.owner);
}

type RetrievedEvidenceItem = {
  id: string;
  content: string;
  similarityScore: number;
  chunkType: string;
  sourceType: string;
  tagsJson: unknown;
  metadataJson: unknown;
};

type EvidenceRefItem = RetrievedEvidenceItem & {
  displayLabel: string;
};

const explicitEvidenceTerms = [
  "docker",
  "ci/cd",
  "cicd",
  "gitlab",
  "github actions",
  "typescript",
  "python",
  "postgresql",
  "pgvector",
  "ollama",
  "vllm",
  "qlora",
  "unsloth",
  "fine-tuning",
  "finetuning",
  "openai",
  "azure openai",
  "llm",
  "rag",
] as const;

function tokenizeRequirementText(requirement: { label: string; description: string }) {
  const text = `${requirement.label} ${requirement.description}`.toLowerCase();
  const terms = new Set<string>();
  for (const explicitTerm of explicitEvidenceTerms) {
    if (text.includes(explicitTerm)) terms.add(explicitTerm);
  }
  for (const token of text.match(/[a-z0-9+#.\/-]{3,}/g) ?? []) {
    if (
      ![
        "and",
        "the",
        "with",
        "for",
        "from",
        "using",
        "experience",
        "ability",
        "skills",
        "knowledge",
      ].includes(token)
    ) {
      terms.add(token);
    }
  }
  return [...terms];
}

function lexicalRescueCandidates(args: {
  requirement: { label: string; description: string };
  candidateChunks: RetrievedEvidenceItem[];
  existingIds: Set<string>;
  limit?: number;
}) {
  const terms = tokenizeRequirementText(args.requirement);
  if (terms.length === 0) return [];
  return args.candidateChunks
    .filter((chunk) => !args.existingIds.has(chunk.id))
    .map((chunk) => {
      const text = `${chunk.content} ${JSON.stringify(chunk.tagsJson)} ${JSON.stringify(
        chunk.metadataJson
      )}`.toLowerCase();
      const hits = terms.filter((term) => text.includes(term));
      return {
        chunk,
        hits: hits.length,
      };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.chunk.similarityScore - a.chunk.similarityScore)
    .slice(0, args.limit ?? 2)
    .map((item) => item.chunk);
}

function buildEvidenceRefsByRequirement(args: {
  requirements: Array<{ id: string; label: string; description: string }>;
  retrievalMap: Map<string, RetrievedEvidenceItem[]>;
  candidateChunks: RetrievedEvidenceItem[];
  maxPerRequirement?: number;
}) {
  const maxPerRequirement = args.maxPerRequirement ?? 6;
  return Object.fromEntries(
    args.requirements.map((requirement, requirementIndex) => {
      const vectorRows = args.retrievalMap.get(requirement.id) ?? [];
      const existingIds = new Set(vectorRows.map((chunk) => chunk.id));
      const rescued = lexicalRescueCandidates({
        requirement,
        candidateChunks: args.candidateChunks,
        existingIds,
      });
      const merged = [...vectorRows, ...rescued]
        .filter(
          (chunk, index, chunks) =>
            chunks.findIndex((candidate) => candidate.id === chunk.id) === index
        )
        .slice(0, maxPerRequirement);
      return [
        requirement.id,
        merged.map((chunk, evidenceIndex) => ({
          ...chunk,
          displayLabel: `R${requirementIndex + 1}E${evidenceIndex + 1}`,
        })),
      ];
    })
  ) as Record<string, EvidenceRefItem[]>;
}

async function persistBatchFit(args: {
  anonymousSessionId: string;
  applicationId: string;
  job: {
    title: string;
    company: string | null;
    summary: string;
    roleDomain?: string | null;
    archetypeHint?: string | null;
  };
  candidateProfileSummary: string;
  metricOpportunities: string[];
  scopeOpportunities: string[];
  jobRequirements: Array<{
    id: string;
    label: string;
    description: string;
    importance: string;
  }>;
  output: Awaited<ReturnType<typeof runEvidenceFitScorerAgent>>;
  evidenceRefsByRequirement: Record<string, EvidenceRefItem[]>;
  writeGapQuestions?: boolean;
}) {
  const writeGapQuestions = args.writeGapQuestions ?? true;
  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "validating_scores",
    status: "evidence_ready",
  });
  const {
    persistencePlan,
    scoreSummary,
    validatedQuestions,
    matchAnalysis,
  } = await timedStep(
    "score validation / persistence preparation",
    async () => {
      const validCandidateChunkIds = new Set(
        Object.values(args.evidenceRefsByRequirement)
          .flat()
          .map((chunk) => chunk.id)
      );
      const plan = buildEvidenceMatchPersistencePlan({
        applicationId: args.applicationId,
        jobRequirements: args.jobRequirements,
        output: args.output,
        evidenceRefsByRequirement: args.evidenceRefsByRequirement,
        validCandidateChunkIds,
      });
      if (plan.rejectedMatches.length > 0) {
        console.warn("taylor_rejected_evidence_selections", {
          applicationId: args.applicationId,
          rejectedMatches: plan.rejectedMatches,
        });
        throw new Error("Evidence scorer returned invalid candidate chunk selections.");
      }
      const summary = calculateEvidenceMatchScoreFromRows(plan.requirementFitScores);
      const requirementById = new Map(
        args.jobRequirements.map((requirement) => [requirement.id, requirement])
      );
      const evidenceByChunkId = new Map(
        Object.values(args.evidenceRefsByRequirement)
          .flat()
          .map((item) => [item.id, item])
      );
      const gapTargets = selectGapQuestionTargets(
        plan.requirementFitScores.flatMap((fitScore) => {
          const requirement = requirementById.get(fitScore.jobRequirementId);
          if (!requirement) return [];
          const selectedEvidence = fitScore.bestCandidateChunkId
            ? evidenceByChunkId.get(fitScore.bestCandidateChunkId)
            : null;
          return {
            jobRequirementId: requirement.id,
            label: requirement.label,
            description: requirement.description,
            importance: requirement.importance,
            finalConfidence: fitScore.finalConfidence,
            reason: fitScore.reason,
            selectedEvidenceSnippet:
              fitScore.finalConfidence === "low" && selectedEvidence
                ? compactText(selectedEvidence.content, 260)
                : null,
          };
        })
      );
      await markCandidateScanStep({
        applicationId: args.applicationId,
        currentStep: "generating_questions",
        status: "evidence_ready",
      });
      const strongestAreas = plan.requirementFitScores
        .filter(
          (fitScore) =>
            fitScore.finalConfidence === "high" || fitScore.finalConfidence === "medium"
        )
        .slice(0, 4)
        .map((fitScore) => requirementById.get(fitScore.jobRequirementId)?.label)
        .filter((label): label is string => !!label);
      const gapQuestionOutput =
        writeGapQuestions && gapTargets.length > 0
          ? await timedStep(
              "Gap Question Agent",
              () =>
                runGapQuestionAgent({
                  applicationId: args.applicationId,
                  input: {
                    job: args.job,
                    candidateContext: {
                      summary: compactText(args.candidateProfileSummary, 420),
                      strongestAreas,
                    },
                    targets: gapTargets,
                  },
                }),
              { applicationId: args.applicationId, targetCount: gapTargets.length }
            )
          : { questions: [] };
      const questions = gapQuestionOutput.questions;
      const evidenceCards = plan.requirementFitScores.flatMap((fitScore) => {
        if (!fitScore.bestCandidateChunkId || fitScore.finalConfidence === "missing") return [];
        const requirement = requirementById.get(fitScore.jobRequirementId);
        const evidence = evidenceByChunkId.get(fitScore.bestCandidateChunkId);
        return {
          requirementId: fitScore.jobRequirementId,
          requirementLabel: requirement?.label ?? "Role requirement",
          candidateChunkId: fitScore.bestCandidateChunkId,
          content: evidence?.content ?? "Relevant candidate evidence found.",
          confidence: fitScore.finalConfidence,
          reason: fitScore.reason,
          claimRisk:
            plan.evidenceMatches.find(
              (match) => match.jobRequirementId === fitScore.jobRequirementId
            )?.claimRisk ?? "careful_wording",
        };
      });
      const deterministicFraming = await timedStep(
        "deterministic match framing generation",
        async () =>
          buildDeterministicMatchFraming({
            job: args.job,
            candidateProfileSummary: args.candidateProfileSummary,
            metricOpportunities: args.metricOpportunities,
            scopeOpportunities: args.scopeOpportunities,
            requirements: args.jobRequirements,
            fitScores: plan.requirementFitScores,
            evidenceMatches: plan.evidenceMatches,
            gapTargets,
            scoreSummary: summary,
          }),
        {
          applicationId: args.applicationId,
          strengthCandidateCount: plan.requirementFitScores.length,
          gapQuestionCount: questions.length,
        }
      );
      return {
        persistencePlan: plan,
        scoreSummary: summary,
        validatedQuestions: questions,
        matchAnalysis: {
          ...args.output,
          ...deterministicFraming,
          currentMatchScore: summary.score,
          evidenceCards,
          recommendedGapQuestions: questions,
        },
      };
    },
    { applicationId: args.applicationId }
  );

  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "finalizing_match",
    status: "evidence_ready",
  });
  await db.$transaction(async (tx) => {
	    await timedStep(
	      "evidence match persistence",
	      async () => {
	        await tx.evidenceMatch.deleteMany({ where: { applicationId: args.applicationId } });
	        if (persistencePlan.evidenceMatches.length > 0) {
	          await tx.evidenceMatch.createMany({
	            data: persistencePlan.evidenceMatches.map((match) => ({
	              applicationId: match.applicationId,
	              jobRequirementId: match.jobRequirementId,
	              candidateChunkId: match.candidateChunkId,
	              similarityScore: match.similarityScore,
	              confidence: match.confidence,
	              cvUsefulness: match.cvUsefulness,
	              claimRisk: match.claimRisk,
	              reason: match.reason,
	            })),
	          });
	        }
	      },
      { applicationId: args.applicationId, rowCount: persistencePlan.evidenceMatches.length }
    );

	    await timedStep(
	      "requirement fit score persistence",
	      async () => {
	        await tx.requirementFitScore.deleteMany({ where: { applicationId: args.applicationId } });
	        await tx.cvDraft.deleteMany({ where: { applicationId: args.applicationId } });
	        if (persistencePlan.requirementFitScores.length > 0) {
	          await tx.requirementFitScore.createMany({
	            data: persistencePlan.requirementFitScores.map((fitScore) => ({
	              applicationId: fitScore.applicationId,
	              jobRequirementId: fitScore.jobRequirementId,
	              finalConfidence: fitScore.finalConfidence,
	              bestCandidateChunkId: fitScore.bestCandidateChunkId,
	              reason: fitScore.reason,
	              importanceWeight: fitScore.importanceWeight,
	              confidenceValue: fitScore.confidenceValue,
	              earnedPoints: fitScore.earnedPoints,
	              possiblePoints: fitScore.possiblePoints,
	            })),
	          });
	        }
	      },
      { applicationId: args.applicationId, rowCount: persistencePlan.requirementFitScores.length }
    );

    await timedStep(
      "gap question persistence",
      async () => {
        if (!writeGapQuestions) return;
        await tx.gapAnswer.deleteMany({ where: { applicationId: args.applicationId } });
        await tx.gapQuestion.deleteMany({ where: { applicationId: args.applicationId } });
        await tx.gapCoachInsight.deleteMany({ where: { applicationId: args.applicationId } });
        await tx.gapCoachInsight.create({
          data: {
            applicationId: args.applicationId,
            openingMessage: matchAnalysis.coachInsight.openingMessage,
            jobWants: matchAnalysis.coachInsight.jobWants,
            candidateStrengthsJson: inputJson(matchAnalysis.coachInsight.candidateStrengths),
            candidateConcernsJson: inputJson(matchAnalysis.coachInsight.candidateConcerns),
          },
        });
        if (validatedQuestions.length > 0) {
          const targetLabelById = new Map(
            args.jobRequirements.map((requirement) => [requirement.id, requirement.label])
          );
          await tx.gapQuestion.createMany({
            data: validatedQuestions.map((question) => ({
              applicationId: args.applicationId,
              targetRequirementId: question.targetRequirementId,
              question: question.question,
              reason: question.reason,
              whyItMatters: question.whyItMatters,
              answerGuidance: question.answerGuidance,
              exampleAnglesJson: inputJson(question.exampleAngles),
              questionJson: inputJson(
                questionJson({
                  ...question,
                  targetRequirementLabel: question.targetRequirementId
                    ? targetLabelById.get(question.targetRequirementId) ?? null
                    : null,
                })
              ),
              status: "unanswered" as const,
            })),
          });
        }
      },
      { applicationId: args.applicationId, rowCount: validatedQuestions.length }
    );
  });

  return {
    scoreSummary,
    matchAnalysis,
    gapQuestionCount: validatedQuestions.length,
  };
}

function rejectedEvidenceSelectionsForOutput(args: {
  applicationId: string;
  jobRequirements: Array<{ id: string; label: string; importance: string }>;
  output: Awaited<ReturnType<typeof runEvidenceFitScorerAgent>>;
  evidenceRefsByRequirement: Record<string, EvidenceRefItem[]>;
}) {
  const validCandidateChunkIds = new Set(
    Object.values(args.evidenceRefsByRequirement)
      .flat()
      .map((chunk) => chunk.id)
  );
  return buildEvidenceMatchPersistencePlan({
    applicationId: args.applicationId,
    jobRequirements: args.jobRequirements,
    output: args.output,
    evidenceRefsByRequirement: args.evidenceRefsByRequirement,
    validCandidateChunkIds,
  }).rejectedMatches;
}

async function prepareFastMatch(args: {
  anonymousSessionId: string;
  applicationId: string;
  owner: CandidateMemoryOwner;
  writeGapQuestions?: boolean;
}) {
  const writeGapQuestions = args.writeGapQuestions ?? true;
  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "creating_evidence_map",
    status: "candidate_added",
  });
  const jobPromise = db.job.findUnique({
    where: { applicationId: args.applicationId },
    include: { requirements: true },
  });
  const candidateProfilePromise = loadLatestCandidateProfile(args.owner);
  const candidateChunksPromise = loadCandidateMemoryChunks(args.owner);
  const job = await jobPromise;
  if (!job) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a job before scanning your background.",
    });
  }
  const rankedRequirements = [...job.requirements]
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.importance] - rank[b.importance];
    })
    .slice(0, 14);
  const retrievalMapPromise = searchCandidateMemoryForRequirements({
    owner: args.owner,
    requirements: rankedRequirements,
    topK: 5,
    applicationId: args.applicationId,
  });
  const [candidateProfile, candidateChunks, retrievalMap] = await Promise.all([
    candidateProfilePromise,
    candidateChunksPromise,
    retrievalMapPromise,
  ]);
  if (!candidateProfile || candidateChunks.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add or reuse candidate background before matching this role.",
    });
  }
  const normalizedRetrievalMap = new Map(
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
  const evidenceRefsByRequirement = buildEvidenceRefsByRequirement({
    requirements: rankedRequirements,
    retrievalMap: normalizedRetrievalMap,
    candidateChunks: candidateChunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      similarityScore: 0,
      chunkType: chunk.chunkType,
      sourceType: chunk.sourceType,
      tagsJson: chunk.tagsJson,
      metadataJson: chunk.metadataJson,
    })),
  });

  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "matching_requirements",
    status: "evidence_ready",
  });
  const scorerInput = {
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
    candidateProfileSummary: candidateProfile.summary,
    retrievedEvidenceByRequirement: evidenceRefsByRequirement,
    metricOpportunities: stringArray(candidateProfile.metricOpportunitiesJson),
    scopeOpportunities: stringArray(candidateProfile.scopeOpportunitiesJson),
    roleDomain: job.roleDomain,
    archetypeHint: job.archetypeHint,
  };

  let fitOutput = await timedStep(
    "Evidence Fit Scorer Agent",
    () =>
      runEvidenceFitScorerAgent({
        applicationId: args.applicationId,
        input: scorerInput,
      }),
    { applicationId: args.applicationId }
  );
  const rejectedSelections = rejectedEvidenceSelectionsForOutput({
    applicationId: args.applicationId,
    jobRequirements: rankedRequirements,
    output: fitOutput,
    evidenceRefsByRequirement,
  });
  if (rejectedSelections.length > 0) {
    console.warn("taylor_repairing_evidence_selections", {
      applicationId: args.applicationId,
      rejectedSelections,
    });
    fitOutput = await timedStep(
      "repair scorer call",
      () =>
        runEvidenceFitScorerAgent({
          applicationId: args.applicationId,
          input: { ...scorerInput, repairInstructions: rejectedSelections },
        }),
      { applicationId: args.applicationId, rejectedSelectionCount: rejectedSelections.length }
    );
    const stillRejected = rejectedEvidenceSelectionsForOutput({
      applicationId: args.applicationId,
      jobRequirements: rankedRequirements,
      output: fitOutput,
      evidenceRefsByRequirement,
    });
    if (stillRejected.length > 0) {
      console.warn("taylor_evidence_selection_repair_failed", {
        applicationId: args.applicationId,
        rejectedSelections: stillRejected,
      });
      throw new Error("Evidence scorer returned invalid candidate chunk selections after repair.");
    }
  }

  const persistedFit = await persistBatchFit({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    job: {
      title: job.title,
      company: job.company,
      summary: job.summary,
      roleDomain: job.roleDomain,
      archetypeHint: job.archetypeHint,
    },
    candidateProfileSummary: candidateProfile.summary,
    metricOpportunities: stringArray(candidateProfile.metricOpportunitiesJson),
    scopeOpportunities: stringArray(candidateProfile.scopeOpportunitiesJson),
    jobRequirements: rankedRequirements,
    output: fitOutput,
    evidenceRefsByRequirement,
    writeGapQuestions,
  });

  await timedStep(
    "application final status update",
    () =>
      db.application.update({
        where: { id: args.applicationId },
        data: {
          status: "questions_ready",
          currentStep: "match_ready",
          originalEvidenceMatchScore: persistedFit.scoreSummary.score,
          updatedEvidenceMatchScore: null,
          matchLabel: persistedFit.matchAnalysis.matchLabel,
          cvAngle: persistedFit.matchAnalysis.cvAngle,
          roleArchetype: persistedFit.matchAnalysis.roleArchetype,
          matchAnalysisJson: inputJson(persistedFit.matchAnalysis),
        },
      }),
    { applicationId: args.applicationId }
  );

  return persistedFit.matchAnalysis;
}

export async function createApplication(args: {
  anonymousSessionId: string;
  userId?: string | null;
}) {
  const application = await db.application.create({
    data: {
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      status: "started",
      currentStep: "started",
    },
  });
  return { applicationId: application.id, anonymousSessionId: args.anonymousSessionId };
}

export async function resetApplication(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
}) {
  await assertApplicationForSession(args);
  await db.application.delete({ where: { id: args.applicationId } });
  return createApplication({
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
}

export async function submitJob(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  headers?: Headers;
  resHeaders?: Headers;
  rawJobText: string;
}) {
  const application = await assertApplicationForSession(args);
  if (args.headers) {
    const abuse = await checkAndRecordAbuse({
      action: "anonymous_analysis",
      headers: args.headers,
      resHeaders: args.resHeaders,
      userId: args.userId,
      anonymousSessionId: args.anonymousSessionId,
      metadata: { stage: "submitJob" },
    });
    if (isAbuseDenied(abuse.decision)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many analysis attempts. Try again shortly.",
      });
    }
  }
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
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
  const jobRequirements = await db.jobRequirement.findMany({
    where: { jobId: job.id },
    orderBy: { label: "asc" },
  });
  await ensureRequirementQueryEmbeddings({
    requirements: jobRequirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      description: requirement.description,
    })),
    applicationId: args.applicationId,
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
  return { job, jobRequirements };
}

type SubmitCandidateProfileSourceArgs = {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  headers?: Headers;
  resHeaders?: Headers;
  source: "cv_upload" | "linkedin_url";
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  sourceUrl?: string | null;
};

export async function submitCandidateProfileSource(args: SubmitCandidateProfileSourceArgs) {
  return runWithTimingSummary({
    applicationId: args.applicationId,
    flow: "submitCandidateProfileSource",
    totalStage: "total submitCandidateProfileSource time",
    fn: () => submitCandidateProfileSourceTimed(args),
  });
}

async function submitCandidateProfileSourceTimed(args: SubmitCandidateProfileSourceArgs) {
  const application = await assertApplicationForSession(args);
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
  if (args.headers) {
    const abuse = await checkAndRecordAbuse({
      action: "anonymous_analysis",
      headers: args.headers,
      resHeaders: args.resHeaders,
      userId: args.userId,
      anonymousSessionId: args.anonymousSessionId,
      metadata: { stage: "submitCandidateProfileSource" },
    });
    if (isAbuseDenied(abuse.decision)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many analysis attempts. Try again shortly.",
      });
    }
  }
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

  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "parsing_profile",
    status: "job_added",
  });
  const profileOutput = await timedStep(
    "Candidate Profiler Agent",
    () =>
      runCandidateProfilerAgent({
        applicationId: args.applicationId,
        rawCvText,
        rawBackgroundText,
    }),
    { applicationId: args.applicationId }
  );
  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "saving_profile",
    status: "job_added",
  });
  const candidateProfile = await timedStep(
    "candidate profile save",
    () =>
      upsertCandidateProfileMemory({
        owner,
        sourceApplicationId: args.applicationId,
        rawCvText,
        rawBackgroundText,
        profileOutput,
        profileSource: args.source,
        sourceSummary: profileOutput.sourceSummary,
        sourceUrl,
    }),
    { applicationId: args.applicationId }
  );
  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "building_candidate_evidence",
    status: "candidate_added",
  });
  const builtChunks = await timedStep(
    "candidate memory chunk building",
    async () =>
      buildEvidenceChunksFromProfile({
        anonymousSessionId: args.anonymousSessionId,
        userId: owner.userId,
        sourceApplicationId: args.applicationId,
        candidateProfileId: candidateProfile.id,
        sourceType: sourceTypeFromProfileSource(args.source),
        profile: profileOutput,
      }),
    { applicationId: args.applicationId }
  );
  await upsertCandidateMemoryChunks({
    owner,
    chunks: builtChunks,
    applicationId: args.applicationId,
  });
  await markCandidateScanStep({
    applicationId: args.applicationId,
    currentStep: "creating_evidence_map",
    status: "candidate_added",
  });
  let matchAnalysis: Awaited<ReturnType<typeof prepareFastMatch>>;
  try {
    matchAnalysis = await prepareFastMatch({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      owner,
    });
  } catch (error) {
    console.error("taylor_candidate_scan_failed", {
      applicationId: args.applicationId,
      error: safeErrorMessage(error),
    });
    await markCandidateScanStep({
      applicationId: args.applicationId,
      currentStep: "candidate_scan_failed",
      status: "candidate_added",
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

export async function useSavedCandidateMemory(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
}) {
  const application = await assertApplicationForSession(args);
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
  const summary = await getCandidateMemorySummary(owner);
  if (!summary.hasMemory) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No saved candidate profile is available yet.",
    });
  }

  try {
    const matchAnalysis = await prepareFastMatch({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      owner,
    });
    return {
      importStatus: "match_ready" as const,
      candidateMemorySummary: summary,
      matchAnalysis,
    };
  } catch (error) {
    console.error("taylor_saved_memory_match_failed", {
      applicationId: args.applicationId,
      error: safeErrorMessage(error),
    });
    await markCandidateScanStep({
      applicationId: args.applicationId,
      currentStep: "candidate_scan_failed",
      status: "candidate_added",
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong while matching your saved profile. Please try again.",
    });
  }
}

export async function answerGapQuestions(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  answers: Array<{
    gapQuestionId: string;
    answerText?: string | null;
    selectedOption?: string | null;
    followUpText?: string | null;
    metricText?: string | null;
    skipped?: boolean | null;
  }>;
}) {
  const application = await assertApplicationForSession(args);
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });

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
          userId: owner.userId,
          sourceApplicationId: args.applicationId,
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

  let upsertedChunks: Awaited<ReturnType<typeof upsertCandidateMemoryChunks>> | null = null;
  if (chunks.length > 0) {
    upsertedChunks = await timedStep(
      "candidate memory upsert",
      () => upsertCandidateMemoryChunks({ owner, chunks, applicationId: args.applicationId }),
      { applicationId: args.applicationId, chunkCount: chunks.length, source: "gap_answers" }
    );
    await prepareFastMatch({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      owner,
      writeGapQuestions: false,
    });
  }
  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "answers_added", currentStep: "answers_added" },
  });

  return {
    updatedEvidenceMap: await buildRequirementEvidenceMap(args.applicationId),
    evidenceMatchScore: await calculateEvidenceMatchScore(args.applicationId),
    newCandidateChunks: upsertedChunks?.chunks ?? [],
  };
}

function acceptedGapAnswerStatus(status: string | null) {
  return status === "usable" || status === "use_carefully";
}

function compactChunk(chunk: CandidateMemoryChunkRow) {
  return {
    id: chunk.id,
    content: compactText(chunk.content, 560),
    chunkType: chunk.chunkType,
    sourceType: chunk.sourceType,
  };
}

export async function skipGapQuestion(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  gapQuestionId: string;
}) {
  await assertApplicationForSession(args);
  const question = await db.gapQuestion.findFirst({
    where: { id: args.gapQuestionId, applicationId: args.applicationId },
  });
  if (!question) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Gap question does not belong to this application",
    });
  }
  if (question.status === "unanswered") {
    await db.gapQuestion.update({
      where: { id: question.id },
      data: { status: "skipped" },
    });
  }
  return {
    gapQuestions: await db.gapQuestion.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
  };
}

export async function evaluateGapAnswerChatMessage(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  gapQuestionId: string;
  userMessage: string;
  onAssistantReplyDelta: (delta: string) => void | Promise<void>;
  onAcceptedBoost?: (boost: {
    boostPercent: number;
    totalBoostPercent: number;
  }) => void | Promise<void>;
}) {
  const application = await assertApplicationForSession(args);
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
  const [gapQuestion, job, candidateProfile, candidateChunks, previousGapAnswers] =
    await Promise.all([
      db.gapQuestion.findFirst({
        where: { id: args.gapQuestionId, applicationId: args.applicationId },
        include: { targetRequirement: true },
      }),
      db.job.findUnique({ where: { applicationId: args.applicationId } }),
      loadLatestCandidateProfile(owner),
      loadCandidateMemoryChunks(owner),
      db.gapAnswer.findMany({
        where: {
          applicationId: args.applicationId,
          usableStatus: { in: ["usable", "use_carefully"] },
        },
        include: { gapQuestion: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  if (!gapQuestion || gapQuestion.status !== "unanswered") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This gap question is no longer available.",
    });
  }
  if (!job || !candidateProfile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Taylor needs the role match before evaluating gap answers.",
    });
  }

  const fitScore = gapQuestion.targetRequirementId
    ? await db.requirementFitScore.findUnique({
        where: {
          applicationId_jobRequirementId: {
            applicationId: args.applicationId,
            jobRequirementId: gapQuestion.targetRequirementId,
          },
        },
      })
    : null;
  const relevantIds = new Set(
    [fitScore?.bestCandidateChunkId].filter((id): id is string => !!id)
  );
  const relevantChunks = [
    ...candidateChunks.filter((chunk) => relevantIds.has(chunk.id)),
    ...candidateChunks.filter((chunk) => !relevantIds.has(chunk.id)).slice(0, 5),
  ].slice(0, 6);
  const evaluatorOutput = await runGapAnswerEvaluatorAgent({
    applicationId: args.applicationId,
    input: {
      gapQuestion: {
        id: gapQuestion.id,
        question: gapQuestion.question,
        answerGuidance: gapQuestion.answerGuidance,
        targetRequirementId: gapQuestion.targetRequirementId,
      },
      targetRequirement: gapQuestion.targetRequirement
        ? {
            id: gapQuestion.targetRequirement.id,
            label: gapQuestion.targetRequirement.label,
            description: gapQuestion.targetRequirement.description,
            importance: gapQuestion.targetRequirement.importance,
            currentConfidence: fitScore?.finalConfidence ?? "missing",
            weaknessReason:
              fitScore?.reason ??
              "The current role match does not have clear evidence for this requirement.",
          }
        : null,
      userMessage: compactText(args.userMessage, 2200),
      job: {
        title: job.title,
        company: job.company,
        summary: compactText(job.summary, 520),
        roleDomain: job.roleDomain,
        archetypeHint: job.archetypeHint,
      },
      candidateProfileSummary: compactText(candidateProfile.summary, 720),
      relevantCandidateChunks: relevantChunks.map(compactChunk),
      previousGapAnswers: previousGapAnswers
        .filter((answer) => acceptedGapAnswerStatus(answer.usableStatus))
        .map((answer) => ({
          question: answer.originalQuestion ?? answer.gapQuestion.question,
          extractedEvidenceSummary:
            answer.extractedEvidenceSummary ?? answer.elaboration ?? "",
          usableStatus: answer.usableStatus as "usable" | "use_carefully",
        }))
        .filter((answer) => !!answer.extractedEvidenceSummary),
      matchAnalysis: application.matchAnalysisJson,
    },
    onAssistantReplyDelta: args.onAssistantReplyDelta,
  });

  const shouldPersist =
    evaluatorOutput.shouldSaveEvidence &&
    acceptedGapAnswerStatus(evaluatorOutput.usableStatus) &&
    !!evaluatorOutput.extractedEvidenceSummary?.trim();
  if (!shouldPersist) {
    return {
      evaluatorOutput,
      savedGapAnswerId: null,
      boostPercent: 0,
      totalBoostPercent: previousGapAnswers.reduce(
        (sum, answer) => sum + (answer.boostPercent ?? 0),
        0
      ),
      evidenceMatchScore: await calculateEvidenceMatchScore(args.applicationId),
      gapQuestions: await db.gapQuestion.findMany({
        where: { applicationId: args.applicationId },
        orderBy: { createdAt: "asc" },
      }),
    };
  }

  const previousBoostTotal = previousGapAnswers.reduce(
    (sum, answer) => sum + (answer.boostPercent ?? 0),
    0
  );
  const boost = calculateGapAnswerBoost({
    output: evaluatorOutput,
    importance: gapQuestion.targetRequirement?.importance ?? "low",
    currentConfidence: fitScore?.finalConfidence ?? "missing",
    previousBoostTotal,
    originalMatchScore:
      application.originalEvidenceMatchScore ??
      (await calculateEvidenceMatchScore(args.applicationId)).score,
  });
  const gapAnswer = await db.gapAnswer.create({
    data: {
      applicationId: args.applicationId,
      gapQuestionId: gapQuestion.id,
      userId: owner.userId,
      targetRequirementId: gapQuestion.targetRequirementId,
      buttonAnswer: "yes",
      elaboration: evaluatorOutput.extractedEvidenceSummary,
      rawUserAnswer: compactText(args.userMessage, 4000),
      extractedEvidenceSummary: evaluatorOutput.extractedEvidenceSummary,
      originalQuestion: gapQuestion.question,
      usableStatus: evaluatorOutput.usableStatus,
      evidenceQuality: evaluatorOutput.evidenceQuality,
      boostPercent: boost.boostPercent,
      source: "gap_question_chat",
      skipped: false,
    },
  });
  await db.gapQuestion.update({
    where: { id: gapQuestion.id },
    data: { status: "answered" },
  });
  await args.onAcceptedBoost?.({
    boostPercent: boost.boostPercent,
    totalBoostPercent: boost.totalBoostPercent,
  });
  const chunk = buildGapAnswerEvidenceChunk({
    anonymousSessionId: args.anonymousSessionId,
    userId: owner.userId,
    sourceApplicationId: args.applicationId,
    gapAnswerId: gapAnswer.id,
    gapQuestionId: gapQuestion.id,
    targetRequirementId: gapQuestion.targetRequirementId,
    targetRequirementLabel: gapQuestion.targetRequirement?.label ?? null,
    selectedOption: null,
    followUpText: null,
    metricText: null,
    answerText: evaluatorOutput.extractedEvidenceSummary,
    trustLevel:
      evaluatorOutput.usableStatus === "use_carefully" ? "use_carefully" : "usable",
    rawUserAnswer: args.userMessage,
    extractedEvidenceSummary: evaluatorOutput.extractedEvidenceSummary,
    evidenceQuality: evaluatorOutput.evidenceQuality,
    boostPercent: boost.boostPercent,
    originalQuestion: gapQuestion.question,
    source: "gap_question_chat",
  });
  if (chunk) {
    await upsertCandidateMemoryChunks({
      owner,
      chunks: [chunk],
      applicationId: args.applicationId,
    });
    await prepareFastMatch({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      owner,
      writeGapQuestions: false,
    });
  }
  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "answers_added", currentStep: "answers_added" },
  });
  return {
    evaluatorOutput,
    savedGapAnswerId: gapAnswer.id,
    boostPercent: boost.boostPercent,
    totalBoostPercent: boost.totalBoostPercent,
    evidenceMatchScore: await calculateEvidenceMatchScore(args.applicationId),
    gapQuestions: await db.gapQuestion.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
  };
}

function matchAnalysisObject(value: unknown) {
  return isRecord(value) ? value : {};
}

export async function generateCv(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
  headers: Headers;
  resHeaders?: Headers;
  strategyId?: string | null;
}) {
  const application = await assertApplicationForSession(args);
  const entitlement = args.userId
    ? await assertCanGenerateCv({
        userId: args.userId,
        anonymousSessionId: args.anonymousSessionId,
        headers: args.headers,
        resHeaders: args.resHeaders,
        allowUnverifiedEmail: true,
      })
    : null;
  if (!application.userId && args.userId) {
    await claimApplication({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      userId: args.userId,
    });
  }
  const owner = await resolveMemoryOwnerForApplication({
    application: { userId: application.userId ?? args.userId ?? null },
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
  const [job, candidateProfile, candidateChunks, gapAnswers, requirementFitScores] = await Promise.all([
    db.job.findUnique({ where: { applicationId: args.applicationId } }),
    loadLatestCandidateProfile(owner),
    loadCandidateChunks({ owner }),
    db.gapAnswer.findMany({
      where: {
        applicationId: args.applicationId,
        skipped: false,
        OR: [
          { usableStatus: { in: ["usable", "use_carefully"] } },
          { usableStatus: null },
        ],
      },
      include: { gapQuestion: true },
    }),
    db.requirementFitScore.findMany({
      where: { applicationId: args.applicationId },
      include: { jobRequirement: true },
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
    requirementFitScores,
    gapEvidence: trustedGapEvidence,
    gapAnswers,
    gapAnswerTrust: gapAnswers.map((answer) => ({
      id: answer.id,
      trustLevel:
        answer.usableStatus ??
        classifyGapAnswerTrust(
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
  const cvDraft = await db.$transaction(async (tx) => {
    const latestDraft = await tx.cvDraft.findFirst({
      where: { applicationId: args.applicationId },
      orderBy: { version: "desc" },
    });
    const draft = await tx.cvDraft.create({
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
    if (entitlement && args.userId) {
      await recordSuccessfulCvGeneration({
        tx,
        userId: args.userId,
        applicationId: args.applicationId,
        cvDraftId: draft.id,
        planKey: entitlement.planKey,
        billingPeriodStart: entitlement.periodStart,
        billingPeriodEnd: entitlement.periodEnd,
      });
    }
    await tx.application.update({
      where: { id: args.applicationId },
      data: {
        userId: args.userId ?? application.userId,
        status: "cv_ready",
        currentStep: "draft_ready",
        updatedEvidenceMatchScore: finalAfterScore,
        cvAngle: cvOutput.cvAngle,
        roleArchetype: cvOutput.roleArchetype,
      },
    });
    return draft;
  });
  return { cvDraft };
}

export async function getApplicationState(args: {
  anonymousSessionId: string;
  applicationId: string;
  userId?: string | null;
}) {
  const application = await assertApplicationForSession(args);
  const owner = await resolveMemoryOwnerForApplication({
    application,
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });

  const [
    job,
    candidateProfile,
    candidateChunks,
    candidateMemorySummary,
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
    loadLatestCandidateProfile(owner),
    loadCandidateChunks({ owner }),
    getCandidateMemorySummary(owner),
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
        id: `gap-${index}`,
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
    candidateMemorySummary,
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
    updatedEvidenceMatchScore: application.updatedEvidenceMatchScore,
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
  userId: string;
}) {
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      OR: [{ anonymousSessionId: args.anonymousSessionId }, { userId: args.userId }],
    },
  });
  if (!application) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Application does not belong to this session." });
  }
  await claimAnonymousCandidateMemory({
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId,
  });
  return {
    application: await db.application.update({
      where: { id: args.applicationId },
      data: { userId: args.userId },
    }),
  };
}

export async function listUserApplications(args: { userId: string }) {
  const applications = await db.application.findMany({
    where: { userId: args.userId },
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
  userId: string;
  applicationId: string;
}) {
  const application = await db.application.findFirst({
    where: { id: args.applicationId, userId: args.userId },
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
