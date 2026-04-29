import "server-only";

import { TRPCError } from "@trpc/server";

import { runCandidateProfilerAgent } from "~/server/agents/candidateProfiler.agent";
import { runCvRewriteAgent } from "~/server/agents/cvRewrite.agent";
import { runCvStrategyAgent } from "~/server/agents/cvStrategy.agent";
import { runCvWriterAgent } from "~/server/agents/cvWriter.agent";
import { runEvidenceChunkCreatorAgent } from "~/server/agents/evidenceChunkCreator.agent";
import { runEvidenceScoringAgent } from "~/server/agents/evidenceScoring.agent";
import { runGapQuestionAgent } from "~/server/agents/gapQuestion.agent";
import { runJobParserAgent } from "~/server/agents/jobParser.agent";
import { db } from "~/server/db";
import {
  buildCvStrategyContext,
  buildCvWriterContext,
} from "~/server/services/cv.service";
import {
  buildRequirementEvidenceMap,
  replaceWithScoredEvidenceMatches,
  retrieveCandidateEvidenceForRequirement,
} from "~/server/services/rag.service";
import { insertCandidateChunkWithEmbedding } from "~/server/tools/vectorSearch.tool";

const MAX_JOB_DESCRIPTION_CHARS = 20_000;
const MAX_CANDIDATE_BACKGROUND_CHARS = 30_000;

export async function assertApplicationForSession(args: {
  applicationId: string;
  anonymousSessionId: string;
}) {
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
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
    WHERE
      application_id = ${args.applicationId}
      AND anonymous_session_id = ${args.anonymousSessionId}
    ORDER BY created_at ASC
  `;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatCvSection(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return typeof value === "string" ? value : "";
}

function cvSectionValue(sectionId: string, text: string) {
  const cleaned = text
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  if (["header", "summary"].includes(sectionId)) {
    return cleaned.join(" ");
  }

  if (sectionId === "skills") {
    return text
      .split(/[\n,]/)
      .map((item) => item.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);
  }

  return cleaned;
}

function buildCvTextFromJson(cvJson: Record<string, unknown>) {
  const lines: string[] = [];
  const header = formatCvSection(cvJson.header);
  if (header) lines.push(header, "");

  const sections: Array<[string, string]> = [
    ["summary", "SUMMARY"],
    ["skills", "SKILLS"],
    ["projects", "PROJECTS"],
    ["experience", "EXPERIENCE"],
    ["education", "EDUCATION"],
    ["certifications", "CERTIFICATIONS"],
  ];

  for (const [sectionId, heading] of sections) {
    const value = cvJson[sectionId];
    const sectionLines = Array.isArray(value)
      ? value
          .map((item) => String(item).trim())
          .filter(Boolean)
          .map((item) => (sectionId === "skills" ? item : `- ${item}`))
      : formatCvSection(value)
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);

    if (sectionLines.length === 0) continue;
    lines.push(heading, sectionLines.join(sectionId === "skills" ? ", " : "\n"), "");
  }

  return lines.join("\n").trim();
}

async function scoreRequirement(args: {
  anonymousSessionId: string;
  applicationId: string;
  requirement: {
    id: string;
    label: string;
    description: string;
    importance: string;
  };
}) {
  const retrievedChunks = await retrieveCandidateEvidenceForRequirement({
    anonymousSessionId: args.anonymousSessionId,
    applicationId: args.applicationId,
    requirement: args.requirement,
  });

  const scoring = await runEvidenceScoringAgent({
    applicationId: args.applicationId,
    requirement: args.requirement,
    retrievedChunks,
  });

  await replaceWithScoredEvidenceMatches({
    applicationId: args.applicationId,
    requirementId: args.requirement.id,
    retrievedChunks,
    scoring,
  });
}

export async function createApplication(args: { anonymousSessionId: string }) {
  const application = await db.application.create({
    data: {
      anonymousSessionId: args.anonymousSessionId,
      status: "started",
      currentStep: "started",
    },
  });

  return {
    applicationId: application.id,
    anonymousSessionId: args.anonymousSessionId,
  };
}

export async function submitJob(args: {
  anonymousSessionId: string;
  applicationId: string;
  rawJobText: string;
}) {
  await assertApplicationForSession(args);

  if (args.rawJobText.length > MAX_JOB_DESCRIPTION_CHARS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Job description must be 20,000 characters or fewer",
    });
  }

  const parsedJob = await runJobParserAgent({
    applicationId: args.applicationId,
    rawJobText: args.rawJobText,
  });

  const existingJob = await db.job.findUnique({
    where: { applicationId: args.applicationId },
  });

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
        },
      });

  await db.jobRequirement.createMany({
    data: parsedJob.requirements.map((requirement) => ({
      jobId: job.id,
      type: requirement.type,
      label: requirement.label,
      description: requirement.description,
      importance: requirement.importance,
    })),
  });

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "job_added", currentStep: "job_added" },
  });

  const jobRequirements = await db.jobRequirement.findMany({
    where: { jobId: job.id },
    orderBy: { label: "asc" },
  });

  return { job, jobRequirements };
}

export async function submitCandidateInfo(args: {
  anonymousSessionId: string;
  applicationId: string;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
}) {
  await assertApplicationForSession(args);

  const combinedLength =
    (args.rawCvText?.length ?? 0) + (args.rawBackgroundText?.length ?? 0);
  if (combinedLength > MAX_CANDIDATE_BACKGROUND_CHARS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Candidate background must be 30,000 characters or fewer",
    });
  }

  const profileOutput = await runCandidateProfilerAgent({
    applicationId: args.applicationId,
    rawCvText: args.rawCvText,
    rawBackgroundText: args.rawBackgroundText,
  });

  const candidateProfile = await db.candidateProfile.upsert({
    where: { applicationId: args.applicationId },
    update: {
      rawCvText: args.rawCvText,
      rawBackgroundText: args.rawBackgroundText,
      summary: profileOutput.summary,
      skillsJson: profileOutput.skills,
      projectsJson: profileOutput.projects,
      educationJson: profileOutput.education,
      certificationsJson: profileOutput.certifications,
      experienceJson: profileOutput.experience,
      toolsJson: profileOutput.tools,
      achievementsJson: profileOutput.achievements,
    },
    create: {
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      rawCvText: args.rawCvText,
      rawBackgroundText: args.rawBackgroundText,
      summary: profileOutput.summary,
      skillsJson: profileOutput.skills,
      projectsJson: profileOutput.projects,
      educationJson: profileOutput.education,
      certificationsJson: profileOutput.certifications,
      experienceJson: profileOutput.experience,
      toolsJson: profileOutput.tools,
      achievementsJson: profileOutput.achievements,
    },
  });

  await db.candidateChunk.deleteMany({
    where: {
      applicationId: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
      sourceType: "profile",
    },
  });

  const chunkOutput = await runEvidenceChunkCreatorAgent({
    applicationId: args.applicationId,
    input: { mode: "profile", profile: profileOutput },
  });

  const candidateChunks = [];
  for (const chunk of chunkOutput.chunks) {
    candidateChunks.push(
      await insertCandidateChunkWithEmbedding({
        anonymousSessionId: args.anonymousSessionId,
        applicationId: args.applicationId,
        candidateProfileId: candidateProfile.id,
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        chunkType: chunk.chunkType,
        content: chunk.content,
        tags: chunk.tags,
        metadata: { candidateProfileId: candidateProfile.id },
      })
    );
  }

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "candidate_added", currentStep: "candidate_added" },
  });

  return { candidateProfile, candidateChunks };
}

export async function runEvidenceMatching(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  await assertApplicationForSession(args);

  const job = await db.job.findUnique({
    where: { applicationId: args.applicationId },
    include: { requirements: true },
  });
  const candidateChunkCount = await db.candidateChunk.count({
    where: {
      applicationId: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
    },
  });

  if (!job || job.requirements.length === 0 || candidateChunkCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Evidence matching requires a job and candidate chunks",
    });
  }

  for (const requirement of job.requirements) {
    await scoreRequirement({
      anonymousSessionId: args.anonymousSessionId,
      applicationId: args.applicationId,
      requirement,
    });
  }

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "evidence_ready", currentStep: "evidence_ready" },
  });

  return { evidenceMap: await buildRequirementEvidenceMap(args.applicationId) };
}

export async function generateGapQuestions(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  await assertApplicationForSession(args);

  const evidenceMatchCount = await db.evidenceMatch.count({
    where: { applicationId: args.applicationId },
  });
  if (evidenceMatchCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Gap questions require evidence matches",
    });
  }

  const candidateProfile = await db.candidateProfile.findUnique({
    where: { applicationId: args.applicationId },
  });
  const evidenceMap = await buildRequirementEvidenceMap(args.applicationId);

  if (evidenceMap.length === 0 || !candidateProfile) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Gap questions require a job and candidate profile",
    });
  }

  const questionOutput = await runGapQuestionAgent({
    applicationId: args.applicationId,
    evidenceMap,
    candidateProfileSummary: candidateProfile.summary,
  });

  await db.gapQuestion.deleteMany({
    where: { applicationId: args.applicationId, status: "unanswered" },
  });

  await db.gapQuestion.createMany({
    data: questionOutput.questions.slice(0, 5).map((question) => ({
      applicationId: args.applicationId,
      targetRequirementId: question.targetRequirementId,
      question: question.question,
      reason: question.reason,
      status: "unanswered",
    })),
  });

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "questions_ready", currentStep: "questions_ready" },
  });

  const gapQuestions = await db.gapQuestion.findMany({
    where: { applicationId: args.applicationId },
    orderBy: { createdAt: "asc" },
  });

  return { gapQuestions };
}

export async function answerGapQuestions(args: {
  anonymousSessionId: string;
  applicationId: string;
  answers: Array<{
    gapQuestionId: string;
    buttonAnswer: "yes" | "kind_of" | "no" | "skip";
    elaboration?: string | null;
  }>;
}) {
  await assertApplicationForSession(args);

  const newCandidateChunks = [];
  const affectedRequirementIds = new Set<string>();

  for (const answer of args.answers) {
    const gapQuestion = await db.gapQuestion.findFirst({
      where: {
        id: answer.gapQuestionId,
        applicationId: args.applicationId,
      },
      include: { targetRequirement: true },
    });

    if (!gapQuestion) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Gap question does not belong to this application",
      });
    }

    if (
      (answer.buttonAnswer === "yes" || answer.buttonAnswer === "kind_of") &&
      !answer.elaboration?.trim()
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Yes and Kind of answers require elaboration",
      });
    }

    const gapAnswer = await db.gapAnswer.create({
      data: {
        gapQuestionId: answer.gapQuestionId,
        applicationId: args.applicationId,
        buttonAnswer: answer.buttonAnswer,
        elaboration: answer.elaboration,
      },
    });

    await db.gapQuestion.update({
      where: { id: answer.gapQuestionId },
      data: {
        status: answer.buttonAnswer === "skip" ? "skipped" : "answered",
      },
    });

    if (gapQuestion.targetRequirementId) {
      affectedRequirementIds.add(gapQuestion.targetRequirementId);
    }

    if (
      (answer.buttonAnswer === "yes" || answer.buttonAnswer === "kind_of") &&
      answer.elaboration?.trim()
    ) {
      const chunkOutput = await runEvidenceChunkCreatorAgent({
        applicationId: args.applicationId,
        input: {
          mode: "gap_answer",
          question: gapQuestion.question,
          targetRequirement: gapQuestion.targetRequirement
            ? {
                id: gapQuestion.targetRequirement.id,
                label: gapQuestion.targetRequirement.label,
                description: gapQuestion.targetRequirement.description,
              }
            : null,
          buttonAnswer: answer.buttonAnswer,
          elaboration: answer.elaboration,
          gapAnswerId: gapAnswer.id,
        },
      });

      for (const chunk of chunkOutput.chunks) {
        newCandidateChunks.push(
          await insertCandidateChunkWithEmbedding({
            anonymousSessionId: args.anonymousSessionId,
            applicationId: args.applicationId,
            sourceType: chunk.sourceType,
            sourceId: gapAnswer.id,
            chunkType: chunk.chunkType,
            content: chunk.content,
            tags: chunk.tags,
            metadata: { gapAnswerId: gapAnswer.id },
          })
        );
      }
    }
  }

  if (affectedRequirementIds.size > 0) {
    const requirements = await db.jobRequirement.findMany({
      where: {
        id: { in: [...affectedRequirementIds] },
        job: { applicationId: args.applicationId },
      },
    });

    for (const requirement of requirements) {
      await scoreRequirement({
        anonymousSessionId: args.anonymousSessionId,
        applicationId: args.applicationId,
        requirement,
      });
    }
  }

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "answers_added", currentStep: "answers_added" },
  });

  return {
    updatedEvidenceMap: await buildRequirementEvidenceMap(args.applicationId),
    newCandidateChunks,
  };
}

export async function generateCvStrategy(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  await assertApplicationForSession(args);

  const evidenceMatchCount = await db.evidenceMatch.count({
    where: { applicationId: args.applicationId },
  });
  if (evidenceMatchCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CV strategy requires evidence matches",
    });
  }

  const context = await buildCvStrategyContext(args.applicationId);
  const strategyOutput = await runCvStrategyAgent({
    applicationId: args.applicationId,
    context,
  });

  const strategy = await db.cvStrategy.create({
    data: {
      applicationId: args.applicationId,
      strategySummary: strategyOutput.strategySummary,
      targetPositioning: strategyOutput.targetPositioning,
      sectionOrderJson: strategyOutput.sectionOrder,
      emphasisJson: strategyOutput.emphasis,
      deEmphasisJson: strategyOutput.deEmphasis,
      evidenceToUseJson: strategyOutput.evidenceToUse,
      warningsJson: strategyOutput.warnings,
    },
  });

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "strategy_ready", currentStep: "strategy_ready" },
  });

  return { strategy };
}

export async function generateCv(args: {
  anonymousSessionId: string;
  applicationId: string;
  strategyId: string;
}) {
  await assertApplicationForSession(args);

  const [job, candidateProfile, candidateChunkCount, evidenceMap, strategy] =
    await Promise.all([
      db.job.findUnique({
        where: { applicationId: args.applicationId },
      }),
      db.candidateProfile.findUnique({
        where: { applicationId: args.applicationId },
      }),
      db.candidateChunk.count({
        where: {
          applicationId: args.applicationId,
          anonymousSessionId: args.anonymousSessionId,
        },
      }),
      buildRequirementEvidenceMap(args.applicationId),
      db.cvStrategy.findFirst({
        where: { id: args.strategyId, applicationId: args.applicationId },
      }),
    ]);

  if (!job) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a job before generating the CV.",
    });
  }
  if (!candidateProfile || candidateChunkCount === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add your background before generating the CV.",
    });
  }
  if (evidenceMap.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Run job fit matching before generating the CV.",
    });
  }
  if (
    !evidenceMap.some(
      (row) =>
        row.overallConfidence === "high" || row.overallConfidence === "medium"
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "The CV needs at least one strong or partial job fit result before generation. Answer the clarification questions or add more background.",
    });
  }
  if (!strategy) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Create a CV plan before generating the CV.",
    });
  }

  const context = await buildCvWriterContext({
    applicationId: args.applicationId,
    strategyId: args.strategyId,
  });
  const cvOutput = await runCvWriterAgent({
    applicationId: args.applicationId,
    context,
  });
  const latestDraft = await db.cvDraft.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { version: "desc" },
  });

  const cvDraft = await db.cvDraft.create({
    data: {
      applicationId: args.applicationId,
      strategyId: args.strategyId,
      version: (latestDraft?.version ?? 0) + 1,
      cvJson: cvOutput.cvJson,
      cvText: cvOutput.cvText,
    },
  });

  await db.application.update({
    where: { id: args.applicationId },
    data: { status: "cv_ready", currentStep: "cv_ready" },
  });

  return { cvDraft };
}

export async function rewriteCvSection(args: {
  anonymousSessionId: string;
  applicationId: string;
  cvDraftId: string;
  sectionId: string;
  instruction: string;
}) {
  await assertApplicationForSession(args);

  const draft = await db.cvDraft.findFirst({
    where: { id: args.cvDraftId, applicationId: args.applicationId },
  });
  if (!draft) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CV draft does not belong to this application",
    });
  }

  const output = await runCvRewriteAgent({
    applicationId: args.applicationId,
    sectionId: args.sectionId,
    currentSection: formatCvSection(
      isRecord(draft.cvJson) ? draft.cvJson[args.sectionId] : ""
    ),
    instruction: args.instruction,
    context: await buildCvWriterContext({
      applicationId: args.applicationId,
      strategyId: draft.strategyId ?? "",
    }).catch(() => ({})),
  });

  const cvJson = {
    ...(isRecord(draft.cvJson) ? draft.cvJson : {}),
    [args.sectionId]: cvSectionValue(args.sectionId, output.updatedSection),
  };

  const updatedCvDraft = await db.cvDraft.update({
    where: { id: draft.id },
    data: {
      version: draft.version + 1,
      cvJson,
      cvText: buildCvTextFromJson(cvJson),
    },
  });

  return { updatedCvDraft };
}

export async function getApplicationState(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
    },
  });

  if (!application) {
    return null;
  }

  const [
    job,
    candidateProfile,
    candidateChunks,
    evidenceMatches,
    gapQuestions,
    gapAnswers,
    cvStrategy,
    cvDraft,
    agentRuns,
  ] = await Promise.all([
    db.job.findUnique({
      where: { applicationId: args.applicationId },
      include: { requirements: true },
    }),
    db.candidateProfile.findUnique({
      where: { applicationId: args.applicationId },
    }),
    loadCandidateChunks(args),
    buildRequirementEvidenceMap(args.applicationId),
    db.gapQuestion.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
    db.gapAnswer.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "asc" },
    }),
    db.cvStrategy.findFirst({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "desc" },
    }),
    db.cvDraft.findFirst({
      where: { applicationId: args.applicationId },
      orderBy: { version: "desc" },
    }),
    db.agentRun.findMany({
      where: { applicationId: args.applicationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    application,
    job,
    jobRequirements: job?.requirements ?? [],
    candidateProfile,
    candidateChunks,
    evidenceMatches,
    gapQuestions,
    gapAnswers,
    cvStrategy,
    cvDraft,
    agentRuns,
  };
}
