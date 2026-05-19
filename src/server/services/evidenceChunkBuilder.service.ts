import "server-only";

import type { CandidateProfilerOutput } from "~/lib/types";
import type { NewCandidateChunk } from "~/server/tools/vectorSearch.tool";

function compact(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => !!value);
}

function textList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function metricFrom(text: string) {
  return text.match(/\b\d+(?:[,.]\d+)?%?\b/)?.[0] ?? null;
}

function sourceId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function metadata(args: {
  action?: string | null;
  context?: string | null;
  toolsOrMethods?: string[];
  ownership?: string | null;
  outcome?: string | null;
  metric?: string | null;
  scope?: string | null;
  source?: string | null;
  cvUsefulness?: "cv_ready" | "supporting" | "keyword_only" | "caution";
  cautionNotes?: string[];
}) {
  return {
    action: args.action ?? null,
    context: args.context ?? null,
    toolsOrMethods: args.toolsOrMethods ?? [],
    ownership: args.ownership ?? null,
    outcome: args.outcome ?? null,
    metric: args.metric ?? null,
    scope: args.scope ?? null,
    source: args.source ?? "profile",
    targetRequirementId: null,
    targetRequirementLabel: null,
    cvUsefulness: args.cvUsefulness ?? "supporting",
    cautionNotes: args.cautionNotes ?? [],
  };
}

export function buildEvidenceChunksFromProfile(args: {
  anonymousSessionId: string;
  userId?: string | null;
  sourceApplicationId: string;
  candidateProfileId: string;
  sourceType?: NewCandidateChunk["sourceType"];
  profile: CandidateProfilerOutput;
}): NewCandidateChunk[] {
  const chunks: NewCandidateChunk[] = [];
  const cautionNotes = args.profile.cautionNotes ?? [];
  const sourceType = args.sourceType ?? "cv_upload";

  args.profile.experience.forEach((experience, experienceIndex) => {
    const base = compact([
      experience.role,
      experience.organization ? `at ${experience.organization}` : null,
      compact([experience.startDate, experience.endDate ?? (experience.current ? "Current" : null)]).join(" - "),
    ]).join(" ");
    const bullets =
      experience.bullets.length > 0
        ? experience.bullets
        : compact([
            experience.description,
            ...experience.achievements,
            ...experience.outcomes,
          ]);

    bullets.forEach((bullet, bulletIndex) => {
      const content = compact([base, bullet]).join(": ");
      if (!content) return;
      chunks.push({
        anonymousSessionId: args.anonymousSessionId,
        userId: args.userId ?? null,
        sourceApplicationId: args.sourceApplicationId,
        candidateProfileId: args.candidateProfileId,
        sourceType,
        sourceId: `${sourceId("experience", experienceIndex)}-bullet-${bulletIndex + 1}`,
        chunkType: "experience",
        content,
        tags: textList([
          experience.role ?? "",
          experience.organization ?? "",
          ...experience.technologies,
          ...experience.tools,
        ]),
        metadata: metadata({
          action: experience.role ?? "experience",
          context: experience.organization ?? experience.description,
          toolsOrMethods: textList([...experience.technologies, ...experience.tools]),
          outcome: compact([...experience.outcomes, ...experience.achievements]).join("; ") || null,
          metric: metricFrom(content),
          scope: compact([experience.organization, experience.role]).join(" ") || null,
          source: "experience",
          cvUsefulness: metricFrom(content) || experience.outcomes.length > 0 ? "cv_ready" : "supporting",
          cautionNotes,
        }),
      });
    });
  });

  args.profile.projects.forEach((project, index) => {
    const content = compact([
      project.name ? `${project.name}: ${project.description}` : project.description,
      project.tools.length ? `Tools: ${project.tools.join(", ")}` : null,
      project.outcomes.length ? `Outcomes: ${project.outcomes.join("; ")}` : null,
    ]).join(". ");
    if (!content) return;
    chunks.push({
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      sourceApplicationId: args.sourceApplicationId,
      candidateProfileId: args.candidateProfileId,
      sourceType,
      sourceId: sourceId("project", index),
      chunkType: "project",
      content,
      tags: textList([project.name ?? "", ...project.tools]),
      metadata: metadata({
        action: "built project",
        context: project.name ?? project.description,
        toolsOrMethods: project.tools,
        outcome: project.outcomes.join("; ") || null,
        metric: metricFrom(content),
        scope: project.links.length ? project.links.join(", ") : null,
        source: "project",
        cvUsefulness: project.outcomes.length > 0 ? "cv_ready" : "supporting",
        cautionNotes,
      }),
    });
  });

  args.profile.education.forEach((education, index) => {
    const content = compact([
      compact([education.degree ?? education.credential, education.institution]).join(" at "),
      compact([education.startYear, education.endYear]).join(" - "),
      education.details,
      education.coursework.length ? `Coursework: ${education.coursework.join(", ")}` : null,
      education.notes,
    ]).join(". ");
    if (!content) return;
    chunks.push({
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      sourceApplicationId: args.sourceApplicationId,
      candidateProfileId: args.candidateProfileId,
      sourceType,
      sourceId: sourceId("education", index),
      chunkType: "education",
      content,
      tags: textList([
        education.institution ?? "",
        education.degree ?? "",
        education.credential ?? "",
        ...education.coursework,
      ]),
      metadata: metadata({
        action: education.degree ?? education.credential ?? "education",
        context: education.institution,
        toolsOrMethods: education.coursework,
        source: "education",
        cvUsefulness: "supporting",
        cautionNotes,
      }),
    });
  });

  args.profile.certifications.forEach((certification, index) => {
    const content = compact([
      certification.name,
      certification.issuer,
      certification.date ?? certification.status,
      certification.details,
    ]).join(" - ");
    if (!content) return;
    chunks.push({
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      sourceApplicationId: args.sourceApplicationId,
      candidateProfileId: args.candidateProfileId,
      sourceType,
      sourceId: sourceId("certification", index),
      chunkType: "certification",
      content,
      tags: textList([certification.name, certification.issuer ?? ""]),
      metadata: metadata({
        action: certification.name,
        context: certification.issuer,
        source: "certification",
        cvUsefulness: "supporting",
        cautionNotes,
      }),
    });
  });

  args.profile.achievements.forEach((achievement, index) => {
    if (!achievement.trim()) return;
    chunks.push({
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      sourceApplicationId: args.sourceApplicationId,
      candidateProfileId: args.candidateProfileId,
      sourceType,
      sourceId: sourceId("achievement", index),
      chunkType: "achievement",
      content: achievement,
      tags: ["achievement"],
      metadata: metadata({
        action: achievement,
        context: "achievement",
        metric: metricFrom(achievement),
        source: "achievement",
        cvUsefulness: metricFrom(achievement) ? "cv_ready" : "supporting",
        cautionNotes,
      }),
    });
  });

  if (chunks.length === 0 && args.profile.summary.trim()) {
    chunks.push({
      anonymousSessionId: args.anonymousSessionId,
      userId: args.userId ?? null,
      sourceApplicationId: args.sourceApplicationId,
      candidateProfileId: args.candidateProfileId,
      sourceType,
      sourceId: "profile-summary",
      chunkType: "achievement",
      content: args.profile.summary,
      tags: textList([...args.profile.skills, ...args.profile.tools]).slice(0, 20),
      metadata: metadata({
        action: "profile summary",
        context: args.profile.summary,
        toolsOrMethods: textList(args.profile.tools),
        source: "profile_summary",
        cvUsefulness: "supporting",
        cautionNotes,
      }),
    });
  }

  return chunks;
}

export function buildGapAnswerEvidenceChunk(args: {
  anonymousSessionId: string;
  userId?: string | null;
  sourceApplicationId: string;
  gapAnswerId: string;
  gapQuestionId: string;
  targetRequirementId: string | null;
  targetRequirementLabel: string | null;
  selectedOption: string | null;
  followUpText: string | null;
  metricText: string | null;
  answerText: string | null;
  trustLevel?: "usable" | "use_carefully" | "suspicious" | "do_not_use";
}): NewCandidateChunk | null {
  const content = compact([
    args.selectedOption && !/^skip$/i.test(args.selectedOption)
      ? args.selectedOption
      : null,
    args.followUpText,
    args.metricText,
    args.answerText,
  ]).join(". ");

  if (!content) return null;

  return {
    anonymousSessionId: args.anonymousSessionId,
    userId: args.userId ?? null,
    sourceApplicationId: args.sourceApplicationId,
    sourceType: "gap_answer",
    sourceId: args.gapAnswerId,
    chunkType: "gap_answer",
    content,
    tags: textList([args.targetRequirementLabel ?? "", "gap_answer"]),
    metadata: {
      ...metadata({
        action: args.selectedOption,
        context: args.followUpText ?? args.answerText,
        metric: args.metricText,
        source: "gap_answer",
        cvUsefulness: "cv_ready",
      }),
      gapQuestionId: args.gapQuestionId,
      gapAnswerId: args.gapAnswerId,
      trustLevel: args.trustLevel ?? "usable",
      targetRequirementId: args.targetRequirementId,
      targetRequirementLabel: args.targetRequirementLabel,
    },
  };
}
