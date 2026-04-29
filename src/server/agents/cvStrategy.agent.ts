import { AgentJsonSchemas, CvStrategyOutputSchema } from "~/lib/schemas";
import type { RequirementEvidenceMapRow } from "~/server/services/rag.service";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { cvStrategyPrompt } from "~/server/prompts/cvStrategy.prompt";

export type CvStrategyContext = {
  jobSummary: {
    title: string;
    company: string | null;
    seniority: string | null;
    summary: string;
  };
  requirements: Array<{
    id: string;
    label: string;
    description: string;
    importance: string;
    type: string;
  }>;
  candidateProfileSummary: string;
  evidenceMap: RequirementEvidenceMapRow[];
  strongEvidence: Array<{
    requirementId: string;
    requirementLabel: string;
    chunkId: string;
    content: string;
    confidence: string;
  }>;
  weakOrMissingRequirements: Array<{
    id: string;
    label: string;
    description: string;
    importance: string;
  }>;
};

export async function runCvStrategyAgent(args: {
  applicationId: string;
  context: CvStrategyContext;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "CV Strategy Agent",
    model: "fast",
    systemPrompt: cvStrategyPrompt,
    userPrompt: JSON.stringify(args.context),
    schema: CvStrategyOutputSchema,
    jsonSchema: AgentJsonSchemas.cvStrategy,
    mockOutput: () => ({
      strategySummary:
        "Lead with the strongest applied AI projects and keep unsupported requirements out of headline claims.",
      targetPositioning: `${args.context.jobSummary.title} candidate who turns business problems into practical LLM workflows backed by concrete project evidence.`,
      sectionOrder: ["Summary", "Skills", "Projects", "Experience", "Education"],
      emphasis: args.context.strongEvidence
        .slice(0, 6)
        .map(
          (evidence) =>
            `${evidence.requirementLabel}: ${evidence.content.slice(0, 180)}`
        ),
      deEmphasis: args.context.weakOrMissingRequirements.map(
        (requirement) => requirement.label
      ),
      evidenceToUse: args.context.strongEvidence.slice(0, 8).map((evidence) => ({
        requirementId: evidence.requirementId,
        chunkIds: [evidence.chunkId],
        note: `Use this evidence for ${evidence.requirementLabel}.`,
      })),
      warnings: args.context.weakOrMissingRequirements.map(
        (requirement) =>
          `Avoid overstating ${requirement.label}; evidence is weak or missing.`
      ),
    }),
  });
}
