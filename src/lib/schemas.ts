import { z } from "zod";

export const RequirementTypeSchema = z.enum([
  "skill",
  "tool",
  "responsibility",
  "soft_skill",
  "domain",
  "keyword",
]);

export const ImportanceSchema = z.enum(["high", "medium", "low"]);
export const EvidenceConfidenceSchema = z.enum([
  "high",
  "medium",
  "weak",
  "missing",
]);
export const SourceTypeSchema = z.enum(["profile", "gap_answer", "manual"]);
export const ChunkTypeSchema = z.enum([
  "project",
  "skill",
  "certification",
  "education",
  "experience",
  "gap_answer",
  "achievement",
]);
export const ButtonAnswerSchema = z.enum(["yes", "kind_of", "no", "skip"]);

export const JobRequirementSchema = z.object({
  type: RequirementTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  importance: ImportanceSchema,
});

export const JobParserOutputSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullable(),
  seniority: z.string().nullable(),
  summary: z.string().min(1),
  requirements: z.array(JobRequirementSchema).min(1),
});

export const CandidateProjectSchema = z.object({
  name: z.string().nullable(),
  description: z.string().min(1),
  tools: z.array(z.string()),
  outcomes: z.array(z.string()),
});

export const CandidateExperienceSchema = z.object({
  role: z.string().nullable(),
  organization: z.string().nullable(),
  description: z.string().min(1),
  technologies: z.array(z.string()),
  outcomes: z.array(z.string()),
});

export const CandidateEducationSchema = z.object({
  institution: z.string().nullable(),
  credential: z.string().nullable(),
  details: z.string().nullable(),
});

export const CandidateCertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable(),
  details: z.string().nullable(),
});

export const CandidateProfilerOutputSchema = z.object({
  summary: z.string().min(1),
  skills: z.array(z.string()),
  projects: z.array(CandidateProjectSchema),
  experience: z.array(CandidateExperienceSchema),
  education: z.array(CandidateEducationSchema),
  certifications: z.array(CandidateCertificationSchema),
  tools: z.array(z.string()),
  achievements: z.array(z.string()),
});

export const EvidenceChunkSchema = z.object({
  chunkType: ChunkTypeSchema,
  content: z.string().min(1),
  tags: z.array(z.string()),
  sourceType: SourceTypeSchema,
  sourceId: z.string().nullable(),
});

export const EvidenceChunkCreatorOutputSchema = z.object({
  chunks: z.array(EvidenceChunkSchema),
});

export const EvidenceScoringMatchSchema = z.object({
  jobRequirementId: z.string().min(1),
  candidateChunkId: z.string().nullable(),
  confidence: EvidenceConfidenceSchema,
  reason: z.string().min(1),
});

export const EvidenceScoringOutputSchema = z.object({
  matches: z.array(EvidenceScoringMatchSchema),
});

export const GapQuestionSchema = z.object({
  targetRequirementId: z.string().nullable(),
  question: z.string().min(1),
  reason: z.string().min(1),
});

export const GapQuestionOutputSchema = z.object({
  questions: z.array(GapQuestionSchema).max(5),
});

export const CvStrategyOutputSchema = z.object({
  strategySummary: z.string().min(1),
  targetPositioning: z.string().min(1),
  sectionOrder: z.array(z.string()).min(1),
  emphasis: z.array(z.string()),
  deEmphasis: z.array(z.string()),
  evidenceToUse: z.array(
    z.object({
      requirementId: z.string().nullable(),
      chunkIds: z.array(z.string()),
      note: z.string().min(1),
    })
  ),
  warnings: z.array(z.string()),
});

export const CvJsonSchema = z.object({
  header: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  projects: z.array(z.string()),
  experience: z.array(z.string()),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
});

export const CvWriterOutputSchema = z.object({
  cvJson: CvJsonSchema,
  cvText: z.string().min(1),
});

export const CvRewriteOutputSchema = z.object({
  updatedSection: z.string().min(1),
});

export const AgentJsonSchemas = {
  jobParser: {
    type: "object",
    additionalProperties: false,
    required: ["title", "company", "seniority", "summary", "requirements"],
    properties: {
      title: { type: "string" },
      company: { type: ["string", "null"] },
      seniority: { type: ["string", "null"] },
      summary: { type: "string" },
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "label", "description", "importance"],
          properties: {
            type: {
              type: "string",
              enum: [
                "skill",
                "tool",
                "responsibility",
                "soft_skill",
                "domain",
                "keyword",
              ],
            },
            label: { type: "string" },
            description: { type: "string" },
            importance: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
          },
        },
      },
    },
  },
  candidateProfiler: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "skills",
      "projects",
      "experience",
      "education",
      "certifications",
      "tools",
      "achievements",
    ],
    properties: {
      summary: { type: "string" },
      skills: { type: "array", items: { type: "string" } },
      projects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "tools", "outcomes"],
          properties: {
            name: { type: ["string", "null"] },
            description: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            outcomes: { type: "array", items: { type: "string" } },
          },
        },
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "organization",
            "description",
            "technologies",
            "outcomes",
          ],
          properties: {
            role: { type: ["string", "null"] },
            organization: { type: ["string", "null"] },
            description: { type: "string" },
            technologies: { type: "array", items: { type: "string" } },
            outcomes: { type: "array", items: { type: "string" } },
          },
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["institution", "credential", "details"],
          properties: {
            institution: { type: ["string", "null"] },
            credential: { type: ["string", "null"] },
            details: { type: ["string", "null"] },
          },
        },
      },
      certifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "issuer", "details"],
          properties: {
            name: { type: "string" },
            issuer: { type: ["string", "null"] },
            details: { type: ["string", "null"] },
          },
        },
      },
      tools: { type: "array", items: { type: "string" } },
      achievements: { type: "array", items: { type: "string" } },
    },
  },
  evidenceChunkCreator: {
    type: "object",
    additionalProperties: false,
    required: ["chunks"],
    properties: {
      chunks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["chunkType", "content", "tags", "sourceType", "sourceId"],
          properties: {
            chunkType: {
              type: "string",
              enum: [
                "project",
                "skill",
                "certification",
                "education",
                "experience",
                "gap_answer",
                "achievement",
              ],
            },
            content: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            sourceType: {
              type: "string",
              enum: ["profile", "gap_answer", "manual"],
            },
            sourceId: { type: ["string", "null"] },
          },
        },
      },
    },
  },
  evidenceScoring: {
    type: "object",
    additionalProperties: false,
    required: ["matches"],
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "jobRequirementId",
            "candidateChunkId",
            "confidence",
            "reason",
          ],
          properties: {
            jobRequirementId: { type: "string" },
            candidateChunkId: { type: ["string", "null"] },
            confidence: {
              type: "string",
              enum: ["high", "medium", "weak", "missing"],
            },
            reason: { type: "string" },
          },
        },
      },
    },
  },
  gapQuestion: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["targetRequirementId", "question", "reason"],
          properties: {
            targetRequirementId: { type: ["string", "null"] },
            question: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
  cvStrategy: {
    type: "object",
    additionalProperties: false,
    required: [
      "strategySummary",
      "targetPositioning",
      "sectionOrder",
      "emphasis",
      "deEmphasis",
      "evidenceToUse",
      "warnings",
    ],
    properties: {
      strategySummary: { type: "string" },
      targetPositioning: { type: "string" },
      sectionOrder: { type: "array", items: { type: "string" } },
      emphasis: { type: "array", items: { type: "string" } },
      deEmphasis: { type: "array", items: { type: "string" } },
      evidenceToUse: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["requirementId", "chunkIds", "note"],
          properties: {
            requirementId: { type: ["string", "null"] },
            chunkIds: { type: "array", items: { type: "string" } },
            note: { type: "string" },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
  cvWriter: {
    type: "object",
    additionalProperties: false,
    required: ["cvJson", "cvText"],
    properties: {
      cvJson: {
        type: "object",
        additionalProperties: false,
        required: [
          "header",
          "summary",
          "skills",
          "projects",
          "experience",
          "education",
          "certifications",
        ],
        properties: {
          header: { type: "string" },
          summary: { type: "string" },
          skills: { type: "array", items: { type: "string" } },
          projects: { type: "array", items: { type: "string" } },
          experience: { type: "array", items: { type: "string" } },
          education: { type: "array", items: { type: "string" } },
          certifications: { type: "array", items: { type: "string" } },
        },
      },
      cvText: { type: "string" },
    },
  },
  cvRewrite: {
    type: "object",
    additionalProperties: false,
    required: ["updatedSection"],
    properties: {
      updatedSection: { type: "string" },
    },
  },
} as const;
