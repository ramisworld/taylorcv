type EvidenceConfidence = "high" | "medium" | "low" | "missing";

function normalizedText(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const collaborationRequirementPatterns = [
  /\bcollaborat/i,
  /\bcross[-\s]?functional/i,
  /\bstakeholder/i,
  /\bclient/i,
  /\bcustomer/i,
  /\bproduct\b/i,
  /\bdesign\b/i,
  /\bresearch\b/i,
];

const directCollaborationEvidencePatterns = [
  /\bcollaborat/i,
  /\bpartner(?:ed|ing)?\b/i,
  /\bworked with\b/i,
  /\bstakeholder/i,
  /\bclient/i,
  /\bcustomer/i,
  /\busers?\b/i,
  /\bproduct (?:manager|team|owner)s?\b/i,
  /\bdesign(?:er| team)?s?\b/i,
  /\bresearch(?:er| team)?s?\b/i,
  /\bcross[-\s]?functional/i,
  /\bteam\b/i,
];

const adjacentCollaborationEvidencePatterns = [
  /\bproduct\b/i,
  /\bowned\b/i,
  /\bshipped\b/i,
  /\bdelivered\b/i,
  /\bmvp\b/i,
  /\bfrontend\b/i,
];

const optimizationRequirementPatterns = [
  /\blatency\b/i,
  /\bcost\b/i,
  /\breliab/i,
  /\boptim/i,
  /\bperformance\b/i,
  /\bscale\b/i,
  /\buptime\b/i,
];

const directOptimizationEvidencePatterns = [
  /\blatency\b/i,
  /\bcost\b/i,
  /\breliab/i,
  /\boptim/i,
  /\bperformance\b/i,
  /\buptime\b/i,
  /\bthroughput\b/i,
  /\breduced\b/i,
  /\bimproved\b/i,
  /\bfaster\b/i,
  /\bmonitor(?:ed|ing)?\b/i,
  /\bload\b/i,
  /\bscale(?:d|ability)?\b/i,
];

const adjacentInfrastructureEvidencePatterns = [
  /\bdeploy/i,
  /\binfrastructure\b/i,
  /\bdocker\b/i,
  /\bci\/?cd\b/i,
  /\bbackend\b/i,
  /\bdatabase\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bcloud\b/i,
];

function genericConfidence(score: number) {
  if (score >= 0.82) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.24) return "low";
  return "missing";
}

export function calibrateEvidenceConfidence(args: {
  requirementLabel: string;
  requirementDescription?: string | null;
  evidenceContent?: string | null;
  similarityScore?: number | null;
}): EvidenceConfidence {
  const evidence = normalizedText(args.evidenceContent);
  if (!evidence) return "missing";

  const requirement = normalizedText(
    args.requirementLabel,
    args.requirementDescription
  );
  const score = args.similarityScore ?? 0;

  if (hasAny(requirement, collaborationRequirementPatterns)) {
    if (hasAny(evidence, directCollaborationEvidencePatterns)) {
      return score >= 0.78 ? "high" : "medium";
    }
    if (hasAny(evidence, adjacentCollaborationEvidencePatterns) || score >= 0.24) {
      return "low";
    }
    return "missing";
  }

  if (hasAny(requirement, optimizationRequirementPatterns)) {
    if (hasAny(evidence, directOptimizationEvidencePatterns)) {
      return score >= 0.78 ? "high" : "medium";
    }
    if (hasAny(evidence, adjacentInfrastructureEvidencePatterns) || score >= 0.24) {
      return "low";
    }
    return "missing";
  }

  return genericConfidence(score);
}
