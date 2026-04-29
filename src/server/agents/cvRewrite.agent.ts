import { AgentJsonSchemas, CvRewriteOutputSchema } from "~/lib/schemas";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { cvRewritePrompt } from "~/server/prompts/cvRewrite.prompt";

export async function runCvRewriteAgent(args: {
  applicationId: string;
  sectionId: string;
  currentSection: string;
  instruction: string;
  context: unknown;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "CV Rewrite Agent",
    model: "strong",
    systemPrompt: cvRewritePrompt,
    userPrompt: JSON.stringify(args),
    schema: CvRewriteOutputSchema,
    jsonSchema: AgentJsonSchemas.cvRewrite,
    mockOutput: () => ({
      updatedSection: `${args.currentSection}\nUpdated instruction applied: ${args.instruction}`,
    }),
  });
}
