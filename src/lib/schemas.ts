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
  cvLayoutArchitectures,
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
  "low",
  "missing",
]);
export const SourceTypeSchema = z.enum([
  "profile",
  "cv_upload",
  "linkedin",
  "background",
  "gap_answer",
  "manual",
]);
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
export const RoleFamilySchema = z.enum([
  "software_ai_data",
  "business_operations",
  "education",
  "retail_hospitality",
  "trades",
  "healthcare_care",
  "finance_compliance",
  "sales_marketing",
  "admin_support",
  "legal_professional",
  "executive_leadership",
  "general_entry_level",
  "general",
]);
export const ProofStyleSchema = z.enum([
  "metrics",
  "scope",
  "responsibility",
  "standards",
  "technical_depth",
  "customer_impact",
  "teaching_impact",
  "safety",
  "reliability",
  "leadership",
  "compliance",
  "communication",
]);
export const SectionBudgetTreatmentSchema = z.enum([
  "full",
  "compressed",
  "one_line",
  "omit",
]);
export const LayoutArchitectureSchema = z.enum(cvLayoutArchitectures);
export const EvidenceCardUsefulnessSchema = z.enum([
  "cv_ready",
  "supporting",
  "keyword_only",
  "caution",
]);
export const EvidenceMatchCvUsefulnessSchema = z.enum([
  "headline",
  "supporting",
  "keyword_only",
  "do_not_use",
]);
export const ClaimRiskSchema = z.enum([
  "safe",
  "careful_wording",
  "avoid_claim",
]);
export const QualitySeveritySchema = z.enum([
  "pass",
  "minor",
  "major",
  "critical",
]);
export const CvSectionIdSchema = z.enum([
  "summary",
  "projects",
  "experience",
  "skills",
  "education",
  "certifications",
]);

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
  roleDomain: z.string().nullable().optional(),
  archetypeHint: z.string().nullable().optional(),
  requirements: z.array(JobRequirementSchema).min(1),
});

export const CandidateContactInfoSchema = z.object({
  fullName: z.string().nullable(),
  professionalTitle: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

export const CandidateLinksSchema = z.object({
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  portfolio: z.string().nullable(),
  other: z.array(
    z.object({
      label: z.string().nullable(),
      url: z.string().min(1),
    })
  ),
});

export const CandidateProjectSchema = z.object({
  name: z.string().nullable(),
  description: z.string().min(1),
  tools: z.array(z.string()),
  outcomes: z.array(z.string()),
  links: z.array(z.string()),
});

export const CandidateExperienceSchema = z.object({
  role: z.string().nullable(),
  organization: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  current: z.boolean(),
  description: z.string().min(1),
  bullets: z.array(z.string()),
  technologies: z.array(z.string()),
  tools: z.array(z.string()),
  achievements: z.array(z.string()),
  outcomes: z.array(z.string()),
});

export const CandidateEducationSchema = z.object({
  institution: z.string().nullable(),
  credential: z.string().nullable(),
  degree: z.string().nullable(),
  startYear: z.string().nullable(),
  endYear: z.string().nullable(),
  current: z.boolean(),
  expected: z.boolean(),
  details: z.string().nullable(),
  coursework: z.array(z.string()),
  notes: z.string().nullable(),
});

export const CandidateCertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable(),
  date: z.string().nullable(),
  status: z.string().nullable(),
  details: z.string().nullable(),
});

export const CandidateProfilerAgentContactInfoSchema = z.object({
  fullName: z.string().nullable(),
  professionalTitle: z.string().nullable(),
  location: z.string().nullable(),
});

export const CandidateProfilerAgentOutputSchema = z.object({
  contactInfo: CandidateProfilerAgentContactInfoSchema,
  summary: z.string().min(1),
  skills: z.array(z.string()),
  projects: z.array(CandidateProjectSchema),
  experience: z.array(CandidateExperienceSchema),
  education: z.array(CandidateEducationSchema),
  certifications: z.array(CandidateCertificationSchema),
  tools: z.array(z.string()),
  achievements: z.array(z.string()),
  cautionNotes: z.array(z.string()),
});

export const CandidateProfilerOutputSchema = z.object({
  contactInfo: CandidateContactInfoSchema,
  links: CandidateLinksSchema,
  sourceSummary: z.string().nullable(),
  summary: z.string().min(1),
  skills: z.array(z.string()),
  projects: z.array(CandidateProjectSchema),
  experience: z.array(CandidateExperienceSchema),
  education: z.array(CandidateEducationSchema),
  certifications: z.array(CandidateCertificationSchema),
  tools: z.array(z.string()),
  achievements: z.array(z.string()),
  cautionNotes: z.array(z.string()),
  metricOpportunities: z.array(z.string()),
  strongProofCandidates: z.array(z.string()),
  scopeOpportunities: z.array(z.string()),
  likelyTopEvidence: z.array(z.string()),
});

export const GapQuestionAgentQuestionSchema = z.object({
  targetRequirementId: z.string().nullable(),
  question: z.string().min(1).max(180),
  reason: z.string().min(1).max(180),
  whyItMatters: z.string().min(1).max(180),
  answerGuidance: z.string().min(1).max(220),
  exampleAnswer: z.string().min(1).max(260),
  exampleAngles: z.array(z.string().min(1).max(90)).max(4),
});

export const GapQuestionAgentOutputSchema = z.object({
  questions: z.array(GapQuestionAgentQuestionSchema).max(3),
});

export const GapAnswerMessageTypeSchema = z.enum([
  "clarification_request",
  "answer",
  "vague_answer",
  "off_topic",
  "unsafe_or_unusable",
]);

export const GapAnswerUsableStatusSchema = z.enum([
  "usable",
  "use_carefully",
  "not_usable",
]);

export const GapAnswerEvidenceQualitySchema = z.enum([
  "none",
  "weak",
  "usable",
  "strong",
]);

export const GapAnswerBoostBandSchema = z.enum([
  "none",
  "small",
  "medium",
  "large",
]);

export const GapAnswerEvaluatorOutputSchema = z.object({
  messageType: GapAnswerMessageTypeSchema,
  assistantReply: z.string().min(1).max(460),
  shouldSaveEvidence: z.boolean(),
  usableStatus: GapAnswerUsableStatusSchema,
  evidenceQuality: GapAnswerEvidenceQualitySchema,
  targetRequirementId: z.string().nullable(),
  extractedEvidenceSummary: z.string().nullable(),
  followUpQuestion: z.string().nullable(),
  shouldMoveToNextQuestion: z.boolean(),
  boostBand: GapAnswerBoostBandSchema,
  suggestedBoostPercent: z.number().int().min(0).max(15),
  reason: z.string().min(1).max(260),
});

export const BatchRequirementFitSchema = z.object({
  confidence: EvidenceConfidenceSchema,
  selectedEvidenceIndex: z.number().int().nonnegative().nullable(),
  reason: z.string().min(1).max(140),
  claimRisk: ClaimRiskSchema,
  cvUsefulness: EvidenceMatchCvUsefulnessSchema,
});

export const BatchEvidenceFitOutputSchema = z.object({
  requirementFitByRequirementId: z.record(BatchRequirementFitSchema),
});

export const EvidenceScoringMatchSchema = z.object({
  jobRequirementId: z.string().min(1),
  candidateChunkId: z.string().nullable(),
  confidence: EvidenceConfidenceSchema,
  cvUsefulness: EvidenceMatchCvUsefulnessSchema,
  claimRisk: ClaimRiskSchema,
  reason: z.string().min(1),
});

export const EvidenceScoringOutputSchema = z.object({
  matches: z.array(EvidenceScoringMatchSchema),
});

export const CvStrategyOutputSchema = z.object({
  strategySummary: z.string().min(1),
  targetPositioning: z.string().min(1),
  roleFamily: RoleFamilySchema,
  topRoleSignals: z.array(z.string().min(1)),
  candidateProofForTopSignals: z.array(
    z.object({
      signal: z.string().min(1),
      proof: z.string().min(1),
      requirementId: z.string().nullable(),
      chunkIds: z.array(z.string()),
    })
  ),
  proofStyle: ProofStyleSchema,
  summaryDirection: z.string().min(1),
  layoutArchitecture: LayoutArchitectureSchema,
  topTenSecondProof: z.array(z.string().min(1)),
  sectionOrder: z.array(CvSectionIdSchema).min(1),
  sectionBudgets: z.object({
    summary: SectionBudgetTreatmentSchema,
    projects: SectionBudgetTreatmentSchema,
    experience: SectionBudgetTreatmentSchema,
    skills: SectionBudgetTreatmentSchema,
    education: SectionBudgetTreatmentSchema,
    certifications: SectionBudgetTreatmentSchema,
  }),
  leadWith: z.array(z.string().min(1)),
  mustUseEvidence: z.array(
    z.object({
      requirementId: z.string().nullable(),
      chunkIds: z.array(z.string()),
      note: z.string().min(1),
    })
  ),
  compressOrCut: z.array(z.string().min(1)),
  claimBoundaries: z.array(z.string().min(1)),
  missingMetricsToAsk: z.array(z.string().min(1)),
  skillsPlan: z.object({
    keepGroups: z.array(z.string().min(1)),
    cutSkills: z.array(z.string().min(1)),
    presentation: z.string().min(1),
  }),
  certificationPlan: z.object({
    treatment: SectionBudgetTreatmentSchema,
    rationale: z.string().min(1),
  }),
  writerStyleRules: z.array(z.string().min(1)),
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

export const CvBulletClaimSchema = z.object({
  text: z.string().min(1),
  sourceChunkIds: z.array(z.string().min(1)).default([]),
  gapAnswerIds: z.array(z.string().min(1)).default([]),
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
  group: z.string().min(1),
  skills: z.array(z.string().min(1)),
});

export const CvExperienceItemSchema = z.object({
  role: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  dates: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  bullets: z.array(CvBulletClaimSchema),
});

export const CvProjectItemSchema = z.object({
  name: z.string().nullable(),
  descriptor: z.string().nullable(),
  dates: z.string().nullable(),
  bullets: z.array(CvBulletClaimSchema),
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

export const CvDynamicExperienceItemSchema = z.object({
  role: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable().optional(),
  dates: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  bullets: z.array(CvBulletClaimSchema),
});

export const CvDynamicSkillsItemSchema = z.object({
  group: z.string().min(1),
  skills: z.array(z.string().min(1)),
});

const DynamicCvSectionBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  priority: z.enum(["primary", "secondary", "supporting"]),
});

export const DynamicCvSectionSchema = z.discriminatedUnion("type", [
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("summary"),
    items: z.array(CvBulletClaimSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("inline"),
    items: z.array(CvBulletClaimSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("bullets"),
    items: z.array(CvBulletClaimSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("certifications"),
    items: z.array(CvBulletClaimSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("experience"),
    items: z.array(CvDynamicExperienceItemSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("projects"),
    items: z.array(CvProjectItemSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("skills"),
    items: z.array(CvDynamicSkillsItemSchema),
  }),
  DynamicCvSectionBaseSchema.extend({
    type: z.literal("education"),
    items: z.array(CvEducationItemSchema),
  }),
]);

export const DynamicCvJsonSchema = CvJsonSchema.extend({
  sections: z.array(DynamicCvSectionSchema),
  roleArchetype: z.string().nullable().optional(),
});

export const CvWriterOutputSchema = z.object({
  cvJson: CvJsonSchema,
  cvText: z.string().min(1),
  assumptions: z.array(z.string()),
  improvementSuggestions: z.array(z.string()),
});

export const CvBuilderOutputSchema = z.object({
  roleArchetype: z.string().min(1),
  targetPositioning: z.string().min(1),
  cvAngle: z.string().min(1),
  sectionPlan: z.array(z.string().min(1)),
  evidenceAllocation: z.array(
    z.object({
      sectionId: z.string().min(1),
      evidence: z.array(z.string().min(1)),
      rationale: z.string().min(1),
    })
  ),
  claimBoundaries: z.array(z.string().min(1)),
  strongestEvidenceUsed: z.array(z.string().min(1)),
  stillLimited: z.array(z.string().min(1)),
  beforeScoreRecommendation: z.number().int().min(0).max(100),
  afterScoreRecommendation: z.number().int().min(0).max(100),
  cvJson: DynamicCvJsonSchema,
  cvText: z.string().min(1),
  assumptions: z.array(z.string()),
});

export const CvQualityReviewOutputSchema = z.object({
  passed: z.boolean(),
  severity: QualitySeveritySchema,
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
  layoutArchitecture: LayoutArchitectureSchema,
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
    required: [
      "title",
      "company",
      "seniority",
      "summary",
      "roleDomain",
      "archetypeHint",
      "requirements",
    ],
    properties: {
      title: { type: "string" },
      company: { type: ["string", "null"] },
      seniority: { type: ["string", "null"] },
      summary: { type: "string" },
      roleDomain: { type: ["string", "null"] },
      archetypeHint: { type: ["string", "null"] },
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
      "contactInfo",
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
    properties: {
      contactInfo: {
        type: "object",
        additionalProperties: false,
        required: [
          "fullName",
          "professionalTitle",
          "location",
        ],
        properties: {
          fullName: { type: ["string", "null"], maxLength: 100 },
          professionalTitle: { type: ["string", "null"], maxLength: 120 },
          location: { type: ["string", "null"], maxLength: 120 },
        },
      },
      summary: { type: "string", maxLength: 360 },
      skills: { type: "array", maxItems: 32, items: { type: "string", maxLength: 80 } },
      projects: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "tools", "outcomes", "links"],
          properties: {
            name: { type: ["string", "null"], maxLength: 120 },
            description: { type: "string", maxLength: 320 },
            tools: { type: "array", maxItems: 12, items: { type: "string", maxLength: 80 } },
            outcomes: { type: "array", maxItems: 4, items: { type: "string", maxLength: 160 } },
            links: { type: "array", maxItems: 4, items: { type: "string", maxLength: 240 } },
          },
        },
      },
      experience: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "organization",
            "startDate",
            "endDate",
            "current",
            "description",
            "bullets",
            "technologies",
            "tools",
            "achievements",
            "outcomes",
          ],
          properties: {
            role: { type: ["string", "null"], maxLength: 120 },
            organization: { type: ["string", "null"], maxLength: 140 },
            startDate: { type: ["string", "null"], maxLength: 40 },
            endDate: { type: ["string", "null"], maxLength: 40 },
            current: { type: "boolean" },
            description: { type: "string", maxLength: 320 },
            bullets: { type: "array", maxItems: 6, items: { type: "string", maxLength: 180 } },
            technologies: { type: "array", maxItems: 14, items: { type: "string", maxLength: 80 } },
            tools: { type: "array", maxItems: 14, items: { type: "string", maxLength: 80 } },
            achievements: { type: "array", maxItems: 5, items: { type: "string", maxLength: 160 } },
            outcomes: { type: "array", maxItems: 5, items: { type: "string", maxLength: 160 } },
          },
        },
      },
      education: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "institution",
            "credential",
            "degree",
            "startYear",
            "endYear",
            "current",
            "expected",
            "details",
            "coursework",
            "notes",
          ],
          properties: {
            institution: { type: ["string", "null"], maxLength: 140 },
            credential: { type: ["string", "null"], maxLength: 140 },
            degree: { type: ["string", "null"], maxLength: 140 },
            startYear: { type: ["string", "null"], maxLength: 20 },
            endYear: { type: ["string", "null"], maxLength: 20 },
            current: { type: "boolean" },
            expected: { type: "boolean" },
            details: { type: ["string", "null"], maxLength: 220 },
            coursework: { type: "array", maxItems: 12, items: { type: "string", maxLength: 80 } },
            notes: { type: ["string", "null"], maxLength: 180 },
          },
        },
      },
      certifications: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "issuer", "date", "status", "details"],
          properties: {
            name: { type: "string", maxLength: 160 },
            issuer: { type: ["string", "null"], maxLength: 140 },
            date: { type: ["string", "null"], maxLength: 40 },
            status: { type: ["string", "null"], maxLength: 80 },
            details: { type: ["string", "null"], maxLength: 220 },
          },
        },
      },
      tools: { type: "array", maxItems: 32, items: { type: "string", maxLength: 80 } },
      achievements: { type: "array", maxItems: 16, items: { type: "string", maxLength: 160 } },
      cautionNotes: { type: "array", maxItems: 6, items: { type: "string", maxLength: 160 } },
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
            "cvUsefulness",
            "claimRisk",
            "reason",
          ],
          properties: {
            jobRequirementId: { type: "string" },
            candidateChunkId: { type: ["string", "null"] },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low", "missing"],
            },
            cvUsefulness: {
              type: "string",
              enum: ["headline", "supporting", "keyword_only", "do_not_use"],
            },
            claimRisk: {
              type: "string",
              enum: ["safe", "careful_wording", "avoid_claim"],
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
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "targetRequirementId",
            "question",
            "reason",
            "whyItMatters",
            "answerGuidance",
            "exampleAnswer",
            "exampleAngles",
          ],
          properties: {
            targetRequirementId: { type: "string" },
            question: { type: "string", maxLength: 180 },
            reason: { type: "string", maxLength: 180 },
            whyItMatters: { type: "string", maxLength: 180 },
            answerGuidance: { type: "string", maxLength: 220 },
            exampleAnswer: { type: "string", maxLength: 260 },
            exampleAngles: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 90 },
            },
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
      "roleFamily",
      "topRoleSignals",
      "candidateProofForTopSignals",
      "proofStyle",
      "summaryDirection",
      "layoutArchitecture",
      "topTenSecondProof",
      "sectionOrder",
      "sectionBudgets",
      "leadWith",
      "mustUseEvidence",
      "compressOrCut",
      "claimBoundaries",
      "missingMetricsToAsk",
      "skillsPlan",
      "certificationPlan",
      "writerStyleRules",
      "emphasis",
      "deEmphasis",
      "evidenceToUse",
      "warnings",
    ],
    properties: {
      strategySummary: { type: "string" },
      targetPositioning: { type: "string" },
      roleFamily: {
        type: "string",
        enum: [
          "software_ai_data",
          "business_operations",
          "education",
          "retail_hospitality",
          "trades",
          "healthcare_care",
          "finance_compliance",
          "sales_marketing",
          "admin_support",
          "legal_professional",
          "executive_leadership",
          "general_entry_level",
          "general",
        ],
      },
      topRoleSignals: { type: "array", items: { type: "string" } },
      candidateProofForTopSignals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["signal", "proof", "requirementId", "chunkIds"],
          properties: {
            signal: { type: "string" },
            proof: { type: "string" },
            requirementId: { type: ["string", "null"] },
            chunkIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      proofStyle: {
        type: "string",
        enum: [
          "metrics",
          "scope",
          "responsibility",
          "standards",
          "technical_depth",
          "customer_impact",
          "teaching_impact",
          "safety",
          "reliability",
          "leadership",
          "compliance",
          "communication",
        ],
      },
      summaryDirection: { type: "string" },
      layoutArchitecture: {
        type: "string",
        enum: [
          "premium_hybrid",
          "classic_single_column",
          "simple_practical",
        ],
      },
      topTenSecondProof: { type: "array", items: { type: "string" } },
      sectionOrder: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "summary",
            "projects",
            "experience",
            "skills",
            "education",
            "certifications",
          ],
        },
      },
      sectionBudgets: {
        type: "object",
        additionalProperties: false,
        required: [
          "summary",
          "projects",
          "experience",
          "skills",
          "education",
          "certifications",
        ],
        properties: {
          summary: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          projects: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          experience: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          skills: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          education: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          certifications: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
        },
      },
      leadWith: { type: "array", items: { type: "string" } },
      mustUseEvidence: {
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
      compressOrCut: { type: "array", items: { type: "string" } },
      claimBoundaries: { type: "array", items: { type: "string" } },
      missingMetricsToAsk: { type: "array", items: { type: "string" } },
      skillsPlan: {
        type: "object",
        additionalProperties: false,
        required: ["keepGroups", "cutSkills", "presentation"],
        properties: {
          keepGroups: { type: "array", items: { type: "string" } },
          cutSkills: { type: "array", items: { type: "string" } },
          presentation: { type: "string" },
        },
      },
      certificationPlan: {
        type: "object",
        additionalProperties: false,
        required: ["treatment", "rationale"],
        properties: {
          treatment: {
            type: "string",
            enum: ["full", "compressed", "one_line", "omit"],
          },
          rationale: { type: "string" },
        },
      },
      writerStyleRules: { type: "array", items: { type: "string" } },
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
    required: ["passed", "severity", "issues", "revisionInstructions"],
    properties: {
      passed: { type: "boolean" },
      severity: {
        type: "string",
        enum: ["pass", "minor", "major", "critical"],
      },
      issues: { type: "array", items: { type: "string" } },
      revisionInstructions: { type: "string" },
    },
  },
  cvLayoutStyle: {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "layoutArchitecture",
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
      layoutArchitecture: {
        type: "string",
        enum: [
          "premium_hybrid",
          "classic_single_column",
          "simple_practical",
        ],
      },
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
