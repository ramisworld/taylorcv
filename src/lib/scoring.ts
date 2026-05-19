type EvidenceConfidence = "high" | "medium" | "low" | "missing";
type Importance = "high" | "medium" | "low";

export type EvidenceMatchScoreSummary = {
  score: number;
  earnedPoints: number;
  possiblePoints: number;
};

export function importanceWeight(importance: Importance | string) {
  if (importance === "high") return 5;
  if (importance === "medium") return 3;
  return 1;
}

export function confidenceValue(confidence: EvidenceConfidence) {
  if (confidence === "high") return 1;
  if (confidence === "medium") return 0.65;
  if (confidence === "low") return 0.3;
  return 0;
}

export function calculateEvidenceMatchScoreFromRows(
  rows: Array<{ earnedPoints: number; possiblePoints: number }>
): EvidenceMatchScoreSummary {
  const earnedPoints = rows.reduce((sum, row) => sum + row.earnedPoints, 0);
  const possiblePoints = rows.reduce((sum, row) => sum + row.possiblePoints, 0);
  const score =
    possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;

  return {
    score,
    earnedPoints,
    possiblePoints,
  };
}
