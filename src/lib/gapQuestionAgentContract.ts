export type GapQuestionAgentTarget = {
  jobRequirementId: string;
  label: string;
  description: string;
  importance: string;
  finalConfidence: string;
  reason: string;
  selectedEvidenceSnippet?: string | null;
};

export type GapQuestionAgentInput = {
  job: {
    title: string;
    company: string | null;
    summary: string;
    roleDomain?: string | null;
    archetypeHint?: string | null;
  };
  candidateContext: {
    summary: string;
    strongestAreas: string[];
  };
  targets: GapQuestionAgentTarget[];
};

export type GapQuestionAgentOutput = {
  questions: Array<{
    targetRequirementId: string | null;
    question: string;
    reason: string;
    whyItMatters: string;
    answerGuidance: string;
    exampleAnswer: string;
    exampleAngles: string[];
  }>;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shortText(value: string | null | undefined, maxLength: number) {
  const text = cleanText(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd().replace(/[.,;:!?-]+$/, "")}.`;
}

export function buildGapQuestionJsonSchema(input: GapQuestionAgentInput) {
  const targetIds = input.targets.map((target) => target.jobRequirementId);
  const targetRequirementId =
    targetIds.length > 0
      ? { type: "string", enum: targetIds }
      : { type: "string" };

  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "targetRequirementId",
            "question",
            "reason",
            "whyItMatters",
            "answerGuidance",
            "exampleAnswer",
            "exampleAngles",
          ],
          properties: {
            targetRequirementId,
            question: { type: "string", maxLength: 180 },
            reason: { type: "string", maxLength: 180 },
            whyItMatters: { type: "string", maxLength: 180 },
            answerGuidance: { type: "string", maxLength: 220 },
            exampleAnswer: { type: "string", maxLength: 260 },
            exampleAngles: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 90 },
            },
          },
        },
      },
    },
  } as const;
}

function targetTheme(target: GapQuestionAgentTarget) {
  const text = `${target.label} ${target.description} ${target.reason}`.toLowerCase();
  if (/\b(stakeholder|collaborat|client|customer|product|design|research|team)\b/.test(text)) {
    return "collaboration";
  }
  if (/\b(latency|cost|reliability|uptime|throughput|performance|scale|optim)\b/.test(text)) {
    return "system-improvement";
  }
  if (/\b(metric|measur|impact|outcome|result|scope|user|usage)\b/.test(text)) {
    return "impact";
  }
  if (/\b(own|led|responsib|delivered|managed|architect)\b/.test(text)) {
    return "ownership";
  }
  return cleanText(target.label).toLowerCase();
}

function mockQuestionForTarget(target: GapQuestionAgentTarget) {
  const theme = targetTheme(target);
  if (theme === "collaboration") {
    return {
      targetRequirementId: target.jobRequirementId,
      question: "Have you worked with other teams or stakeholders to deliver a project? What was your role?",
      reason: "The current evidence does not clearly show this collaboration story.",
      whyItMatters: "A real example could strengthen an important teamwork signal for this role.",
      answerGuidance: "Mention who you worked with, what you owned, and what changed.",
      exampleAnswer:
        "Example: Yes, I worked with a product lead and designer to refine an AI workflow, then implemented backend changes from their feedback.",
      exampleAngles: ["Who you worked with", "Your role", "What changed"],
    };
  }
  if (theme === "system-improvement") {
    return {
      targetRequirementId: target.jobRequirementId,
      question: "Have you improved latency, cost, reliability, or output quality in a real system? What changed?",
      reason: "The current evidence is thin on measurable system improvement.",
      whyItMatters: "A concrete improvement can turn a weak requirement into useful CV proof.",
      answerGuidance: "Share the system, the change you made, and any rough before-and-after result.",
      exampleAnswer:
        "Example: Yes, I cached repeated model calls and simplified retrieval, which made responses noticeably faster for users.",
      exampleAngles: ["Metric improved", "Technical change", "User or team impact"],
    };
  }
  return {
    targetRequirementId: target.jobRequirementId,
    question: `Have you done work related to ${shortText(target.label, 80)}? What did you do?`,
    reason: shortText(target.reason, 160) || "The current evidence does not clearly support this requirement.",
    whyItMatters:
      target.importance === "high"
        ? "This is a priority requirement, so a real example could materially improve the CV."
        : "A specific example could make this part of the CV more credible.",
    answerGuidance: "One short paragraph is enough: context, your role, and the result or scope.",
    exampleAnswer:
      "Example: Yes, I owned a related project, made the key implementation decisions, and delivered a working feature used in the final workflow.",
    exampleAngles: ["Context", "Your role", "Result or scope"],
  };
}

export function mockGapQuestionOutput(input: GapQuestionAgentInput): GapQuestionAgentOutput {
  const usedThemes = new Set<string>();
  const questions = [];
  for (const target of input.targets) {
    const theme = targetTheme(target);
    if (usedThemes.has(theme)) continue;
    usedThemes.add(theme);
    questions.push(mockQuestionForTarget(target));
    if (questions.length >= 3) break;
  }
  return { questions };
}
