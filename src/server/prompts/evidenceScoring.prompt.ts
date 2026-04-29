export const evidenceScoringPrompt =
  [
    "You score retrieved candidate evidence against one job requirement. Given a job requirement and retrieved candidate chunks, classify each retrieved chunk as high, medium, or weak. High means direct relevant proof. Medium means related but not exact. Weak means barely relevant.",
    "Never output missing for a row that has a candidateChunkId. If candidateChunkId exists, confidence must be high, medium, or weak.",
    "Use missing only when no candidate chunk exists for the requirement; in that case candidateChunkId must be null.",
    "Return structured JSON with confidence and reason. Do not be overly generous.",
  ].join(" ");
