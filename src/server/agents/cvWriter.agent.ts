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
        strategy?: { sectionOrderJson?: unknown };
        selectedEvidence?: Array<{ content: string }>;
      };
      const title = context.job?.title ?? "AI Application Engineer";
      const evidence = context.selectedEvidence?.map((item) => item.content) ?? [];
      const strategySectionOrder = Array.isArray(context.strategy?.sectionOrderJson)
        ? context.strategy.sectionOrderJson.filter(
            (section): section is string => typeof section === "string"
          )
        : [];
      const sectionOrder =
        strategySectionOrder.length > 0
          ? strategySectionOrder
          : [
              "Summary",
              "Selected Projects",
              "Experience",
              "Skills",
              "Education",
              "Certifications",
            ];
      const cvJson = {
        sectionOrder,
        header: {
          name: null,
          targetTitle: title,
          location: null,
          phone: null,
          email: null,
          links: [],
        },
        summary:
          context.candidateProfile?.summary ??
          "Applied AI builder with practical experience turning business workflows into LLM-backed tools.",
        skills: {
          groups: [
            { label: "Languages", items: ["TypeScript", "JavaScript"] },
            {
              label: "AI / LLM",
              items: ["RAG", "embeddings", "structured outputs", "tool calling"],
            },
            { label: "Backend / Data", items: ["Node.js", "PostgreSQL", "pgvector", "Prisma"] },
            { label: "Frontend", items: ["Next.js", "React"] },
          ],
        },
        experience: [
          {
            title: "AI Application Builder",
            company: null,
            dates: null,
            location: null,
            bullets: [
              "Built AI workflows connecting model outputs, backend tools, database writes, and user-facing interfaces.",
            ],
          },
        ],
        projects: evidence.slice(0, 3).map((project, index) => ({
          name: index === 0 ? "Taylor CV" : "Applied AI Project",
          descriptor: null,
          dates: null,
          bullets: [project],
        })),
        education: [],
        certifications: [],
      };

      return {
        cvJson,
        cvText: [
          cvJson.header.name,
          cvJson.header.targetTitle,
          "",
          "SUMMARY",
          cvJson.summary,
          "",
          ...(cvJson.projects.length
            ? [
                "",
                "PROJECTS",
                ...cvJson.projects.flatMap((project) => [
                  project.name ?? "Project",
                  ...project.bullets.map((bullet) => `- ${bullet}`),
                ]),
              ]
            : []),
          ...(cvJson.experience.length
            ? [
                "",
                "EXPERIENCE",
                ...cvJson.experience.flatMap((item) => [
                  item.title ?? "Experience",
                  ...item.bullets.map((bullet) => `- ${bullet}`),
                ]),
              ]
            : []),
          "",
          "SKILLS",
          ...cvJson.skills.groups.map(
            (group) => `${group.label}: ${group.items.join(", ")}`
          ),
        ]
          .filter((line) => line !== null)
          .join("\n"),
        assumptions: [],
        improvementSuggestions: [
          "Add concrete impact metrics, user counts, latency changes, or deployment scope where available.",
        ],
      };
    },
  });
}
