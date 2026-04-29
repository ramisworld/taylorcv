import { AgentJsonSchemas, GapQuestionOutputSchema } from "~/lib/schemas";
import type { RequirementEvidenceMapRow } from "~/server/services/rag.service";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { gapQuestionPrompt } from "~/server/prompts/gapQuestion.prompt";

function gapArea(label: string) {
  const normalized = label.toLowerCase();
  if (/\brag\b|retrieval|ground/.test(normalized)) return "retrieval";
  if (/agent|tool call|function/.test(normalized)) return "agentic";
  if (/eval|reliab|safety|guardrail|quality/.test(normalized)) return "quality";
  if (/customer|communication|stakeholder|tradeoff/.test(normalized))
    return "communication";
  if (/deploy|backend|integration|database|api/.test(normalized))
    return "backend";
  return normalized
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

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
      const seenAreas = new Set<string>();
      const weakImportantRequirements = args.evidenceMap
        .filter(
          (row) =>
            row.requirementImportance !== "low" &&
            (row.overallConfidence === "weak" ||
              row.overallConfidence === "missing")
        )
        .filter((row) => {
          const area = gapArea(row.requirementLabel);
          if (seenAreas.has(area)) return false;
          seenAreas.add(area);
          return true;
        })
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
