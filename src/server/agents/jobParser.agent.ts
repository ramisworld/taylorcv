import { AgentJsonSchemas, JobParserOutputSchema } from "~/lib/schemas";
import { jobParserPrompt } from "~/server/prompts/jobParser.prompt";
import { runJsonAgent } from "~/server/agents/agentRunner";

export async function runJobParserAgent(args: {
  applicationId: string;
  rawJobText: string;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Job Parser Agent",
    model: "fast",
    systemPrompt: jobParserPrompt,
    userPrompt: args.rawJobText,
    schema: JobParserOutputSchema,
    jsonSchema: AgentJsonSchemas.jobParser,
    mockOutput: () => ({
      title: "AI Application Engineer",
      company: "Taylor Labs",
      seniority: "Mid-level",
      summary:
        "Build AI applications using RAG, agentic workflows, OpenAI models, PostgreSQL, pgvector, Next.js, and TypeScript.",
      requirements: [
        {
          type: "skill" as const,
          label: "RAG",
          description:
            "Build retrieval augmented generation workflows using searchable evidence.",
          importance: "high" as const,
        },
        {
          type: "skill" as const,
          label: "Agents",
          description:
            "Design agentic AI workflows where model outputs drive backend tools.",
          importance: "high" as const,
        },
        {
          type: "tool" as const,
          label: "OpenAI API",
          description: "Use OpenAI models and embeddings in production apps.",
          importance: "high" as const,
        },
        {
          type: "tool" as const,
          label: "PostgreSQL and pgvector",
          description:
            "Store and search vector embeddings in PostgreSQL using pgvector.",
          importance: "medium" as const,
        },
        {
          type: "tool" as const,
          label: "Next.js and TypeScript",
          description:
            "Build full-stack product workflows with Next.js and TypeScript.",
          importance: "medium" as const,
        },
        {
          type: "responsibility" as const,
          label: "Deployment",
          description: "Deploy AI applications and connect them to frontends.",
          importance: "medium" as const,
        },
      ],
    }),
  });
}
