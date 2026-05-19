export type MatchSnapshotConfidence = "high" | "medium" | "low" | "missing";

export type MatchSnapshotFitInput = {
  jobRequirementId: string;
  finalConfidence: string;
  jobRequirement?: {
    id: string;
    label?: string | null;
    importance?: string | null;
  } | null;
};

export type MatchSnapshotQuestionInput = {
  targetRequirementId: string | null;
  status?: string | null;
};

function confidenceRank(confidence: string) {
  if (confidence === "high") return 0;
  if (confidence === "medium") return 1;
  if (confidence === "low") return 2;
  return 3;
}

function improvementConfidenceRank(confidence: string) {
  if (confidence === "low") return 0;
  if (confidence === "missing") return 1;
  if (confidence === "medium") return 2;
  return 3;
}

function importanceRank(importance: string | null | undefined) {
  if (importance === "high") return 0;
  if (importance === "medium") return 1;
  if (importance === "low") return 2;
  return 3;
}

function fitConfidence(fit: MatchSnapshotFitInput): MatchSnapshotConfidence {
  if (
    fit.finalConfidence === "high" ||
    fit.finalConfidence === "medium" ||
    fit.finalConfidence === "low" ||
    fit.finalConfidence === "missing"
  ) {
    return fit.finalConfidence;
  }
  return "missing";
}

export function selectMatchSnapshotFits<TFit extends MatchSnapshotFitInput>(args: {
  fits: TFit[];
  topRequirementIds: string[];
  gapQuestions: MatchSnapshotQuestionInput[];
  strengthCount?: number;
  improvementCount?: number;
  totalCount?: number;
}) {
  const strengthCount = args.strengthCount ?? 2;
  const improvementCount = args.improvementCount ?? 2;
  const totalCount = args.totalCount ?? strengthCount + improvementCount;
  const topRequirementIndex = new Map(
    args.topRequirementIds.map((id, index) => [id, index])
  );
  const questionTargetIds = new Set(
    args.gapQuestions
      .filter((question) => question.status !== "answered" && question.status !== "skipped")
      .map((question) => question.targetRequirementId)
      .filter((id): id is string => !!id)
  );
  const indexed = args.fits
    .filter((fit) => fit.jobRequirement)
    .map((fit, index) => ({ fit, index }));
  const baseSort = (
    a: { fit: TFit; index: number },
    b: { fit: TFit; index: number }
  ) =>
    (topRequirementIndex.get(a.fit.jobRequirementId) ?? Number.MAX_SAFE_INTEGER) -
      (topRequirementIndex.get(b.fit.jobRequirementId) ?? Number.MAX_SAFE_INTEGER) ||
    importanceRank(a.fit.jobRequirement?.importance) -
      importanceRank(b.fit.jobRequirement?.importance) ||
    a.index - b.index;

  const strengths = indexed
    .filter(({ fit }) => {
      const confidence = fitConfidence(fit);
      return confidence === "high" || confidence === "medium";
    })
    .sort(
      (a, b) =>
        confidenceRank(fitConfidence(a.fit)) - confidenceRank(fitConfidence(b.fit)) ||
        baseSort(a, b)
    )
    .slice(0, strengthCount);

  const improvements = indexed
    .filter(({ fit }) => {
      const confidence = fitConfidence(fit);
      if (confidence === "high") return false;
      if (confidence === "medium") {
        return (
          questionTargetIds.has(fit.jobRequirementId) ||
          fit.jobRequirement?.importance === "high" ||
          fit.jobRequirement?.importance === "medium"
        );
      }
      return confidence === "low" || confidence === "missing";
    })
    .sort((a, b) => {
      const questionDelta =
        Number(!questionTargetIds.has(a.fit.jobRequirementId)) -
        Number(!questionTargetIds.has(b.fit.jobRequirementId));
      if (questionDelta !== 0) return questionDelta;
      const confidenceDelta =
        improvementConfidenceRank(fitConfidence(a.fit)) -
        improvementConfidenceRank(fitConfidence(b.fit));
      if (confidenceDelta !== 0) return confidenceDelta;
      return baseSort(a, b);
    })
    .slice(0, improvementCount);

  const selected = [...strengths];
  for (const item of improvements) {
    if (!selected.some(({ fit }) => fit.jobRequirementId === item.fit.jobRequirementId)) {
      selected.push(item);
    }
  }

  for (const item of [...indexed].sort(baseSort)) {
    if (selected.length >= totalCount) break;
    if (!selected.some(({ fit }) => fit.jobRequirementId === item.fit.jobRequirementId)) {
      selected.push(item);
    }
  }

  return selected.slice(0, totalCount).map(({ fit }) => fit);
}

export function selectBalancedMatchPreviewFits<TFit extends MatchSnapshotFitInput>(args: {
  fits: TFit[];
  topRequirementIds: string[];
  totalCount?: number;
}) {
  const totalCount = args.totalCount ?? 4;
  const topRequirementIndex = new Map(
    args.topRequirementIds.map((id, index) => [id, index])
  );
  const indexed = args.fits
    .filter((fit) => fit.jobRequirement)
    .map((fit, index) => ({ fit, index }));
  const sortForPreview = (
    a: { fit: TFit; index: number },
    b: { fit: TFit; index: number }
  ) =>
    (topRequirementIndex.get(a.fit.jobRequirementId) ?? Number.MAX_SAFE_INTEGER) -
      (topRequirementIndex.get(b.fit.jobRequirementId) ?? Number.MAX_SAFE_INTEGER) ||
    importanceRank(a.fit.jobRequirement?.importance) -
      importanceRank(b.fit.jobRequirement?.importance) ||
    a.index - b.index;
  const buckets: Record<
    MatchSnapshotConfidence,
    Array<{ fit: TFit; index: number }>
  > = {
    high: [],
    medium: [],
    low: [],
    missing: [],
  };

  for (const item of indexed) {
    buckets[fitConfidence(item.fit)].push(item);
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort(sortForPreview);
  }

  const selected: Array<{ fit: TFit; index: number }> = [];
  const selectedIds = new Set<string>();
  const addNext = (confidence: MatchSnapshotConfidence) => {
    const next = buckets[confidence].find(
      ({ fit }) => !selectedIds.has(fit.jobRequirementId)
    );
    if (!next) return false;
    selected.push(next);
    selectedIds.add(next.fit.jobRequirementId);
    return true;
  };

  (["high", "medium", "low", "missing"] as const).forEach(addNext);

  const hasMedium = buckets.medium.length > 0;
  const hasMissing = buckets.missing.length > 0;
  const fillOrder: MatchSnapshotConfidence[] = !hasMissing
    ? ["low", "medium", "high", "missing"]
    : !hasMedium
      ? ["high", "low", "missing", "medium"]
      : ["low", "missing", "medium", "high"];

  while (selected.length < totalCount) {
    const before = selected.length;
    for (const confidence of fillOrder) {
      if (selected.length >= totalCount) break;
      addNext(confidence);
    }
    if (selected.length === before) break;
  }

  if (selected.length < totalCount) {
    for (const item of [...indexed].sort(sortForPreview)) {
      if (selected.length >= totalCount) break;
      if (selectedIds.has(item.fit.jobRequirementId)) continue;
      selected.push(item);
      selectedIds.add(item.fit.jobRequirementId);
    }
  }

  return selected.slice(0, totalCount).map(({ fit }) => fit);
}
