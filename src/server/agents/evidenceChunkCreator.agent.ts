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
  elaboration?: string | null;
  gapAnswerId: string;
};

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
        if (
          (args.input.buttonAnswer === "yes" ||
            args.input.buttonAnswer === "kind_of") &&
          args.input.elaboration?.trim()
        ) {
          return {
            chunks: [
              {
                chunkType: "gap_answer" as const,
                content: `${args.input.elaboration.trim()} This evidence relates to ${args.input.targetRequirement?.label ?? "the target requirement"}.`,
                tags: [
                  args.input.targetRequirement?.label ?? "gap answer",
                  "gap_answer",
                ],
                sourceType: "gap_answer" as const,
                sourceId: args.input.gapAnswerId,
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
        })),
        ...profile.experience.map((experience) => ({
          chunkType: "experience" as const,
          content: `${experience.role ?? "Experience"}${experience.organization ? ` at ${experience.organization}` : ""}: ${experience.description} Technologies: ${experience.technologies.join(", ")}. Outcomes: ${experience.outcomes.join(" ")}`,
          tags: experience.technologies,
          sourceType: "profile" as const,
          sourceId: null,
        })),
        ...profile.skills.map((skill) => ({
          chunkType: "skill" as const,
          content: `Candidate reports practical skill with ${skill}.`,
          tags: [skill],
          sourceType: "profile" as const,
          sourceId: null,
        })),
        ...profile.achievements.map((achievement) => ({
          chunkType: "achievement" as const,
          content: achievement,
          tags: ["achievement"],
          sourceType: "profile" as const,
          sourceId: null,
        })),
      ];

      return { chunks };
    },
  });
}
