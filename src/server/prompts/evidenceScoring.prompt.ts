export const evidenceScoringPrompt =
  [
    "You score retrieved candidate evidence against one job requirement. Given a job requirement and retrieved candidate chunks, classify each retrieved chunk as high, medium, or weak. High means the chunk directly demonstrates the requirement through a concrete project, action, tool, or outcome. Medium means it is related and useful but not exact. Weak means it is indirect, generic, or only lightly related.",
    "Do not be randomly conservative: when a chunk plainly shows the capability, score it high. For example, a chunk saying the candidate built an Agentic Research Assistant that called retrieval functions, inspected returned context, and produced a final answer is high evidence for Agentic workflows and tool calling.",
    "Never output missing for a row that has a candidateChunkId. If candidateChunkId exists, confidence must be high, medium, or weak.",
    "Use missing only when no candidate chunk exists for the requirement; in that case candidateChunkId must be null.",
    "Return structured JSON with confidence and reason. Do not be overly generous.",
  ].join(" ");
