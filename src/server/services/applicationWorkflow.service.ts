import "server-only";

import { TRPCError } from "@trpc/server";
import type { Prisma } from "../../../generated/prisma/index.js";

import { runCandidateProfilerAgent } from "~/server/agents/candidateProfiler.agent";
import { runCvLayoutStyleAgent } from "~/server/agents/cvLayoutStyle.agent";
import { runCvRewriteAgent } from "~/server/agents/cvRewrite.agent";
import { runCvQualityReviewAgent } from "~/server/agents/cvQualityReview.agent";
import { runCvStrategyAgent } from "~/server/agents/cvStrategy.agent";
import { runCvWriterAgent } from "~/server/agents/cvWriter.agent";
import { runEvidenceChunkCreatorAgent } from "~/server/agents/evidenceChunkCreator.agent";
import { runEvidenceScoringAgent } from "~/server/agents/evidenceScoring.agent";
import { runGapQuestionAgent } from "~/server/agents/gapQuestion.agent";
import { runJobParserAgent } from "~/server/agents/jobParser.agent";
import { db } from "~/server/db";
import { parseStructuredCv } from "~/lib/cvDocument";
import {
  normalizeCvPresentation,
  stripCvPresentationDebug,
} from "~/lib/cvPresentation";
import {
  buildCvStrategyContext,
  buildCvWriterContext,
} from "~/server/services/cv.service";
import {
  buildRequirementEvidenceMap,
  calculateEvidenceMatchScore,
  replaceWithScoredEvidenceMatches,
  retrieveCandidateEvidenceForRequirement,
  type RequirementEvidenceMapRow,
} from "~/server/services/rag.service";
import { insertCandidateChunkWithEmbedding } from "~/server/tools/vectorSearch.tool";

const MAX_JOB_DESCRIPTION_CHARS = 20_000;
const MAX_CANDIDATE_BACKGROUND_CHARS = 30_000;

async function clearGeneratedWork(applicationId: string) {
  await db.cvDraft.deleteMany({ where: { applicationId } });
  await db.cvStrategy.deleteMany({ where: { applicationId } });
  await db.gapAnswer.deleteMany({ where: { applicationId } });
  await db.gapQuestion.deleteMany({ where: { applicationId } });
  await db.gapCoachInsight.deleteMany({ where: { applicationId } });
  await db.requirementFitScore.deleteMany({ where: { applicationId } });
  await db.evidenceMatch.deleteMany({ where: { applicationId } });
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function jsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function normalizedText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const lowSignalWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "can",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function textTokens(value: string) {
  return new Set(
    normalizedText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !lowSignalWords.has(token))
  );
}

function gapCandidateRows(evidenceMap: RequirementEvidenceMapRow[]) {
  const importanceRank = { high: 0, medium: 1, low: 2 } as const;
  const confidenceRank = { missing: 0, weak: 1, medium: 2, high: 3 } as const;

  return evidenceMap
    .filter(
      (row) =>
        row.requirementImportance !== "low" &&
        row.overallConfidence !== "high"
    )
    .sort(
      (a, b) =>
        importanceRank[a.requirementImportance] -
          importanceRank[b.requirementImportance] ||
        confidenceRank[a.overallConfidence] - confidenceRank[b.overallConfidence]
    );
}

function resolveGapQuestionRequirementId(args: {
  question: {
    targetRequirementId: string | null;
    question: string;
    reason: string;
    whyItMatters: string;
    answerGuidance: string;
  };
  evidenceMap: RequirementEvidenceMapRow[];
  assignedRequirementIds: Set<string>;
}) {
  const validRequirementIds = new Set(
    args.evidenceMap.map((row) => row.requirementId)
  );
  const requestedId = args.question.targetRequirementId?.trim() ?? "";

  if (validRequirementIds.has(requestedId)) return requestedId;

  const searchableText = normalizedText(
    [
      requestedId,
      args.question.question,
      args.question.reason,
      args.question.whyItMatters,
      args.question.answerGuidance,
    ].join(" ")
  );
  const searchableTokens = textTokens(searchableText);
  let bestMatch: { requirementId: string; score: number } | null = null;

  for (const row of args.evidenceMap) {
    const labelText = normalizedText(row.requirementLabel);
    if (labelText && searchableText.includes(labelText)) {
      return row.requirementId;
    }

    const labelTokens = textTokens(row.requirementLabel);
    if (labelTokens.size === 0) continue;

    let overlap = 0;
    for (const token of labelTokens) {
      if (searchableTokens.has(token)) overlap += 1;
    }

    const score = overlap / labelTokens.size;
    if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { requirementId: row.requirementId, score };
    }
  }

  if (bestMatch) return bestMatch.requirementId;

  return (
    gapCandidateRows(args.evidenceMap).find(
      (row) => !args.assignedRequirementIds.has(row.requirementId)
    )?.requirementId ?? null
  );
}

function fallbackGapQuestions(evidenceMap: RequirementEvidenceMapRow[]) {
  return gapCandidateRows(evidenceMap).map((row) => ({
    targetRequirementId: row.requirementId,
    question: `Can you give one real example that proves ${row.requirementLabel}? What happened, what did you personally do, and what changed?`,
    reason: row.reason,
    whyItMatters: `This role appears to care about ${row.requirementLabel}, but the current evidence is only ${row.overallConfidence}.`,
    answerGuidance:
      "Mention the situation, your action, any tools or people involved, and the clearest honest result.",
    exampleAngles: [
      "a class or club project",
      "a work shift or internship",
      "a small project you organized or improved",
      "feedback, numbers, or a visible outcome",
    ],
  }));
}

function prepareGapQuestionsForInsert(args: {
  questions: Array<{
    targetRequirementId: string | null;
    question: string;
    reason: string;
    whyItMatters: string;
    answerGuidance: string;
    exampleAngles: string[];
  }>;
  evidenceMap: RequirementEvidenceMapRow[];
}) {
  const sourceQuestions =
    args.questions.length > 0
      ? args.questions
      : fallbackGapQuestions(args.evidenceMap);
  const assignedRequirementIds = new Set<string>();
  const seenQuestions = new Set<string>();
  const prepared = [];

  for (const question of sourceQuestions) {
    const questionText = question.question.trim();
    if (!questionText) continue;

    const targetRequirementId = resolveGapQuestionRequirementId({
      question,
      evidenceMap: args.evidenceMap,
      assignedRequirementIds,
    });
    if (targetRequirementId) assignedRequirementIds.add(targetRequirementId);

    const key = `${targetRequirementId ?? "unlinked"}:${normalizedText(
      questionText
    )}`;
    if (seenQuestions.has(key)) continue;
    seenQuestions.add(key);

    prepared.push({
      targetRequirementId,
      question: questionText,
      reason: question.reason.trim() || "Taylor needs a little more evidence.",
      whyItMatters:
        question.whyItMatters.trim() ||
        "This could help make the CV more specific and truthful.",
      answerGuidance:
        question.answerGuidance.trim() ||
        "Share what happened, what you did, and any honest result.",
      exampleAnglesJson: question.exampleAngles
        .map((angle) => angle.trim())
        .filter(Boolean) as Prisma.InputJsonValue,
      status: "unanswered" as const,
    });
  }

  if (prepared.length > 0) return prepared.slice(0, 5);

  return fallbackGapQuestions(args.evidenceMap)
    .slice(0, 5)
    .map((question) => ({
      targetRequirementId: question.targetRequirementId,
      question: question.question,
      reason: question.reason,
      whyItMatters: question.whyItMatters,
      answerGuidance: question.answerGuidance,
      exampleAnglesJson: question.exampleAngles as Prisma.InputJsonValue,
      status: "unanswered" as const,
    }));
}

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

function formatCvSection(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatCvSection(item))
      .filter(Boolean)
      .join("\n");
  }
  if (isRecord(value)) {
    if (Array.isArray(value.groups)) return formatCvSection(value.groups);
    const title = [
      formatCvSection(value.name),
      formatCvSection(value.descriptor),
      formatCvSection(value.title),
      formatCvSection(value.company),
      formatCvSection(value.degree),
      formatCvSection(value.institution),
      formatCvSection(value.dates),
    ]
      .filter(Boolean)
      .join(" - ");
    const bullets = formatCvSection(value.bullets);
    const details = formatCvSection(value.details);
    const items = formatCvSection(value.items);
    const label = formatCvSection(value.label);

    if (label && items) return `${label}: ${items}`;
    return [title, bullets, details].filter(Boolean).join("\n");
  }
  return typeof value === "string" ? value : "";
}

function cvSectionValue(sectionId: string, text: string) {
  const cleaned = text
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);

  if (["header", "summary"].includes(sectionId)) {
    return cleaned.join(" ");
  }

  if (sectionId === "skills") {
    const groups = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...items] = line.split(":");
        return {
          label: label?.trim() || "Skills",
          items: (items.join(":") || line)
            .split(",")
            .map((item) => item.trim().replace(/^[-*•]\s*/, ""))
            .filter(Boolean),
        };
      })
      .filter((group) => group.items.length > 0);

    return { groups };
  }

  if (sectionId === "projects") {
    return [
      {
        name: "Selected Projects",
        descriptor: null,
        dates: null,
        bullets: cleaned,
      },
    ];
  }

  if (sectionId === "experience") {
    return [
      {
        title: "Experience",
        company: null,
        dates: null,
        location: null,
        bullets: cleaned,
      },
    ];
  }

  if (sectionId === "education") {
    return [
      {
        institution: null,
        degree: cleaned[0] ?? null,
        dates: null,
        details: cleaned.slice(1),
      },
    ];
  }

  return cleaned;
}

function parseCvTarget(sectionId: string) {
  const [section, indexText] = sectionId.split(".");
  const index =
    typeof indexText === "string" && indexText.trim() !== ""
      ? Number(indexText)
      : null;

  return {
    section: section ?? sectionId,
    index: Number.isInteger(index) ? index : null,
  };
}

function readCvTarget(cvJson: unknown, sectionId: string) {
  if (!isRecord(cvJson)) return "";
  const target = parseCvTarget(sectionId);
  const value = cvJson[target.section];

  if (target.index !== null && Array.isArray(value)) {
    return formatCvSection(value[target.index]);
  }

  return formatCvSection(value);
}

function writeCvTarget(
  cvJson: Record<string, unknown>,
  sectionId: string,
  text: string
) {
  const target = parseCvTarget(sectionId);
  const nextCvJson = { ...cvJson };

  if (target.index !== null) {
    const current = nextCvJson[target.section];
    const currentItems = Array.isArray(current) ? [...current] : [];
    currentItems[target.index] = text.trim();
    nextCvJson[target.section] = currentItems.filter(Boolean);
    return nextCvJson;
  }

  nextCvJson[target.section] = cvSectionValue(target.section, text);
  return nextCvJson;
}

type CvSectionId =
  | "summary"
  | "projects"
  | "experience"
  | "skills"
  | "education"
  | "certifications";

const defaultCvSectionOrder: CvSectionId[] = [
  "summary",
  "projects",
  "experience",
  "skills",
  "education",
  "certifications",
];

function normalizeCvSectionId(section: string): CvSectionId | null {
  const normalized = section.toLowerCase().replace(/[^a-z]+/g, " ").trim();

  if (!normalized || normalized === "header") return null;
  if (normalized === "summary" || normalized === "professional summary") {
    return "summary";
  }
  if (
    normalized === "project" ||
    normalized === "projects" ||
    normalized === "selected project" ||
    normalized === "selected projects"
  ) {
    return "projects";
  }
  if (normalized === "experience" || normalized === "work experience") {
    return "experience";
  }
  if (normalized === "skill" || normalized === "skills") return "skills";
  if (normalized === "education") return "education";
  if (normalized === "certification" || normalized === "certifications") {
    return "certifications";
  }

  return null;
}

function orderedCvSections(sectionOrder: string[]) {
  const sections: CvSectionId[] = [];

  for (const section of sectionOrder) {
    const normalized = normalizeCvSectionId(section);
    if (normalized && !sections.includes(normalized)) sections.push(normalized);
  }

  for (const section of defaultCvSectionOrder) {
    if (!sections.includes(section)) sections.push(section);
  }

  return sections;
}

function strategySectionOrder(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((section) => (typeof section === "string" ? section.trim() : ""))
        .filter(Boolean)
    : [];
}

function applyStrategySectionOrder<
  TOutput extends { cvJson: { sectionOrder: string[] } },
>(cvOutput: TOutput, strategy: { sectionOrderJson: unknown }) {
  const sectionOrder = strategySectionOrder(strategy.sectionOrderJson);

  if (sectionOrder.length === 0) return cvOutput;

  return {
    ...cvOutput,
    cvJson: {
      ...cvOutput.cvJson,
      sectionOrder,
    },
  };
}

function cvLayoutRendererConstraints() {
  return {
    pageTarget: "one_page",
    controlledOutputOnly: true,
    noContentChanges: true,
    canonicalSectionIds: [
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
      "achievements",
      "links",
    ],
    accentUsage:
      "Accent may only be used for headings, dividers, selected labels, links, and small emphasis. Body text stays dark and metadata stays grey.",
    availableTemplates: [
      "technical_compact",
      "modern_professional",
      "creative_marketing",
      "graduate_clean",
      "executive_clean",
      "trades_practical",
      "retail_service",
      "analytical_finance",
      "project_heavy_builder",
    ],
  };
}

function buildCvTextFromJson(cvJson: Record<string, unknown>) {
  const lines: string[] = [];

  const textOrNull = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const textArray = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

  const header = cvJson.header;
  if (isRecord(header)) {
    const links = Array.isArray(header.links)
      ? header.links
          .filter(isRecord)
          .map((link) => {
            const label = textOrNull(link.label);
            const url = textOrNull(link.url);
            if (!url) return null;
            return label && label !== url ? `${label}: ${url}` : url;
          })
          .filter((link): link is string => Boolean(link))
      : [];
    const headerMeta = [
      textOrNull(header.targetTitle),
      textOrNull(header.location),
      textOrNull(header.phone),
      textOrNull(header.email),
      ...links,
    ].filter(Boolean);

    const name = textOrNull(header.name);
    if (name) lines.push(name);
    if (headerMeta.length > 0) lines.push(headerMeta.join(" | "));
    if (name || headerMeta.length > 0) lines.push("");
  } else {
    const legacyHeader = formatCvSection(header);
    if (legacyHeader) lines.push(legacyHeader, "");
  }

  const appendSection: Record<CvSectionId, () => void> = {
    summary: () => {
      const summary = formatCvSection(cvJson.summary);
      if (summary) lines.push("SUMMARY", summary, "");
    },
    projects: () => {
      const projects = Array.isArray(cvJson.projects)
        ? cvJson.projects.filter(isRecord)
        : [];
      if (projects.length === 0) return;

      lines.push("SELECTED PROJECTS");
      for (const project of projects) {
        const title = [
          textOrNull(project.name),
          textOrNull(project.descriptor),
          textOrNull(project.dates),
        ]
          .filter(Boolean)
          .join(" | ");
        if (title) lines.push(title);
        lines.push(
          ...textArray(project.bullets).map((bullet) => `- ${bullet}`)
        );
      }
      lines.push("");
    },
    experience: () => {
      const experience = Array.isArray(cvJson.experience)
        ? cvJson.experience.filter(isRecord)
        : [];
      if (experience.length === 0) return;

      lines.push("EXPERIENCE");
      for (const item of experience) {
        const title = [
          textOrNull(item.title),
          textOrNull(item.company),
          textOrNull(item.dates),
          textOrNull(item.location),
        ]
          .filter(Boolean)
          .join(" | ");
        if (title) lines.push(title);
        lines.push(...textArray(item.bullets).map((bullet) => `- ${bullet}`));
      }
      lines.push("");
    },
    skills: () => {
      const skills = cvJson.skills;
      if (!isRecord(skills) || !Array.isArray(skills.groups)) return;

      const skillLines = skills.groups
        .filter(isRecord)
        .map((group) => {
          const label = textOrNull(group.label);
          const items = textArray(group.items);
          return label && items.length > 0
            ? `${label}: ${items.join(", ")}`
            : null;
        })
        .filter((line): line is string => Boolean(line));

      if (skillLines.length > 0) lines.push("SKILLS", ...skillLines, "");
    },
    education: () => {
      const education = Array.isArray(cvJson.education)
        ? cvJson.education.filter(isRecord)
        : [];
      if (education.length === 0) return;

      lines.push("EDUCATION");
      for (const item of education) {
        const title = [
          textOrNull(item.degree),
          textOrNull(item.institution),
          textOrNull(item.dates),
        ]
          .filter(Boolean)
          .join(" | ");
        if (title) lines.push(title);
        const details = textArray(item.details);
        if (details.length > 0) lines.push(details.join("; "));
      }
      lines.push("");
    },
    certifications: () => {
      const certifications = textArray(cvJson.certifications);
      if (certifications.length > 0) {
        lines.push("CERTIFICATIONS", certifications.join("; "), "");
      }
    },
  };

  for (const section of orderedCvSections(textArray(cvJson.sectionOrder))) {
    appendSection[section]();
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
    requirement: args.requirement,
    retrievedChunks,
    scoring,
  });
}

export async function setDreamRole(args: {
  anonymousSessionId: string;
  applicationId: string;
  dreamRole: string;
}) {
  await assertApplicationForSession(args);

  const dreamRole = args.dreamRole.trim();
  if (!dreamRole) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tell Taylor the role you want first.",
    });
  }

  const application = await db.application.update({
    where: { id: args.applicationId },
    data: {
      dreamRole,
      status: "started",
      currentStep: "dream_role_added",
    },
  });

  return { application };
}

export async function resetApplication(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  await assertApplicationForSession(args);

  await db.application.delete({ where: { id: args.applicationId } });

  return createApplication({ anonymousSessionId: args.anonymousSessionId });
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
    data: {
      status: "job_added",
      currentStep: "job_added",
      originalEvidenceMatchScore: null,
      updatedEvidenceMatchScore: null,
    },
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

  await clearGeneratedWork(args.applicationId);

  await db.candidateChunk.deleteMany({
    where: {
      applicationId: args.applicationId,
      anonymousSessionId: args.anonymousSessionId,
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
    data: {
      status: "candidate_added",
      currentStep: "candidate_added",
      originalEvidenceMatchScore: null,
      updatedEvidenceMatchScore: null,
    },
  });

  return { candidateProfile, candidateChunks };
}

export async function runEvidenceMatching(args: {
  anonymousSessionId: string;
  applicationId: string;
}) {
  const application = await assertApplicationForSession(args);

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

  const score = await calculateEvidenceMatchScore(args.applicationId);

  await db.application.update({
    where: { id: args.applicationId },
    data: {
      status: "evidence_ready",
      currentStep: "evidence_ready",
      originalEvidenceMatchScore:
        application.originalEvidenceMatchScore ?? score.score,
      updatedEvidenceMatchScore: score.score,
    },
  });

  return {
    evidenceMap: await buildRequirementEvidenceMap(args.applicationId),
    evidenceMatchScore: score,
  };
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

  const questionsToCreate = prepareGapQuestionsForInsert({
    questions: questionOutput.questions,
    evidenceMap,
  });

  await db.$transaction(async (tx) => {
    await tx.gapCoachInsight.upsert({
      where: { applicationId: args.applicationId },
      update: {
        openingMessage: questionOutput.coachInsight.openingMessage,
        jobWants: questionOutput.coachInsight.jobWants,
        candidateStrengthsJson: questionOutput.coachInsight
          .candidateStrengths as Prisma.InputJsonValue,
        candidateConcernsJson: questionOutput.coachInsight
          .candidateConcerns as Prisma.InputJsonValue,
      },
      create: {
        applicationId: args.applicationId,
        openingMessage: questionOutput.coachInsight.openingMessage,
        jobWants: questionOutput.coachInsight.jobWants,
        candidateStrengthsJson: questionOutput.coachInsight
          .candidateStrengths as Prisma.InputJsonValue,
        candidateConcernsJson: questionOutput.coachInsight
          .candidateConcerns as Prisma.InputJsonValue,
      },
    });

    await tx.gapQuestion.deleteMany({
      where: { applicationId: args.applicationId, status: "unanswered" },
    });

    if (questionsToCreate.length > 0) {
      const targetIds = questionsToCreate
        .map((question) => question.targetRequirementId)
        .filter((id): id is string => Boolean(id));
      const liveTargetIds =
        targetIds.length > 0
          ? new Set(
              (
                await tx.jobRequirement.findMany({
                  where: {
                    id: { in: targetIds },
                    job: { applicationId: args.applicationId },
                  },
                  select: { id: true },
                })
              ).map((requirement) => requirement.id)
            )
          : new Set<string>();

      await tx.gapQuestion.createMany({
        data: questionsToCreate.map((question) => ({
          applicationId: args.applicationId,
          targetRequirementId:
            question.targetRequirementId &&
            liveTargetIds.has(question.targetRequirementId)
              ? question.targetRequirementId
              : null,
          question: question.question,
          reason: question.reason,
          whyItMatters: question.whyItMatters,
          answerGuidance: question.answerGuidance,
          exampleAnglesJson: question.exampleAnglesJson,
          status: question.status,
        })),
      });
    }

    await tx.application.update({
      where: { id: args.applicationId },
      data: { status: "questions_ready", currentStep: "questions_ready" },
    });
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
    answerText?: string | null;
    skipped?: boolean | null;
  }>;
}) {
  await assertApplicationForSession(args);

  const newCandidateChunks = [];
  const affectedRequirementIds = new Set<string>();
  let hasUntargetedUsefulAnswer = false;

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

    const answerText = answer.answerText?.trim() ?? "";
    const isSkipped = !!answer.skipped;

    if (!isSkipped && answerText.length < 60) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Add a little more detail before saving this answer.",
      });
    }

    const gapAnswer = await db.gapAnswer.create({
      data: {
        gapQuestionId: answer.gapQuestionId,
        applicationId: args.applicationId,
        buttonAnswer: isSkipped ? "skip" : "yes",
        elaboration: isSkipped ? null : answerText,
      },
    });

    await db.gapQuestion.update({
      where: { id: answer.gapQuestionId },
      data: {
        status: isSkipped ? "skipped" : "answered",
      },
    });

    if (!isSkipped && gapQuestion.targetRequirementId) {
      affectedRequirementIds.add(gapQuestion.targetRequirementId);
    } else if (!isSkipped && answerText) {
      hasUntargetedUsefulAnswer = true;
    }

    if (!isSkipped && answerText) {
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
          buttonAnswer: "yes",
          elaboration: answerText,
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

  if (hasUntargetedUsefulAnswer) {
    const openFitScores = await db.requirementFitScore.findMany({
      where: {
        applicationId: args.applicationId,
        finalConfidence: { not: "high" },
        jobRequirement: { importance: { not: "low" } },
      },
      select: { jobRequirementId: true },
    });

    for (const score of openFitScores) {
      affectedRequirementIds.add(score.jobRequirementId);
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

  const score = await calculateEvidenceMatchScore(args.applicationId);

  await db.application.update({
    where: { id: args.applicationId },
    data: {
      status: "answers_added",
      currentStep: "answers_added",
      updatedEvidenceMatchScore: score.score,
    },
  });

  return {
    updatedEvidenceMap: await buildRequirementEvidenceMap(args.applicationId),
    evidenceMatchScore: score,
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
  const firstCvOutput = applyStrategySectionOrder(
    await runCvWriterAgent({
      applicationId: args.applicationId,
      context,
    }),
    strategy
  );
  const cvReview = await runCvQualityReviewAgent({
    applicationId: args.applicationId,
    context,
    cvOutput: firstCvOutput,
  });
  const cvOutput =
    !cvReview.passed && cvReview.revisionInstructions.trim()
      ? applyStrategySectionOrder(
          await runCvWriterAgent({
            applicationId: args.applicationId,
            context: {
              ...context,
              previousCvOutput: firstCvOutput,
              qualityReviewRevisionInstructions: cvReview.revisionInstructions,
              qualityReviewIssues: cvReview.issues,
            },
          }),
          strategy
        )
      : firstCvOutput;
  const cvText = buildCvTextFromJson(cvOutput.cvJson);
  const layoutOutput = await runCvLayoutStyleAgent({
    applicationId: args.applicationId,
    context: {
      ...context,
      cvJson: cvOutput.cvJson,
      cvText,
      rendererConstraints: cvLayoutRendererConstraints(),
      optionalDesignPreferences: null,
    },
  });
  const structuredCv = parseStructuredCv(cvOutput.cvJson);
  const presentationJson = structuredCv
    ? normalizeCvPresentation(layoutOutput, structuredCv, context)
    : layoutOutput;
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
      cvText,
      presentationJson: presentationJson as Prisma.InputJsonValue,
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
    currentSection: readCvTarget(draft.cvJson, args.sectionId),
    instruction: args.instruction,
    context: await buildCvWriterContext({
      applicationId: args.applicationId,
      strategyId: draft.strategyId ?? "",
    }).catch(() => ({})),
  });

  const cvJson = writeCvTarget(
    isRecord(draft.cvJson) ? draft.cvJson : {},
    args.sectionId,
    output.updatedSection
  );

  const updatedCvDraft = await db.cvDraft.update({
    where: { id: draft.id },
    data: {
      version: draft.version + 1,
      cvJson: cvJson as Prisma.InputJsonValue,
      cvText: buildCvTextFromJson(cvJson),
    },
  });

  return { updatedCvDraft };
}

export async function updateCvSection(args: {
  anonymousSessionId: string;
  applicationId: string;
  cvDraftId: string;
  sectionId: string;
  content: string;
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

  const cvJson = writeCvTarget(
    isRecord(draft.cvJson) ? draft.cvJson : {},
    args.sectionId,
    args.content
  );

  const updatedCvDraft = await db.cvDraft.update({
    where: { id: draft.id },
    data: {
      version: draft.version + 1,
      cvJson: cvJson as Prisma.InputJsonValue,
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
    requirementFitScores,
    evidenceMatchScore,
    gapQuestions,
    gapAnswers,
    gapCoachInsight,
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
    db.requirementFitScore.findMany({
      where: { applicationId: args.applicationId },
      include: {
        bestCandidateChunk: {
          select: { id: true, content: true },
        },
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
    db.gapCoachInsight.findUnique({
      where: { applicationId: args.applicationId },
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
  const sortedRequirements = [...(job?.requirements ?? [])].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.importance] - rank[b.importance];
  });
  const topRequirements = sortedRequirements.slice(0, 5);
  const hiddenHiringSignal =
    sortedRequirements.find((requirement) =>
      ["soft_skill", "domain", "responsibility"].includes(requirement.type)
    )?.description ??
    job?.summary ??
    null;
  const candidateDiscoverySummary = candidateProfile
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
    : null;
  const strongMatches = evidenceMatches.filter(
    (match) =>
      match.overallConfidence === "high" || match.overallConfidence === "medium"
  );
  const weakSpots =
    gapQuestions.length > 0
      ? gapQuestions.map((question) => ({
          id: question.id,
          targetRequirementId: question.targetRequirementId,
          label:
            job?.requirements.find(
              (requirement) => requirement.id === question.targetRequirementId
            )?.label ?? "Clarification needed",
          reason: question.reason,
          question: question.question,
        }))
      : [];
  const clientCvDraft = cvDraft
    ? {
        ...cvDraft,
        presentationJson: stripCvPresentationDebug(cvDraft.presentationJson),
      }
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
          hiddenHiringSignal,
          topRequirements,
        }
      : null,
    topRequirements,
    hiddenHiringSignal,
    candidateProfile,
    candidateDiscoverySummary,
    candidateChunks,
    evidenceMatches,
    requirementFitScores,
    evidenceMatchScore,
    originalEvidenceMatchScore: application.originalEvidenceMatchScore,
    updatedEvidenceMatchScore:
      application.updatedEvidenceMatchScore ?? evidenceMatchScore.score,
    strongMatches,
    weakSpots,
    gapQuestions,
    gapAnswers,
    gapCoachInsight,
    cvStrategy,
    cvDraft: clientCvDraft,
    cvJson: cvDraft?.cvJson ?? null,
    cvText: cvDraft?.cvText ?? null,
    agentRuns,
  };
}
