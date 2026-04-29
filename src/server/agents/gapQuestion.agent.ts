import { AgentJsonSchemas, GapQuestionOutputSchema } from "~/lib/schemas";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { gapQuestionPrompt } from "~/server/prompts/gapQuestion.prompt";

export async function runGapQuestionAgent(args: {
  applicationId: string;
  requirements: Array<{
    id: string;
    label: string;
    description: string;
    importance: string;
  }>;
  evidenceMatches: Array<{
    jobRequirementId: string;
    confidence: string;
    reason: string;
  }>;
  candidateProfileSummary: string;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Gap Question Agent",
    model: "fast",
    systemPrompt: gapQuestionPrompt,
    userPrompt: JSON.stringify(args),
    schema: GapQuestionOutputSchema,
    jsonSchema: AgentJsonSchemas.gapQuestion,
    mockOutput: () => {
      const coveredRequirementIds = new Set(
        args.evidenceMatches
          .filter(
            (match) =>
              match.confidence === "high" || match.confidence === "medium"
          )
          .map((match) => match.jobRequirementId)
      );

      const weakImportantRequirements = args.requirements
        .filter(
          (requirement) =>
            requirement.importance !== "low" &&
            !coveredRequirementIds.has(requirement.id)
        )
        .slice(0, 5);

      return {
        questions: weakImportantRequirements.map((requirement) => ({
          targetRequirementId: requirement.id,
          question: `Do you have concrete experience with ${requirement.label}?`,
          reason: `The job calls for ${requirement.label}, but current evidence is weak or missing.`,
        })),
      };
    },
  });
}
