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
          name: "Document Q&A Assistant",
          description:
            "Built a document question-answering workflow using PostgreSQL, pgvector, embeddings, Prisma, Next.js, and TypeScript.",
          tools: [
            "PostgreSQL",
            "pgvector",
            "Prisma",
            "Next.js",
            "TypeScript",
          ],
          outcomes: ["Connected source documents to concise grounded answers."],
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
            "Designed AI application workflows with retrieval, database writes, and frontend display.",
          bullets: [],
          technologies: ["Next.js", "TypeScript", "OpenAI", "PostgreSQL"],
          tools: ["Next.js", "TypeScript", "OpenAI", "PostgreSQL"],
          achievements: [],
          outcomes: ["Shipped working MVPs that connect retrieval workflows to users."],
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
      cautionNotes: [],
      metricOpportunities: [
        "User count, document count, or workflow frequency for AI projects",
        "Response-quality improvement, retrieval scope, or deployment environment",
      ],
      strongProofCandidates: [
        "Document Q&A workflow with retrieval and grounded response writing",
        "RenovAI RAG application using domain-specific renovation data",
      ],
      scopeOpportunities: [
        "Number of users, documents, or applications processed",
        "Deployment environment and reliability checks",
      ],
      likelyTopEvidence: [
        "Built a document Q&A assistant with PostgreSQL, pgvector, embeddings, Prisma, Next.js, and TypeScript",
      ],
    }),
  });
}
