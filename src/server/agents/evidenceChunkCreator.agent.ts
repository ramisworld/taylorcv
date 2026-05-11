import {
  AgentJsonSchemas,
  EvidenceChunkCreatorOutputSchema,
} from "~/lib/schemas";
import type { CandidateProfilerOutput } from "~/lib/types";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { evidenceChunkCreatorPrompt } from "~/server/prompts/evidenceChunkCreator.prompt";

type ProfileChunkInput = {
  mode: "profile";
  profile: CandidateProfilerOutput;
};

type GapAnswerChunkInput = {
  mode: "gap_answer";
  question: string;
  targetRequirement: {
    id: string;
    label: string;
    description: string;
  } | null;
  buttonAnswer: "yes" | "kind_of" | "no" | "skip";
  selectedOption?: string | null;
  followUpText?: string | null;
  metricText?: string | null;
  elaboration?: string | null;
  gapAnswerId: string;
};

function metadata(args: {
  action?: string | null;
  context?: string | null;
  toolsOrMethods?: string[];
  ownership?: string | null;
  outcome?: string | null;
  metric?: string | null;
  scope?: string | null;
  source?: string | null;
  targetRequirementId?: string | null;
  targetRequirementLabel?: string | null;
  cvUsefulness?: "cv_ready" | "supporting" | "keyword_only" | "caution";
  cautionNotes?: string[];
}) {
  return {
    action: args.action ?? null,
    context: args.context ?? null,
    toolsOrMethods: args.toolsOrMethods ?? [],
    ownership: args.ownership ?? null,
    outcome: args.outcome ?? null,
    metric: args.metric ?? null,
    scope: args.scope ?? null,
    source: args.source ?? null,
    targetRequirementId: args.targetRequirementId ?? null,
    targetRequirementLabel: args.targetRequirementLabel ?? null,
    cvUsefulness: args.cvUsefulness ?? "supporting",
    cautionNotes: args.cautionNotes ?? [],
  };
}

export async function runEvidenceChunkCreatorAgent(args: {
  applicationId: string;
  input: ProfileChunkInput | GapAnswerChunkInput;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Evidence Chunk Creator Agent",
    model: "fast",
    systemPrompt: evidenceChunkCreatorPrompt,
    userPrompt: JSON.stringify(args.input),
    schema: EvidenceChunkCreatorOutputSchema,
    jsonSchema: AgentJsonSchemas.evidenceChunkCreator,
    mockOutput: () => {
      if (args.input.mode === "gap_answer") {
        const evidenceText = [
          args.input.followUpText,
          args.input.metricText,
        ]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(". ");
        if (
          (args.input.buttonAnswer === "yes" ||
            args.input.buttonAnswer === "kind_of") &&
          evidenceText
        ) {
          return {
            chunks: [
              {
                chunkType: "gap_answer" as const,
                content: evidenceText,
                tags: [
                  args.input.targetRequirement?.label ?? "gap answer",
                  "gap_answer",
                ],
                sourceType: "gap_answer" as const,
                sourceId: args.input.gapAnswerId,
                metadata: metadata({
                  action: args.input.selectedOption ?? null,
                  context: args.input.followUpText ?? args.input.elaboration ?? null,
                  metric: args.input.metricText ?? null,
                  source: "gap_answer",
                  targetRequirementId: args.input.targetRequirement?.id ?? null,
                  targetRequirementLabel:
                    args.input.targetRequirement?.label ?? null,
                  cvUsefulness:
                    args.input.followUpText || args.input.metricText
                      ? "cv_ready"
                      : "keyword_only",
                }),
              },
            ],
          };
        }

        return { chunks: [] };
      }

      const profile = args.input.profile;
      const chunks = [
        ...profile.projects.map((project) => ({
          chunkType: "project" as const,
          content: `${project.name ? `${project.name}: ` : ""}${project.description} Tools used: ${project.tools.join(", ")}. Outcomes: ${project.outcomes.join(" ")}`,
          tags: [...project.tools, project.name].filter(Boolean) as string[],
          sourceType: "profile" as const,
          sourceId: null,
          metadata: metadata({
            action: "built project",
            context: project.name ?? project.description,
            toolsOrMethods: project.tools,
            outcome: project.outcomes.join(" ") || null,
            source: "profile",
            cvUsefulness: project.outcomes.length > 0 ? "cv_ready" : "supporting",
          }),
        })),
        ...profile.experience.map((experience) => ({
          chunkType: "experience" as const,
          content: `${experience.role ?? "Experience"}${experience.organization ? ` at ${experience.organization}` : ""}: ${experience.description} Technologies: ${experience.technologies.join(", ")}. Outcomes: ${experience.outcomes.join(" ")}`,
          tags: experience.technologies,
          sourceType: "profile" as const,
          sourceId: null,
          metadata: metadata({
            action: experience.role ?? "work experience",
            context: experience.organization ?? experience.description,
            toolsOrMethods: [...experience.technologies, ...experience.tools],
            outcome: experience.outcomes.join(" ") || null,
            source: "profile",
            cvUsefulness:
              experience.outcomes.length > 0 || experience.achievements.length > 0
                ? "cv_ready"
                : "supporting",
          }),
        })),
        ...profile.achievements.map((achievement) => ({
          chunkType: "achievement" as const,
          content: achievement,
          tags: ["achievement"],
          sourceType: "profile" as const,
          sourceId: null,
          metadata: metadata({
            action: achievement,
            context: "achievement",
            source: "profile",
            cvUsefulness: "supporting",
          }),
        })),
      ];

      return { chunks };
    },
  });
}
