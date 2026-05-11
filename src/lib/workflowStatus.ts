export const stableApplicationStatuses = [
  "started",
  "job_added",
  "candidate_added",
  "evidence_ready",
  "questions_ready",
  "answers_added",
  "strategy_ready",
  "cv_ready",
] as const;

export type StableApplicationStatus = (typeof stableApplicationStatuses)[number];

export function isStableApplicationStatus(
  value: string
): value is StableApplicationStatus {
  return stableApplicationStatuses.includes(value as StableApplicationStatus);
}

export function workflowStateForGenerationStep(
  step: "strategy_failed" | "strategy_ready" | "draft_failed" | "draft_ready"
): { status: StableApplicationStatus; currentStep: string } {
  if (step === "strategy_failed") {
    return { status: "answers_added", currentStep: "strategy_failed" };
  }
  if (step === "draft_failed") {
    return { status: "strategy_ready", currentStep: "draft_failed" };
  }
  if (step === "draft_ready") {
    return { status: "cv_ready", currentStep: "draft_ready" };
  }
  return { status: "strategy_ready", currentStep: "strategy_ready" };
}

export function shouldRepairWorkflowForDraft(args: {
  hasDraft: boolean;
  status: string;
  currentStep: string;
}) {
  return (
    args.hasDraft &&
    (args.status !== "cv_ready" || args.currentStep !== "draft_ready")
  );
}

export function friendlyGenerationErrorMessage(
  message: string | null | undefined,
  fallback: string
) {
  const raw = message?.trim();
  if (
    raw &&
    !/Invalid `prisma\.[^`]+` invocation|Invalid value for argument `status`|Expected ApplicationStatus|PrismaClient|ZodError|invalid_type|invalid_union|unrecognized_keys|cvJson|OpenAI Responses API failed|JSON\.parse|Unexpected token|CV QA failed/i.test(
      raw
    )
  ) {
    return raw;
  }
  return fallback;
}
