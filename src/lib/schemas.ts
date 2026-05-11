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
export const GapQuestionTypeSchema = z.enum([
  "missing_requirement",
  "metric_enrichment",
  "scope_enrichment",
  "domain_specific_proof",
  "capability_check",
  "tool_check",
  "metric_or_scope",
  "ownership",
  "outcome_or_impact",
  "responsibility",
  "collaboration",
  "safety_or_quality",
  "domain_specific",
]);
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

export const BatchEvidenceFitQuestionSchema = z.object({
  targetRequirementId: z.string().nullable(),
  question: z.string().min(1),
  shortQuestion: z.string().min(1),
  linkedJobRequirement: z.string().nullable(),
  whyThisMatters: z.string().min(1),
  howYourAnswerHelps: z.string().min(1),
  quickOptions: z.array(z.string().min(1)).min(2).max(4),
  selectedOptionRequiresDetail: z.boolean(),
  followUpPrompt: z.string().nullable(),
  dynamicGuidance: z.string().min(1),
  questionType: GapQuestionTypeSchema,
});

export const BatchRequirementFitSchema = z.object({
  requirementId: z.string().min(1),
  confidence: EvidenceConfidenceSchema,
  bestCandidateChunkId: z.string().nullable(),
  reason: z.string().min(1),
  claimRisk: ClaimRiskSchema,
  cvUsefulness: EvidenceMatchCvUsefulnessSchema,
});

export const BatchEvidenceFitOutputSchema = z.object({
  currentMatchScore: z.number().int().min(0).max(100),
  matchLabel: z.string().min(1),
  topStrengths: z.array(z.string().min(1)),
  weakSpots: z.array(z.string().min(1)),
  evidenceCards: z.array(
    z.object({
      requirementId: z.string().nullable(),
      requirementLabel: z.string().min(1),
      candidateChunkId: z.string().nullable(),
      content: z.string().min(1),
      confidence: EvidenceConfidenceSchema,
      reason: z.string().min(1),
      claimRisk: ClaimRiskSchema,
    })
  ),
  requirementFitSummary: z.array(BatchRequirementFitSchema),
  claimRisks: z.array(z.string().min(1)),
  recommendedGapQuestions: z.array(BatchEvidenceFitQuestionSchema).max(4),
  cvAngle: z.string().min(1),
  roleArchetype: z.string().min(1),
});

export const EvidenceChunkMetadataSchema = z.object({
  action: z.string().nullable(),
  context: z.string().nullable(),
  toolsOrMethods: z.array(z.string()),
  ownership: z.string().nullable(),
  outcome: z.string().nullable(),
  metric: z.string().nullable(),
  scope: z.string().nullable(),
  source: z.string().nullable(),
  targetRequirementId: z.string().nullable(),
  targetRequirementLabel: z.string().nullable(),
  cvUsefulness: EvidenceCardUsefulnessSchema,
  cautionNotes: z.array(z.string()),
});

export const EvidenceChunkSchema = z.object({
  chunkType: ChunkTypeSchema,
  content: z.string().min(1),
  tags: z.array(z.string()),
  sourceType: SourceTypeSchema,
  sourceId: z.string().nullable(),
  metadata: EvidenceChunkMetadataSchema,
});

export const EvidenceChunkCreatorOutputSchema = z.object({
  chunks: z.array(EvidenceChunkSchema),
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

export const GapQuestionSchema = z.object({
  targetRequirementId: z.string().nullable(),
  question: z.string().min(1),
  reason: z.string().min(1),
  whyItMatters: z.string().min(1),
  answerGuidance: z.string().min(1),
  exampleAngles: z.array(z.string().min(1)),
  shortQuestion: z.string().min(1),
  whyThisMatters: z.string().min(1),
  linkedJobRequirement: z.string().nullable(),
  howYourAnswerHelps: z.string().min(1),
  quickOptions: z.array(z.string().min(1)).min(2).max(4),
  selectedOptionRequiresDetail: z.boolean(),
  followUpPrompt: z.string().nullable(),
  metricPrompt: z.string().nullable(),
  metricOptionTriggers: z.array(z.string().min(1)).default([]),
  questionType: GapQuestionTypeSchema,
  exampleAnswer: z.string().nullable(),
  priorityReason: z.string().min(1),
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
      "strongProofCandidates",
      "scopeOpportunities",
      "likelyTopEvidence",
    ],
    properties: {
      contactInfo: {
        type: "object",
        additionalProperties: false,
        required: [
          "fullName",
          "professionalTitle",
          "location",
          "email",
          "phone",
        ],
        properties: {
          fullName: { type: ["string", "null"] },
          professionalTitle: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
        },
      },
      links: {
        type: "object",
        additionalProperties: false,
        required: ["linkedin", "github", "portfolio", "other"],
        properties: {
          linkedin: { type: ["string", "null"] },
          github: { type: ["string", "null"] },
          portfolio: { type: ["string", "null"] },
          other: {
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
      sourceSummary: { type: ["string", "null"] },
      summary: { type: "string" },
      skills: { type: "array", items: { type: "string" } },
      projects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "tools", "outcomes", "links"],
          properties: {
            name: { type: ["string", "null"] },
            description: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            outcomes: { type: "array", items: { type: "string" } },
            links: { type: "array", items: { type: "string" } },
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
            role: { type: ["string", "null"] },
            organization: { type: ["string", "null"] },
            startDate: { type: ["string", "null"] },
            endDate: { type: ["string", "null"] },
            current: { type: "boolean" },
            description: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            technologies: { type: "array", items: { type: "string" } },
            tools: { type: "array", items: { type: "string" } },
            achievements: { type: "array", items: { type: "string" } },
            outcomes: { type: "array", items: { type: "string" } },
          },
        },
      },
      education: {
        type: "array",
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
            institution: { type: ["string", "null"] },
            credential: { type: ["string", "null"] },
            degree: { type: ["string", "null"] },
            startYear: { type: ["string", "null"] },
            endYear: { type: ["string", "null"] },
            current: { type: "boolean" },
            expected: { type: "boolean" },
            details: { type: ["string", "null"] },
            coursework: { type: "array", items: { type: "string" } },
            notes: { type: ["string", "null"] },
          },
        },
      },
      certifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "issuer", "date", "status", "details"],
          properties: {
            name: { type: "string" },
            issuer: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            status: { type: ["string", "null"] },
            details: { type: ["string", "null"] },
          },
        },
      },
      tools: { type: "array", items: { type: "string" } },
      achievements: { type: "array", items: { type: "string" } },
      cautionNotes: { type: "array", items: { type: "string" } },
      metricOpportunities: { type: "array", items: { type: "string" } },
      strongProofCandidates: { type: "array", items: { type: "string" } },
      scopeOpportunities: { type: "array", items: { type: "string" } },
      likelyTopEvidence: { type: "array", items: { type: "string" } },
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
          required: [
            "chunkType",
            "content",
            "tags",
            "sourceType",
            "sourceId",
            "metadata",
          ],
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
            metadata: {
              type: "object",
              additionalProperties: false,
              required: [
                "action",
                "context",
                "toolsOrMethods",
                "ownership",
                "outcome",
                "metric",
                "scope",
                "source",
                "targetRequirementId",
                "targetRequirementLabel",
                "cvUsefulness",
                "cautionNotes",
              ],
              properties: {
                action: { type: ["string", "null"] },
                context: { type: ["string", "null"] },
                toolsOrMethods: { type: "array", items: { type: "string" } },
                ownership: { type: ["string", "null"] },
                outcome: { type: ["string", "null"] },
                metric: { type: ["string", "null"] },
                scope: { type: ["string", "null"] },
                source: { type: ["string", "null"] },
                targetRequirementId: { type: ["string", "null"] },
                targetRequirementLabel: { type: ["string", "null"] },
                cvUsefulness: {
                  type: "string",
                  enum: ["cv_ready", "supporting", "keyword_only", "caution"],
                },
                cautionNotes: { type: "array", items: { type: "string" } },
              },
            },
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
            "cvUsefulness",
            "claimRisk",
            "reason",
          ],
          properties: {
            jobRequirementId: { type: "string" },
            candidateChunkId: { type: ["string", "null"] },
            confidence: {
              type: "string",
              enum: ["high", "medium", "weak", "missing"],
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
            "shortQuestion",
            "whyThisMatters",
            "linkedJobRequirement",
            "howYourAnswerHelps",
            "quickOptions",
            "selectedOptionRequiresDetail",
            "followUpPrompt",
            "metricPrompt",
            "metricOptionTriggers",
            "questionType",
            "exampleAnswer",
            "priorityReason",
          ],
          properties: {
            targetRequirementId: { type: ["string", "null"] },
            question: { type: "string" },
            reason: { type: "string" },
            whyItMatters: { type: "string" },
            answerGuidance: { type: "string" },
            exampleAngles: { type: "array", items: { type: "string" } },
            shortQuestion: { type: "string" },
            whyThisMatters: { type: "string" },
            linkedJobRequirement: { type: ["string", "null"] },
            howYourAnswerHelps: { type: "string" },
            quickOptions: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
            selectedOptionRequiresDetail: { type: "boolean" },
            followUpPrompt: { type: ["string", "null"] },
            metricPrompt: { type: ["string", "null"] },
            metricOptionTriggers: {
              type: "array",
              items: { type: "string" },
            },
            questionType: {
              type: "string",
              enum: [
                "capability_check",
                "tool_check",
                "metric_or_scope",
                "ownership",
                "outcome_or_impact",
                "responsibility",
                "collaboration",
                "safety_or_quality",
                "domain_specific",
              ],
            },
            exampleAnswer: { type: ["string", "null"] },
            priorityReason: { type: "string" },
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
