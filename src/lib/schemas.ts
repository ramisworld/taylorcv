import { z } from "zod";

import {
  canonicalPresentationSectionIds,
  cvAccentPalettes,
  cvAccentUsageTargets,
  cvBodySizes,
  cvCareerStyles,
  cvDensityTokens,
  cvDividerStyles,
  cvFontPairings,
  cvHeaderStyles,
  cvHeadingWeights,
  cvNameSizes,
  cvPageTargets,
  cvSectionContentStyles,
  cvSectionPriorities,
  cvSectionSpacings,
  cvSectionTreatments,
  cvSectionWidths,
  cvSkillsStyles,
  cvSubtitleStyles,
  cvTemplateIds,
} from "./cvPresentation.ts";

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
  whyItMatters: z.string().min(1),
  answerGuidance: z.string().min(1),
  exampleAngles: z.array(z.string().min(1)),
});

export const GapQuestionOutputSchema = z.object({
  coachInsight: z.object({
    openingMessage: z.string().min(1),
    jobWants: z.string().min(1),
    candidateStrengths: z.array(z.string().min(1)),
    candidateConcerns: z.array(z.string().min(1)),
  }),
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

export const CvLinkSchema = z.object({
  label: z.string().nullable(),
  url: z.string().min(1),
});

export const CvHeaderSchema = z.object({
  name: z.string().nullable(),
  targetTitle: z.string().nullable(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  links: z.array(CvLinkSchema),
});

export const CvSkillGroupSchema = z.object({
  label: z.string().min(1),
  items: z.array(z.string().min(1)),
});

export const CvExperienceItemSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  dates: z.string().nullable(),
  location: z.string().nullable(),
  bullets: z.array(z.string().min(1)),
});

export const CvProjectItemSchema = z.object({
  name: z.string().nullable(),
  descriptor: z.string().nullable(),
  dates: z.string().nullable(),
  bullets: z.array(z.string().min(1)),
});

export const CvEducationItemSchema = z.object({
  institution: z.string().nullable(),
  degree: z.string().nullable(),
  dates: z.string().nullable(),
  details: z.array(z.string().min(1)),
});

export const CvJsonSchema = z.object({
  sectionOrder: z.array(z.string().min(1)),
  header: CvHeaderSchema,
  summary: z.string().min(1),
  skills: z.object({
    groups: z.array(CvSkillGroupSchema),
  }),
  experience: z.array(CvExperienceItemSchema),
  projects: z.array(CvProjectItemSchema),
  education: z.array(CvEducationItemSchema),
  certifications: z.array(z.string().min(1)),
});

export const CvWriterOutputSchema = z.object({
  cvJson: CvJsonSchema,
  cvText: z.string().min(1),
  assumptions: z.array(z.string()),
  improvementSuggestions: z.array(z.string()),
});

export const CvQualityReviewOutputSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
  revisionInstructions: z.string(),
});

const SafeSectionLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[^<>{}#[\];=]+$/)
  .nullable();

export const CvSectionPresentationSchema = z.object({
  treatment: z.enum(cvSectionTreatments),
  priority: z.enum(cvSectionPriorities),
  divider: z.boolean(),
  spacingBefore: z.enum(cvSectionSpacings),
  spacingAfter: z.enum(cvSectionSpacings),
  width: z.enum(cvSectionWidths),
  contentStyle: z.enum(cvSectionContentStyles),
});

export const CvLayoutStyleOutputSchema = z.object({
  schemaVersion: z.literal(1),
  templateId: z.enum(cvTemplateIds),
  careerStyle: z.enum(cvCareerStyles),
  density: z.enum(cvDensityTokens),
  pageTarget: z.enum(cvPageTargets),
  typography: z.object({
    fontPairing: z.enum(cvFontPairings),
    nameSize: z.enum(cvNameSizes),
    subtitleStyle: z.enum(cvSubtitleStyles),
    bodySize: z.enum(cvBodySizes),
    headingWeight: z.enum(cvHeadingWeights),
  }),
  colourSystem: z.object({
    accentPalette: z.enum(cvAccentPalettes),
    bodyText: z.literal("dark"),
    mutedText: z.literal("grey"),
    dividerStyle: z.enum(cvDividerStyles),
  }),
  accentUsageRules: z.object({
    useAccentFor: z.array(z.enum(cvAccentUsageTargets)),
    neverUseAccentForBodyText: z.literal(true),
    bodyTextMustRemain: z.literal("dark"),
    metadataTextMustRemain: z.literal("grey"),
  }),
  headerStyle: z.enum(cvHeaderStyles),
  skillsStyle: z.enum(cvSkillsStyles),
  sectionStyles: z.object(
    Object.fromEntries(
      canonicalPresentationSectionIds.map((section) => [
        section,
        CvSectionPresentationSchema.nullable(),
      ])
    ) as Record<
      (typeof canonicalPresentationSectionIds)[number],
      z.ZodNullable<typeof CvSectionPresentationSchema>
    >
  ),
  sectionLabelOverrides: z.object(
    Object.fromEntries(
      canonicalPresentationSectionIds.map((section) => [
        section,
        SafeSectionLabelSchema,
      ])
    ) as Record<
      (typeof canonicalPresentationSectionIds)[number],
      typeof SafeSectionLabelSchema
    >
  ),
  renderWarnings: z.array(z.string().max(220)),
  rationale: z.string().min(1).max(700),
});

export const CvRewriteOutputSchema = z.object({
  updatedSection: z.string().min(1),
});

const cvSectionPresentationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "treatment",
    "priority",
    "divider",
    "spacingBefore",
    "spacingAfter",
    "width",
    "contentStyle",
  ],
  properties: {
    treatment: { type: "string", enum: cvSectionTreatments },
    priority: { type: "string", enum: cvSectionPriorities },
    divider: { type: "boolean" },
    spacingBefore: { type: "string", enum: cvSectionSpacings },
    spacingAfter: { type: "string", enum: cvSectionSpacings },
    width: { type: "string", enum: cvSectionWidths },
    contentStyle: { type: "string", enum: cvSectionContentStyles },
  },
} as const;

const cvSectionStyleProperties = Object.fromEntries(
  canonicalPresentationSectionIds.map((section) => [
    section,
    {
      anyOf: [cvSectionPresentationJsonSchema, { type: "null" }],
    },
  ])
);

const cvSectionLabelProperties = Object.fromEntries(
  canonicalPresentationSectionIds.map((section) => [
    section,
    {
      type: ["string", "null"],
      maxLength: 48,
      pattern: "^[^<>{}#[\\];=]+$",
    },
  ])
);

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
    required: ["coachInsight", "questions"],
    properties: {
      coachInsight: {
        type: "object",
        additionalProperties: false,
        required: [
          "openingMessage",
          "jobWants",
          "candidateStrengths",
          "candidateConcerns",
        ],
        properties: {
          openingMessage: { type: "string" },
          jobWants: { type: "string" },
          candidateStrengths: { type: "array", items: { type: "string" } },
          candidateConcerns: { type: "array", items: { type: "string" } },
        },
      },
      questions: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "targetRequirementId",
            "question",
            "reason",
            "whyItMatters",
            "answerGuidance",
            "exampleAngles",
          ],
          properties: {
            targetRequirementId: { type: ["string", "null"] },
            question: { type: "string" },
            reason: { type: "string" },
            whyItMatters: { type: "string" },
            answerGuidance: { type: "string" },
            exampleAngles: { type: "array", items: { type: "string" } },
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
    required: ["cvJson", "cvText", "assumptions", "improvementSuggestions"],
    properties: {
      cvJson: {
        type: "object",
        additionalProperties: false,
        required: [
          "sectionOrder",
          "header",
          "summary",
          "skills",
          "projects",
          "experience",
          "education",
          "certifications",
        ],
        properties: {
          sectionOrder: { type: "array", items: { type: "string" } },
          header: {
            type: "object",
            additionalProperties: false,
            required: [
              "name",
              "targetTitle",
              "location",
              "phone",
              "email",
              "links",
            ],
            properties: {
              name: { type: ["string", "null"] },
              targetTitle: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              links: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "url"],
                  properties: {
                    label: { type: ["string", "null"] },
                    url: { type: "string" },
                  },
                },
              },
            },
          },
          summary: { type: "string" },
          skills: {
            type: "object",
            additionalProperties: false,
            required: ["groups"],
            properties: {
              groups: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "items"],
                  properties: {
                    label: { type: "string" },
                    items: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          experience: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "company", "dates", "location", "bullets"],
              properties: {
                title: { type: ["string", "null"] },
                company: { type: ["string", "null"] },
                dates: { type: ["string", "null"] },
                location: { type: ["string", "null"] },
                bullets: { type: "array", items: { type: "string" } },
              },
            },
          },
          projects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "descriptor", "dates", "bullets"],
              properties: {
                name: { type: ["string", "null"] },
                descriptor: { type: ["string", "null"] },
                dates: { type: ["string", "null"] },
                bullets: { type: "array", items: { type: "string" } },
              },
            },
          },
          education: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["institution", "degree", "dates", "details"],
              properties: {
                institution: { type: ["string", "null"] },
                degree: { type: ["string", "null"] },
                dates: { type: ["string", "null"] },
                details: { type: "array", items: { type: "string" } },
              },
            },
          },
          certifications: { type: "array", items: { type: "string" } },
        },
      },
      cvText: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      improvementSuggestions: { type: "array", items: { type: "string" } },
    },
  },
  cvQualityReview: {
    type: "object",
    additionalProperties: false,
    required: ["passed", "issues", "revisionInstructions"],
    properties: {
      passed: { type: "boolean" },
      issues: { type: "array", items: { type: "string" } },
      revisionInstructions: { type: "string" },
    },
  },
  cvLayoutStyle: {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "templateId",
      "careerStyle",
      "density",
      "pageTarget",
      "typography",
      "colourSystem",
      "accentUsageRules",
      "headerStyle",
      "skillsStyle",
      "sectionStyles",
      "sectionLabelOverrides",
      "renderWarnings",
      "rationale",
    ],
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      templateId: { type: "string", enum: cvTemplateIds },
      careerStyle: { type: "string", enum: cvCareerStyles },
      density: { type: "string", enum: cvDensityTokens },
      pageTarget: { type: "string", enum: cvPageTargets },
      typography: {
        type: "object",
        additionalProperties: false,
        required: [
          "fontPairing",
          "nameSize",
          "subtitleStyle",
          "bodySize",
          "headingWeight",
        ],
        properties: {
          fontPairing: { type: "string", enum: cvFontPairings },
          nameSize: { type: "string", enum: cvNameSizes },
          subtitleStyle: { type: "string", enum: cvSubtitleStyles },
          bodySize: { type: "string", enum: cvBodySizes },
          headingWeight: { type: "string", enum: cvHeadingWeights },
        },
      },
      colourSystem: {
        type: "object",
        additionalProperties: false,
        required: ["accentPalette", "bodyText", "mutedText", "dividerStyle"],
        properties: {
          accentPalette: { type: "string", enum: cvAccentPalettes },
          bodyText: { type: "string", enum: ["dark"] },
          mutedText: { type: "string", enum: ["grey"] },
          dividerStyle: { type: "string", enum: cvDividerStyles },
        },
      },
      accentUsageRules: {
        type: "object",
        additionalProperties: false,
        required: [
          "useAccentFor",
          "neverUseAccentForBodyText",
          "bodyTextMustRemain",
          "metadataTextMustRemain",
        ],
        properties: {
          useAccentFor: {
            type: "array",
            items: { type: "string", enum: cvAccentUsageTargets },
          },
          neverUseAccentForBodyText: { type: "boolean", enum: [true] },
          bodyTextMustRemain: { type: "string", enum: ["dark"] },
          metadataTextMustRemain: { type: "string", enum: ["grey"] },
        },
      },
      headerStyle: { type: "string", enum: cvHeaderStyles },
      skillsStyle: { type: "string", enum: cvSkillsStyles },
      sectionStyles: {
        type: "object",
        additionalProperties: false,
        required: canonicalPresentationSectionIds,
        properties: cvSectionStyleProperties,
      },
      sectionLabelOverrides: {
        type: "object",
        additionalProperties: false,
        required: canonicalPresentationSectionIds,
        properties: cvSectionLabelProperties,
      },
      renderWarnings: {
        type: "array",
        items: { type: "string", maxLength: 220 },
      },
      rationale: { type: "string", maxLength: 700 },
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
