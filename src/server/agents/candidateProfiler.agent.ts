import {
  AgentJsonSchemas,
  CandidateProfilerAgentOutputSchema,
} from "~/lib/schemas";
import { expandCandidateProfilerOutput } from "~/lib/candidateProfilerPostprocess";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { candidateProfilerPrompt } from "~/server/prompts/candidateProfiler.prompt";

const CANDIDATE_PROFILER_BASELINE_SYSTEM_PROMPT_CHARS = 2690;
const CANDIDATE_PROFILER_BASELINE_SCHEMA_CHARS = 3652;
const CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SYSTEM_PROMPT_CHARS = 1450;
const CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SCHEMA_CHARS = 4182;
const removedFromLlmFields = [
  "contactInfo.email",
  "contactInfo.phone",
  "links",
  "sourceSummary",
  "metricOpportunities",
  "strongProofCandidates",
  "scopeOpportunities",
  "likelyTopEvidence",
] as const;
const deterministicProfilerFields = [
  "contactInfo.email",
  "contactInfo.phone",
  "links",
  "sourceSummary",
  "metricOpportunities",
  "strongProofCandidates",
  "scopeOpportunities",
  "likelyTopEvidence",
] as const;

function estimateTokens(chars: number) {
  return Math.ceil(chars / 4);
}

function logPayloadMetrics(args: {
  applicationId: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
}) {
  const systemPromptChars = args.systemPrompt.length;
  const userInputChars = args.userPrompt.length;
  const outputSchemaChars = JSON.stringify(args.jsonSchema).length;
  const totalRequestChars = systemPromptChars + userInputChars + outputSchemaChars;
  console.info("TAYLOR_PAYLOAD_METRICS", {
    applicationId: args.applicationId,
    agentName: "Candidate Profiler Agent",
    systemPromptChars,
    userInputChars,
    outputSchemaChars,
    totalRequestChars,
    estimatedTokens: estimateTokens(totalRequestChars),
    rawCvChars: (args.rawCvText ?? "").length,
    rawBackgroundChars: (args.rawBackgroundText ?? "").length,
    baselineSystemPromptChars: CANDIDATE_PROFILER_BASELINE_SYSTEM_PROMPT_CHARS,
    baselineOutputSchemaChars: CANDIDATE_PROFILER_BASELINE_SCHEMA_CHARS,
    previousActiveSystemPromptChars: CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SYSTEM_PROMPT_CHARS,
    previousActiveOutputSchemaChars: CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SCHEMA_CHARS,
    promptCharsBeforeAfterDelta:
      CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SYSTEM_PROMPT_CHARS - systemPromptChars,
    outputSchemaCharsBeforeAfterDelta:
      CANDIDATE_PROFILER_PREVIOUS_ACTIVE_SCHEMA_CHARS - outputSchemaChars,
    llmOutputFields: [
      "contactInfo.fullName",
      "contactInfo.professionalTitle",
      "contactInfo.location",
      "summary",
      "skills",
      "projects",
      "experience",
      "education",
      "certifications",
      "tools",
      "achievements",
      "cautionNotes",
    ],
    deterministicFields: [...deterministicProfilerFields],
    consumedDownstreamFields: [
      "contactInfo",
      "links",
      "sourceSummary",
      "summary",
      "skills",
      "projects",
      "experience",
      "education",
      "certifications",
      "tools",
      "achievements",
      "cautionNotes",
      "metricOpportunities",
      "scopeOpportunities",
    ],
    weaklyUsedFields: [
      "sourceSummary",
      "metricOpportunities",
      "scopeOpportunities",
      "strongProofCandidates",
      "likelyTopEvidence",
    ],
    removedFromLlmFields: [...removedFromLlmFields],
    removedFields: [],
  });
}

export async function runCandidateProfilerAgent(args: {
  applicationId: string;
  rawCvText?: string | null;
  rawBackgroundText?: string | null;
}) {
  const userPrompt = JSON.stringify({
    rawCvText: args.rawCvText ?? "",
    rawBackgroundText: args.rawBackgroundText ?? "",
  });
  logPayloadMetrics({
    applicationId: args.applicationId,
    systemPrompt: candidateProfilerPrompt,
    userPrompt,
    jsonSchema: AgentJsonSchemas.candidateProfiler,
    rawCvText: args.rawCvText,
    rawBackgroundText: args.rawBackgroundText,
  });
  const agentOutput = await runJsonAgent({
    applicationId: args.applicationId,
    agentName: "Candidate Profiler Agent",
    model: "fast",
    systemPrompt: candidateProfilerPrompt,
    userPrompt,
    schema: CandidateProfilerAgentOutputSchema,
    jsonSchema: AgentJsonSchemas.candidateProfiler,
    mockOutput: () => ({
      contactInfo: {
        fullName: null,
        professionalTitle: "AI Application Builder",
        location: null,
      },
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
    }),
  });
  return expandCandidateProfilerOutput({
    rawCvText: args.rawCvText,
    rawBackgroundText: args.rawBackgroundText,
    output: agentOutput,
  });
}
