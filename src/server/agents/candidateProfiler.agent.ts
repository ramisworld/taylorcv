import {
  AgentJsonSchemas,
  CandidateProfilerOutputSchema,
} from "~/lib/schemas";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { candidateProfilerPrompt } from "~/server/prompts/candidateProfiler.prompt";

export async function runCandidateProfilerAgent(args: {
  applicationId: string;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Candidate Profiler Agent",
    model: "fast",
    systemPrompt: candidateProfilerPrompt,
    userPrompt: JSON.stringify({
      rawCvText: args.rawCvText ?? "",
      rawBackgroundText: args.rawBackgroundText ?? "",
    }),
    schema: CandidateProfilerOutputSchema,
    jsonSchema: AgentJsonSchemas.candidateProfiler,
    mockOutput: () => ({
      contactInfo: {
        fullName: null,
        professionalTitle: "AI Application Builder",
        location: null,
        email: null,
        phone: null,
      },
      links: {
        linkedin: null,
        github: null,
        portfolio: null,
        other: [],
      },
      sourceSummary:
        "Mock candidate profile generated from supplied AI application background.",
      summary:
        "Full-stack AI builder with hands-on RAG, OpenAI, PostgreSQL, pgvector, Next.js, TypeScript, and deployment experience.",
      skills: [
        "RAG",
        "Agentic workflows",
        "OpenAI API",
        "PostgreSQL",
        "pgvector",
        "Next.js",
        "TypeScript",
      ],
      projects: [
        {
          name: "RenovAI",
          description:
            "Built an AI renovation assistant using RAG, OpenAI-style workflows, domain-specific renovation data, and a web frontend.",
          tools: ["RAG", "OpenAI", "Next.js", "TypeScript"],
          outcomes: [
            "Created searchable project evidence for renovation recommendations.",
          ],
          links: [],
        },
        {
          name: "Taylor CV",
          description:
            "Built an AI CV tailoring workflow using agents, PostgreSQL, pgvector, embeddings, tRPC, Prisma, Next.js, and TypeScript.",
          tools: [
            "Agents",
            "PostgreSQL",
            "pgvector",
            "OpenAI",
            "tRPC",
            "Prisma",
          ],
          outcomes: ["Connected job requirements to candidate evidence chunks."],
          links: [],
        },
      ],
      experience: [
        {
          role: "AI Product Builder",
          organization: null,
          startDate: null,
          endDate: null,
          current: false,
          description:
            "Designed and deployed AI workflows with backend orchestration, model calls, database writes, and frontend display.",
          bullets: [],
          technologies: ["Next.js", "TypeScript", "OpenAI", "PostgreSQL"],
          tools: ["Next.js", "TypeScript", "OpenAI", "PostgreSQL"],
          achievements: [],
          outcomes: ["Shipped working MVPs that connect AI workflows to users."],
        },
      ],
      education: [],
      certifications: [],
      tools: [
        "OpenAI API",
        "PostgreSQL",
        "pgvector",
        "Next.js",
        "React",
        "TypeScript",
        "Prisma",
        "tRPC",
      ],
      achievements: [
        "Deployed AI application workflows and connected model inference to frontends.",
      ],
    }),
  });
}
