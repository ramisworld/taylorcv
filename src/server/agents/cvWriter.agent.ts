import { AgentJsonSchemas, CvWriterOutputSchema } from "~/lib/schemas";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { cvWriterPrompt } from "~/server/prompts/cvWriter.prompt";

export async function runCvWriterAgent(args: {
  applicationId: string;
  context: unknown;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "CV Writer Agent",
    model: "strong",
    systemPrompt: cvWriterPrompt,
    userPrompt: JSON.stringify(args.context),
    schema: CvWriterOutputSchema,
    jsonSchema: AgentJsonSchemas.cvWriter,
    mockOutput: () => {
      const context = args.context as {
        job?: { title?: string; company?: string | null };
        candidateProfile?: { summary?: string };
        selectedEvidence?: Array<{ content: string }>;
      };
      const title = context.job?.title ?? "AI Application Engineer";
      const evidence = context.selectedEvidence?.map((item) => item.content) ?? [];
      const cvJson = {
        header: "Taylor Candidate",
        summary:
          context.candidateProfile?.summary ??
          "Full-stack AI builder with practical RAG and agent workflow experience.",
        skills: [
          "RAG",
          "Agentic workflows",
          "OpenAI API",
          "PostgreSQL",
          "pgvector",
          "Next.js",
          "TypeScript",
        ],
        projects: evidence.slice(0, 4),
        experience: [
          "Built AI workflows that connect model outputs, backend tools, database writes, and frontend UX.",
        ],
        education: [],
        certifications: [],
      };

      return {
        cvJson,
        cvText: [
          cvJson.header,
          "",
          title,
          "",
          "SUMMARY",
          cvJson.summary,
          "",
          "SKILLS",
          cvJson.skills.join(", "),
          "",
          "PROJECTS",
          ...cvJson.projects.map((project) => `- ${project}`),
          "",
          "EXPERIENCE",
          ...cvJson.experience.map((item) => `- ${item}`),
        ].join("\n"),
      };
    },
  });
}
