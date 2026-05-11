import type { CvBuilderOutput } from "../../lib/types.ts";
import { normalizeCvPresentation } from "../../lib/cvPresentation.ts";
import {
  normalizeCvSections,
  parseStructuredCv,
  type CvBulletClaim,
} from "../../lib/cvDocument.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function dynamicSections(cvJson: unknown) {
  return isRecord(cvJson) && Array.isArray(cvJson.sections)
    ? cvJson.sections.filter(isRecord)
    : [];
}

export type CvQaContext = {
  job?: { title?: string | null; roleDomain?: string | null; archetypeHint?: string | null } | null;
  candidateChunks?: Array<{
    id?: string;
    content?: string;
    sourceType?: string;
    metadataJson?: unknown;
  }>;
  gapAnswers?: Array<{ id?: string; skipped?: boolean | null }>;
  matchAnalysis?: unknown;
};

const bannedContentPattern =
  /\b(Taylor|the candidate|Strong fit|good fit|perfect fit|ideal fit|match score|CV Match Strength)\b/i;

const appraisalPattern = /\b(strong fit|good fit|perfect fit|ideal fit)\b/i;

const suspiciousAchievementPattern =
  /\b(model calls?|batching slower steps|timing logs?|pipeline|refactor|latency logs?|backend optimi[sz]ation|unnecessary model calls?)\b/i;

const strongClaimPattern =
  /\b(tool-calling|structured outputs?|batch(?:ing|ed)? model calls?|timing logs?|latency improvement|prompt refinement|evaluation reliability|production|users?|scaled?|owned|led|improved|reduced|increased|automated|delivered|built|designed|implemented)\b/i;

const technicalRolePattern =
  /\b(ai|artificial intelligence|software|developer|engineer|data|machine learning|ml|backend|frontend|full.?stack|llm|rag)\b/i;

function textFromOutput(output: CvBuilderOutput) {
  const structured = parseStructuredCv(output.cvJson);
  if (!structured) return output.cvText;
  const sectionText = normalizeCvSections(structured)
    .flatMap((section) => {
      if (section.type === "summary" || section.type === "inline") return section.paragraphs;
      if (section.type === "bullets" || section.type === "certifications") {
        return section.bullets.map((bullet) => bullet.text);
      }
      if (section.type === "skills") {
        return section.groups.flatMap((group) => [group.group, ...group.skills]);
      }
      if (section.type === "projects") {
        return section.items.flatMap((item) => [
          item.name,
          item.descriptor,
          item.dates,
          ...item.bullets.map((bullet) => bullet.text),
        ]);
      }
      if (section.type === "experience") {
        return section.items.flatMap((item) => [
          item.role,
          item.company,
          item.dates,
          item.location,
          ...item.bullets.map((bullet) => bullet.text),
        ]);
      }
      if (section.type === "education") {
        return section.items.flatMap((item) => [
        item.degree,
        item.institution,
        item.dates,
        ...item.details,
        ]);
      }
      return [];
    })
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return [structured.header.name, structured.header.targetTitle, ...sectionText, output.cvText]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join("\n");
}

function hasSourceIds(bullet: CvBulletClaim) {
  return bullet.sourceChunkIds.length > 0 || bullet.gapAnswerIds.length > 0;
}

function sourceCorpus(context?: CvQaContext) {
  return (context?.candidateChunks ?? [])
    .map((chunk) => chunk.content ?? "")
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function technicalRole(output: CvBuilderOutput, context?: CvQaContext) {
  return technicalRolePattern.test(
    [
      output.roleArchetype,
      output.cvJson.roleArchetype,
      output.cvJson.header.targetTitle,
      context?.job?.title,
      context?.job?.roleDomain,
      context?.job?.archetypeHint,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasSourceDateOrLocation(context?: CvQaContext) {
  const corpus = sourceCorpus(context);
  return /\b(?:19|20)\d{2}\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\b(auckland|wellington|christchurch|remote|new zealand|nz)\b/i.test(
    corpus
  );
}

export function runDeterministicCvQa(output: CvBuilderOutput, context?: CvQaContext) {
  const issues: string[] = [];
  const serialized = JSON.stringify(output.cvJson);
  const sections = dynamicSections(output.cvJson);
  const structured = parseStructuredCv(output.cvJson);
  const cvText = textFromOutput(output);

  if (serialized.includes("—")) issues.push("CV contains an em dash.");
  if (sections.some((section) => !Array.isArray(section.items) || section.items.length === 0)) {
    issues.push("CV contains an empty dynamic section.");
  }
  if (bannedContentPattern.test(cvText)) {
    issues.push("CV content contains banned product/appraisal wording.");
  }
  if (appraisalPattern.test(output.cvJson.summary)) {
    issues.push("Summary contains appraisal wording.");
  }
  if (suspiciousAchievementPattern.test(cvText)) {
    issues.push("CV content contains suspicious app/refactor/timing/pipeline wording.");
  }
  if (output.cvJson.summary.split(/\s+/).filter(Boolean).length > 75) {
    issues.push("Summary is over 75 words.");
  }
  if (sections.length === 0) issues.push("CV has no dynamic sections.");
  if (!output.cvJson.header.name && !output.cvJson.header.email) {
    issues.push("CV header has neither name nor email.");
  }
  if (/border-blue-700|thick blue|blue body text/i.test(serialized)) {
    issues.push("CV includes disallowed thick blue divider styling.");
  }
  if (!structured) {
    issues.push("CV JSON could not be normalized.");
  } else {
    const normalizedSections = normalizeCvSections(structured);
    if (normalizedSections.length === 0) issues.push("CV has no renderable normalized sections.");
    for (const section of normalizedSections) {
      if (section.type === "skills") {
        if (section.groups.some((group) => !group.group.trim() || group.skills.length === 0)) {
          issues.push("CV contains empty nested skills.");
        }
      }
      if (section.type === "experience") {
        for (const item of section.items) {
          if (!item.bullets.length) issues.push("Experience item has no bullets.");
          for (const bullet of item.bullets) {
            if (bullet.text.includes("; ")) {
              issues.push("Experience bullet appears semicolon-joined.");
            }
            if (strongClaimPattern.test(bullet.text) && !hasSourceIds(bullet)) {
              issues.push("Experience strong claim is missing source IDs.");
            }
          }
          if (hasSourceDateOrLocation(context) && (!item.dates || !item.location)) {
            issues.push("Experience item is missing dates or location while source data appears to contain them.");
          }
        }
      }
      if (section.type === "projects" || section.type === "bullets") {
        const bullets =
          section.type === "projects"
            ? section.items.flatMap((item) => item.bullets)
            : section.bullets;
        for (const bullet of bullets) {
          if (strongClaimPattern.test(bullet.text) && !hasSourceIds(bullet)) {
            issues.push("Major selected-evidence or project bullet is missing source IDs.");
          }
        }
      }
    }
    const skillsSections = normalizedSections.filter((section) => section.type === "skills");
    const skillCount = skillsSections.reduce(
      (count, section) => count + section.groups.reduce((inner, group) => inner + group.skills.length, 0),
      0
    );
    if (technicalRole(output, context) && skillCount === 0) {
      issues.push("Technical role is missing grouped Technical Skills.");
    }
    const hasExperienceParagraph = normalizedSections.some((section) => {
      if (section.type !== "experience") return false;
      return section.items.some((item) =>
        item.bullets.some((bullet) => bullet.text.split(";").filter(Boolean).length >= 3)
      );
    });
    if (hasExperienceParagraph) issues.push("Experience appears to be rendered as paragraph text.");
  }

  const corpus = sourceCorpus(context);
  if (corpus) {
    const exactToolPattern = /\b(FastAPI|Node\.js|Express|PostgreSQL|MongoDB|SQLite|React|Docker|AWS|GitHub Actions|pandas|scikit-learn|TypeScript|JavaScript|Python|SQL)\b/g;
    for (const match of cvText.matchAll(exactToolPattern)) {
      if (!corpus.includes(match[0].toLowerCase()) && !hasSourceIdsInOutput(output, match[0])) {
        issues.push(`CV contains unsupported exact tool claim: ${match[0]}.`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
  };
}

function hasSourceIdsInOutput(output: CvBuilderOutput, text: string) {
  const structured = parseStructuredCv(output.cvJson);
  if (!structured) return false;
  const normalizedSections = normalizeCvSections(structured);
  return normalizedSections.some((section) => {
    if (section.type === "experience") {
      return section.items.some((item) =>
        item.bullets.some((bullet) => bullet.text.includes(text) && hasSourceIds(bullet))
      );
    }
    if (section.type === "projects") {
      return section.items.some((item) =>
        item.bullets.some((bullet) => bullet.text.includes(text) && hasSourceIds(bullet))
      );
    }
    if (section.type === "bullets") {
      return section.bullets.some((bullet) => bullet.text.includes(text) && hasSourceIds(bullet));
    }
    return false;
  });
}

function stripBannedText(text: string) {
  return text
    .replace(/—/g, "-")
    .replace(/\bStrong fit\b/gi, "Aligned")
    .replace(/\bgood fit\b/gi, "aligned")
    .replace(/\bperfect fit\b/gi, "aligned")
    .replace(/\bideal fit\b/gi, "aligned")
    .replace(/\bthe candidate\b/gi, "the profile")
    .replace(/\bTaylor\b/g, "")
    .replace(/\bCV Match Strength\b/g, "")
    .replace(/\bmatch score\b/gi, "alignment")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function repairBullet(bullet: CvBulletClaim): CvBulletClaim | null {
  const text = stripBannedText(bullet.text);
  if (!text || suspiciousAchievementPattern.test(text)) return null;
  return { ...bullet, text };
}

export function repairCvOutput(output: CvBuilderOutput): CvBuilderOutput {
  const repaired = structuredClone(output) as CvBuilderOutput;
  repaired.cvJson.summary = stripBannedText(repaired.cvJson.summary);
  repaired.cvText = stripBannedText(repaired.cvText);
  repaired.cvJson.projects = repaired.cvJson.projects
    .map((project) => ({
      ...project,
      name: project.name ? stripBannedText(project.name) : project.name,
      descriptor: project.descriptor ? stripBannedText(project.descriptor) : project.descriptor,
      bullets: project.bullets.map(repairBullet).filter((bullet): bullet is CvBulletClaim => !!bullet),
    }))
    .filter((project) => project.bullets.length > 0 || project.name || project.descriptor);
  repaired.cvJson.experience = repaired.cvJson.experience
    .map((item) => ({
      ...item,
      role: item.role ? stripBannedText(item.role) : item.role,
      company: item.company ? stripBannedText(item.company) : item.company,
      bullets: item.bullets.map(repairBullet).filter((bullet): bullet is CvBulletClaim => !!bullet),
    }))
    .filter((item) => item.bullets.length > 0 || item.role || item.company);
  repaired.cvJson.skills.groups = repaired.cvJson.skills.groups
    .map((group) => ({
      group: stripBannedText(group.group),
      skills: group.skills.map(stripBannedText).filter(Boolean),
    }))
    .filter((group) => group.group && group.skills.length > 0);
  repaired.cvJson.sections = repaired.cvJson.sections
    .map((section) => ({
      ...section,
      label: stripBannedText(section.label),
      items: section.items
        .map((item) => {
          if (typeof item === "string") return stripBannedText(item);
          if (!isRecord(item)) return item;
          const recordItem = item as Record<string, unknown>;
          if (typeof recordItem.text === "string") {
            const text = stripBannedText(recordItem.text);
            return suspiciousAchievementPattern.test(text) ? null : { ...item, text };
          }
          return item;
        })
        .filter((item) => {
          if (item === null) return false;
          if (typeof item === "string") return item.length > 0;
          return true;
        }),
    }))
    .filter((section) => section.items.length > 0) as CvBuilderOutput["cvJson"]["sections"];
  return repaired;
}

export function compactCvRepairInstructions(issues: string[]) {
  return [
    "Repair the CV only. Preserve canonical schema.",
    "Use canonical experience { role, company, location, dates, startDate, endDate, bullets }.",
    "Use canonical skills { group, skills }.",
    "Use bullet objects { text, sourceChunkIds, gapAnswerIds } with source IDs on major claims.",
    "Remove empty sections, banned wording, em dashes, semicolon-joined experience, and suspicious app/refactor/timing/pipeline claims.",
    "For technical roles include grouped Technical Skills when supported.",
    `QA issues: ${issues.slice(0, 10).join(" | ")}`,
  ].join("\n");
}

export function calculateDeterministicAfterScore(args: {
  output: CvBuilderOutput;
  qaPassed: boolean;
  context?: CvQaContext;
}) {
  const before = Math.max(0, Math.min(100, args.output.beforeScoreRecommendation));
  const structured = parseStructuredCv(args.output.cvJson);
  const sections = structured ? normalizeCvSections(structured) : [];
  const sourcedBullets = sections.reduce((count, section) => {
    if (section.type === "experience") {
      return count + section.items.flatMap((item) => item.bullets).filter(hasSourceIds).length;
    }
    if (section.type === "projects") {
      return count + section.items.flatMap((item) => item.bullets).filter(hasSourceIds).length;
    }
    if (section.type === "bullets") {
      return count + section.bullets.filter(hasSourceIds).length;
    }
    return count;
  }, 0);
  const skillCount = sections.reduce((count, section) => {
    if (section.type !== "skills") return count;
    return count + section.groups.reduce((inner, group) => inner + group.skills.length, 0);
  }, 0);
  const highPriorityCorpus = JSON.stringify(args.context?.matchAnalysis ?? args.context?.job ?? "").toLowerCase();
  const cvText = textFromOutput(args.output).toLowerCase();
  const truthfulKeywordHits = [
    "rag",
    "llm",
    "api",
    "python",
    "typescript",
    "data",
    "customer",
    "teaching",
    "sales",
    "finance",
    "healthcare",
    "product",
  ].filter((keyword) => highPriorityCorpus.includes(keyword) && cvText.includes(keyword)).length;
  const usableGapAnswers = (args.context?.gapAnswers ?? []).filter((answer) => !answer.skipped).length;
  let score = before;
  score += args.qaPassed ? 8 : -10;
  score += Math.min(16, sourcedBullets * 2);
  score += sections.length >= 4 ? 7 : sections.length >= 3 ? 4 : 0;
  score += skillCount >= 10 ? 8 : skillCount >= 5 ? 5 : skillCount > 0 ? 2 : 0;
  score += Math.min(8, truthfulKeywordHits * 2);
  score += Math.min(9, usableGapAnswers * 3);
  score += args.output.roleArchetype ? 4 : 0;

  let floor = 65;
  let cap = 79;
  if (before >= 80 || sourcedBullets >= 8) {
    floor = 90;
    cap = 96;
  } else if (before >= 55 || sourcedBullets >= 4) {
    floor = 80;
    cap = 89;
  }
  if (!args.qaPassed) {
    floor = Math.min(floor, 65);
    cap = Math.min(cap, 74);
  }
  return Math.max(floor, Math.min(cap, Math.round(score)));
}

export function composeDeterministicPresentation(args: {
  cvOutput: CvBuilderOutput;
  context?: unknown;
}) {
  const structuredCv = parseStructuredCv(args.cvOutput.cvJson);
  if (!structuredCv) {
    return {
      schemaVersion: 1,
      layoutArchitecture: "classic_single_column",
      templateId: "modern_professional",
      careerStyle: "general",
      density: "balanced",
      pageTarget: "one_page",
      typography: {
        fontPairing: "modern_sans",
        nameSize: "large",
        subtitleStyle: "muted_under_name",
        bodySize: "standard",
        headingWeight: "bold",
      },
      colourSystem: {
        accentPalette: "blue",
        bodyText: "dark",
        mutedText: "grey",
        dividerStyle: "light_rule",
      },
      accentUsageRules: {
        useAccentFor: ["section_headings", "links", "small_emphasis"],
        neverUseAccentForBodyText: true,
        bodyTextMustRemain: "dark",
        metadataTextMustRemain: "grey",
      },
      headerStyle: "left_aligned_large_name",
      skillsStyle: "grouped_rows",
      sectionStyles: {},
      sectionLabelOverrides: {},
      renderWarnings: ["Dynamic CV fallback presentation used."],
      rationale: "Deterministic MVP layout.",
    };
  }

  return normalizeCvPresentation(
    {
      colourSystem: { dividerStyle: "light_rule", accentPalette: "blue" },
      typography: { nameSize: "large", subtitleStyle: "muted_under_name" },
      headerStyle: "left_aligned_large_name",
      rationale: "Deterministic MVP layout.",
    },
    structuredCv,
    args.context
  );
}
