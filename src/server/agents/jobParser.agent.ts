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
          label: "RAG and retrieval systems",
          description:
            "Build retrieval augmented generation workflows using searchable evidence.",
          importance: "high" as const,
        },
        {
          type: "skill" as const,
          label: "Agentic workflows and tool calling",
          description:
            "Design agentic AI workflows where model outputs drive backend tools.",
          importance: "high" as const,
        },
        {
          type: "tool" as const,
          label: "LLM APIs and structured outputs",
          description: "Use OpenAI models and embeddings in production apps.",
          importance: "high" as const,
        },
        {
          type: "responsibility" as const,
          label: "Backend integrations and deployment",
          description:
            "Connect AI workflows to backend services, databases, and deployed product surfaces.",
          importance: "medium" as const,
        },
        {
          type: "responsibility" as const,
          label: "AI evaluation and reliability",
          description:
            "Evaluate model outputs and improve reliability of AI application behavior.",
          importance: "medium" as const,
        },
        {
          type: "soft_skill" as const,
          label: "Customer-facing technical communication",
          description:
            "Explain technical tradeoffs and AI product behavior to users or stakeholders.",
          importance: "medium" as const,
        },
      ],
    }),
  });
}
