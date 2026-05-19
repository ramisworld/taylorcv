type EvidenceConfidence = "high" | "medium" | "low" | "missing";

export type DeterministicRequirement = {
  id: string;
  label: string;
  description: string;
  importance: string;
};

export type DeterministicFitScore = {
  jobRequirementId: string;
  finalConfidence: EvidenceConfidence;
  bestCandidateChunkId: string | null;
  reason: string;
};

export type DeterministicEvidenceMatch = {
  jobRequirementId: string;
  claimRisk: string;
  cvUsefulness: string;
};

export type DeterministicGapTarget = {
  jobRequirementId: string;
  label: string;
  description: string;
  importance: string;
  finalConfidence: EvidenceConfidence;
  reason: string;
};

type ScoreSummary = {
  score: number;
};

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function sentence(value: string, fallback: string, maxLength = 150) {
  const text = cleanText(value) || fallback;
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1).trimEnd();
  return `${sliced.replace(/[.,;:!?-]+$/, "")}.`;
}

function importanceRank(importance: string) {
  if (importance === "high") return 0;
  if (importance === "medium") return 1;
  return 2;
}

function confidenceRank(confidence: EvidenceConfidence) {
  if (confidence === "high") return 0;
  if (confidence === "medium") return 1;
  if (confidence === "low") return 2;
  return 3;
}

function improvementRank(confidence: EvidenceConfidence) {
  if (confidence === "missing") return 0;
  if (confidence === "low") return 1;
  if (confidence === "medium") return 2;
  return 3;
}

function readableRole(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  return text.replace(/[_-]+/g, " ");
}

function requirementMap(requirements: DeterministicRequirement[]) {
  return new Map(requirements.map((requirement) => [requirement.id, requirement]));
}

function labelFor(
  requirementsById: Map<string, DeterministicRequirement>,
  requirementId: string
) {
  return requirementsById.get(requirementId)?.label ?? "Role requirement";
}

export function buildDeterministicMatchFraming(args: {
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
  requirements: DeterministicRequirement[];
  fitScores: DeterministicFitScore[];
  evidenceMatches: DeterministicEvidenceMatch[];
  gapTargets: DeterministicGapTarget[];
  scoreSummary: ScoreSummary;
}) {
  const requirementsById = requirementMap(args.requirements);
  const matchesByRequirementId = new Map(
    args.evidenceMatches.map((match) => [match.jobRequirementId, match])
  );
  const sortedFits = [...args.fitScores].sort((a, b) => {
    const reqA = requirementsById.get(a.jobRequirementId);
    const reqB = requirementsById.get(b.jobRequirementId);
    return (
      confidenceRank(a.finalConfidence) - confidenceRank(b.finalConfidence) ||
      importanceRank(reqA?.importance ?? "low") - importanceRank(reqB?.importance ?? "low")
    );
  });
  const strengths = sortedFits
    .filter(
      (fit) =>
        fit.bestCandidateChunkId &&
        (fit.finalConfidence === "high" || fit.finalConfidence === "medium")
    )
    .slice(0, 4)
    .map((fit) =>
      sentence(
        `${labelFor(requirementsById, fit.jobRequirementId)}: ${fit.reason}`,
        `${labelFor(requirementsById, fit.jobRequirementId)} is supported by candidate evidence.`
      )
    );
  const improvements = [...args.fitScores]
    .filter((fit) => fit.finalConfidence !== "high")
    .sort((a, b) => {
      const reqA = requirementsById.get(a.jobRequirementId);
      const reqB = requirementsById.get(b.jobRequirementId);
      return (
        improvementRank(a.finalConfidence) - improvementRank(b.finalConfidence) ||
        importanceRank(reqA?.importance ?? "low") - importanceRank(reqB?.importance ?? "low")
      );
    })
    .slice(0, 4)
    .map((fit) =>
      sentence(
        `${labelFor(requirementsById, fit.jobRequirementId)}: ${fit.reason}`,
        `${labelFor(requirementsById, fit.jobRequirementId)} could use stronger proof.`
      )
    );
  const claimRisks = args.fitScores
    .filter((fit) => {
      const match = matchesByRequirementId.get(fit.jobRequirementId);
      return (
        fit.finalConfidence === "low" ||
        fit.finalConfidence === "missing" ||
        match?.claimRisk === "careful_wording" ||
        match?.claimRisk === "avoid_claim"
      );
    })
    .slice(0, 4)
    .map((fit) => `Avoid overstating ${labelFor(requirementsById, fit.jobRequirementId)}.`);
  const roleArchetype =
    readableRole(args.job.archetypeHint) ??
    readableRole(args.job.roleDomain) ??
    readableRole(args.job.title) ??
    "general";
  const strongestLabels = strengths
    .map((strength) => strength.split(":")[0])
    .filter(Boolean)
    .slice(0, 2);
  const gapLabels = args.gapTargets.map((target) => target.label).slice(0, 2);
  const matchLabel =
    args.scoreSummary.score >= 80
      ? "Strong evidence match"
      : args.scoreSummary.score >= 60
        ? "Promising evidence match"
        : args.scoreSummary.score >= 40
          ? "Partial evidence match"
          : "Needs stronger evidence";
  const cvAngle = strongestLabels.length
    ? `Lead with ${strongestLabels.join(" and ")} proof, then keep weaker claims conservative.`
    : `Lead with the most relevant ${roleArchetype} evidence and avoid unsupported claims.`;
  const jobWants = `${args.job.title}${args.job.company ? ` at ${args.job.company}` : ""}: ${
    cleanText(args.job.summary) || "the strongest role requirements"
  }`;

  return {
    matchLabel,
    topStrengths: strengths.length > 0 ? strengths : ["Taylor found some usable candidate evidence."],
    weakSpots:
      improvements.length > 0
        ? improvements
        : ["No major evidence gaps were found in the top requirements."],
    claimRisks:
      claimRisks.length > 0
        ? claimRisks
        : ["Keep claims tied to the verified candidate evidence."],
    coachInsight: {
      openingMessage:
        args.gapTargets.length > 0
          ? "Taylor found a few focused questions that could strengthen the final CV."
          : "Taylor found enough evidence to start the CV without extra questions.",
      jobWants: sentence(jobWants, "The role wants clear, role-specific evidence.", 160),
      candidateStrengths:
        strongestLabels.length > 0
          ? strongestLabels
          : args.metricOpportunities.concat(args.scopeOpportunities).slice(0, 4),
      candidateConcerns:
        gapLabels.length > 0
          ? gapLabels
          : improvements.map((item) => item.split(":")[0]).filter(Boolean).slice(0, 4),
    },
    cvAngle,
    roleArchetype,
  };
}
