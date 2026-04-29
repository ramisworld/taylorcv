import { AgentJsonSchemas, GapQuestionOutputSchema } from "~/lib/schemas";
import type { RequirementEvidenceMapRow } from "~/server/services/rag.service";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { gapQuestionPrompt } from "~/server/prompts/gapQuestion.prompt";

export async function runGapQuestionAgent(args: {
  applicationId: string;
  evidenceMap: RequirementEvidenceMapRow[];
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
      const weakImportantRequirements = args.evidenceMap
        .filter(
          (row) =>
            row.requirementImportance !== "low" &&
            (row.overallConfidence === "weak" ||
              row.overallConfidence === "missing")
        )
        .slice(0, 5);

      return {
        questions: weakImportantRequirements.map((row) => ({
          targetRequirementId: row.requirementId,
          question: `Do you have concrete experience with ${row.requirementLabel}?`,
          reason: `The job calls for ${row.requirementLabel}, but current evidence is ${row.overallConfidence}.`,
        })),
      };
    },
  });
}
