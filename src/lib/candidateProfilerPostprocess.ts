import {
  CandidateProfilerOutputSchema,
  type CandidateProfilerAgentOutputSchema,
} from "./schemas.ts";
import type { z } from "zod";

type CandidateProfilerAgentOutput = z.infer<typeof CandidateProfilerAgentOutputSchema>;

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[], max = values.length) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = cleanText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= max) break;
  }
  return result;
}

function truncate(value: string, maxLength: number) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd().replace(/[.,;:!?-]+$/, "")}.`;
}

function urlFromMatch(match: string) {
  const trimmed = match.replace(/[),.;\]]+$/g, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:www\.|linkedin\.com|github\.com)/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function extractCandidateContactAndLinks(text: string) {
  const source = text.replace(/\s+/g, " ");
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phoneMatch =
    source.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ?? null;
  const phone =
    phoneMatch && phoneMatch.replace(/\D/g, "").length >= 8
      ? phoneMatch.replace(/[),.;]+$/g, "")
      : null;
  const urls = unique(
    [
      ...source.matchAll(
        /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:linkedin\.com|github\.com)\/[^\s<>"']+/gi
      ),
    ].map((match) => urlFromMatch(match[0])),
    20
  );
  const linkedin = urls.find((url) => /linkedin\.com/i.test(url)) ?? null;
  const github = urls.find((url) => /github\.com/i.test(url)) ?? null;
  const portfolio =
    urls.find((url) => !/linkedin\.com|github\.com/i.test(url)) ?? null;
  const known = new Set([linkedin, github, portfolio].filter(Boolean));
  const other = urls
    .filter((url) => !known.has(url))
    .slice(0, 6)
    .map((url) => ({ label: null, url }));

  return {
    contactInfo: {
      email,
      phone,
    },
    links: {
      linkedin,
      github,
      portfolio,
      other,
    },
  };
}

function deriveSourceSummary(args: {
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  output: CandidateProfilerAgentOutput;
}) {
  const source =
    args.rawCvText && args.rawBackgroundText
      ? "CV and background text"
      : args.rawCvText
        ? "CV"
        : args.rawBackgroundText
          ? "background text"
          : "candidate source";
  const counts = [
    args.output.experience.length
      ? `${args.output.experience.length} experience item${args.output.experience.length === 1 ? "" : "s"}`
      : null,
    args.output.projects.length
      ? `${args.output.projects.length} project${args.output.projects.length === 1 ? "" : "s"}`
      : null,
    args.output.education.length
      ? `${args.output.education.length} education item${args.output.education.length === 1 ? "" : "s"}`
      : null,
    args.output.certifications.length
      ? `${args.output.certifications.length} certification${args.output.certifications.length === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return `${source} parsed into ${counts.join(", ") || "a compact candidate profile"}.`;
}

function candidateEvidenceTexts(output: CandidateProfilerAgentOutput) {
  return [
    ...output.projects.map((project) =>
      truncate(
        [
          project.name ? `${project.name}: ${project.description}` : project.description,
          project.outcomes.join("; "),
        ]
          .filter(Boolean)
          .join(". "),
        160
      )
    ),
    ...output.experience.flatMap((experience) => {
      const base = [experience.role, experience.organization].filter(Boolean).join(" at ");
      const bullets = experience.bullets.length
        ? experience.bullets
        : [experience.description, ...experience.achievements, ...experience.outcomes];
      return bullets.map((bullet) => truncate([base, bullet].filter(Boolean).join(": "), 160));
    }),
    ...output.achievements.map((achievement) => truncate(achievement, 160)),
  ].filter(Boolean);
}

function derivePlanningHints(output: CandidateProfilerAgentOutput) {
  const evidenceTexts = unique(candidateEvidenceTexts(output), 8);
  const metricPattern =
    /\b\d+(?:[,.]\d+)?%?\b|\b(latency|cost|throughput|reliability|uptime|accuracy|users?|customers?|revenue|saved|reduced|increased|improved)\b/i;
  const scopePattern =
    /\b(team|stakeholder|client|customer|users?|production|deployed|owned|led|managed|scale|scope|platform|system)\b/i;
  const metricOpportunities = unique(
    evidenceTexts
      .filter((text) => metricPattern.test(text))
      .map((text) => `Clarify measurable result for ${text}`),
    4
  );
  const scopeOpportunities = unique(
    evidenceTexts
      .filter((text) => scopePattern.test(text))
      .map((text) => `Clarify scope or ownership for ${text}`),
    4
  );
  const strongProofCandidates = evidenceTexts.slice(0, 6);
  const likelyTopEvidence = evidenceTexts.slice(0, 6);

  return {
    metricOpportunities,
    strongProofCandidates,
    scopeOpportunities,
    likelyTopEvidence,
  };
}

export function expandCandidateProfilerOutput(args: {
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
  output: CandidateProfilerAgentOutput;
}) {
  const rawText = [args.rawCvText, args.rawBackgroundText].filter(Boolean).join("\n");
  const deterministic = extractCandidateContactAndLinks(rawText);
  const planningHints = derivePlanningHints(args.output);
  return CandidateProfilerOutputSchema.parse({
    ...args.output,
    contactInfo: {
      ...args.output.contactInfo,
      email: deterministic.contactInfo.email,
      phone: deterministic.contactInfo.phone,
    },
    links: deterministic.links,
    sourceSummary: deriveSourceSummary(args),
    ...planningHints,
  });
}
