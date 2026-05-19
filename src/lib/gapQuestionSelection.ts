type EvidenceConfidence = "high" | "medium" | "low" | "missing";
type Importance = "high" | "medium" | "low";

export type GapQuestionTarget = {
  jobRequirementId: string;
  label: string;
  description: string;
  importance: Importance | string;
  finalConfidence: EvidenceConfidence;
  reason: string;
  selectedEvidenceSnippet?: string | null;
};

function importanceRank(importance: string) {
  if (importance === "high") return 0;
  if (importance === "medium") return 1;
  return 2;
}

function priority(target: GapQuestionTarget) {
  const importance = target.importance;
  const confidence = target.finalConfidence;
  if (importance === "high" && confidence === "missing") return 0;
  if (importance === "high" && confidence === "low") return 1;
  if (importance === "medium" && confidence === "missing") return 2;
  if (importance === "medium" && confidence === "low") return 3;
  if (confidence === "missing") return 4;
  if (confidence === "low") return 5;
  return 99;
}

export function selectGapQuestionTargets(
  targets: GapQuestionTarget[],
  options: { max?: number } = {}
) {
  const max = Math.min(Math.max(options.max ?? 8, 1), 12);
  return targets
    .filter((target) => {
      return (
        target.finalConfidence === "missing" || target.finalConfidence === "low"
      );
    })
    .sort((a, b) => {
      const priorityDelta = priority(a) - priority(b);
      if (priorityDelta !== 0) return priorityDelta;
      const importanceDelta = importanceRank(a.importance) - importanceRank(b.importance);
      if (importanceDelta !== 0) return importanceDelta;
      return a.label.localeCompare(b.label);
    })
    .slice(0, max);
}
