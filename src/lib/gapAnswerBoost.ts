import type { GapAnswerEvaluatorOutput } from "~/lib/types";

type Importance = "high" | "medium" | "low";
type Confidence = "high" | "medium" | "low" | "missing";

const ranges = {
  none: [0, 0],
  small: [1, 3],
  medium: [4, 8],
  large: [9, 15],
} as const;

function boundedInteger(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function deterministicBand(args: {
  importance: Importance;
  currentConfidence: Confidence;
  evidenceQuality: GapAnswerEvaluatorOutput["evidenceQuality"];
  usableStatus: GapAnswerEvaluatorOutput["usableStatus"];
}) {
  if (args.usableStatus === "not_usable" || args.evidenceQuality === "none") {
    return "none" as const;
  }
  if (args.usableStatus === "use_carefully") {
    return args.importance === "high" && args.currentConfidence === "missing"
      ? ("medium" as const)
      : ("small" as const);
  }
  if (
    args.importance === "high" &&
    args.currentConfidence === "missing" &&
    args.evidenceQuality === "strong"
  ) {
    return "large" as const;
  }
  if (
    args.importance === "high" &&
    (args.currentConfidence === "missing" || args.currentConfidence === "low")
  ) {
    return "medium" as const;
  }
  if (
    args.importance === "medium" &&
    args.currentConfidence === "missing" &&
    args.evidenceQuality !== "weak"
  ) {
    return "medium" as const;
  }
  return "small" as const;
}

export function calculateGapAnswerBoost(args: {
  output: GapAnswerEvaluatorOutput;
  importance: Importance;
  currentConfidence: Confidence;
  previousBoostTotal: number;
  originalMatchScore: number;
}) {
  if (!args.output.shouldSaveEvidence) {
    return { boostPercent: 0, boostBand: "none" as const, totalBoostPercent: args.previousBoostTotal };
  }
  const boostBand = deterministicBand({
    importance: args.importance,
    currentConfidence: args.currentConfidence,
    evidenceQuality: args.output.evidenceQuality,
    usableStatus: args.output.usableStatus,
  });
  const [minimum, maximum] = ranges[boostBand];
  const suggested = boundedInteger(args.output.suggestedBoostPercent);
  const bandBoost =
    boostBand === "none"
      ? 0
      : Math.min(maximum, Math.max(minimum, suggested || minimum));
  const cap = Math.max(0, Math.min(20, 100 - boundedInteger(args.originalMatchScore)));
  const remaining = Math.max(0, cap - boundedInteger(args.previousBoostTotal));
  const boostPercent = Math.min(remaining, bandBoost);
  return {
    boostBand: boostPercent > 0 ? boostBand : ("none" as const),
    boostPercent,
    totalBoostPercent: boundedInteger(args.previousBoostTotal) + boostPercent,
  };
}
