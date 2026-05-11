import { CvBuilderOutputSchema } from "~/lib/schemas";
import type { CvBuilderOutput } from "~/lib/types";
import { normalizeCvBuilderRawOutput } from "~/lib/cvBuilderCanonicalizer";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { cvBuilderPrompt } from "~/server/prompts/cvBuilder.prompt";

const dynamicExperienceItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["role", "company", "location", "dates", "startDate", "endDate", "bullets"],
  properties: {
    role: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    dates: { type: ["string", "null"] },
    startDate: { type: ["string", "null"] },
    endDate: { type: ["string", "null"] },
    bullets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sourceChunkIds", "gapAnswerIds"],
        properties: {
          text: { type: "string" },
          sourceChunkIds: { type: "array", items: { type: "string" } },
          gapAnswerIds: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const bulletClaimSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "sourceChunkIds", "gapAnswerIds"],
  properties: {
    text: { type: "string" },
    sourceChunkIds: { type: "array", items: { type: "string" } },
    gapAnswerIds: { type: "array", items: { type: "string" } },
  },
} as const;

const dynamicSkillSchema = {
  type: "object",
  additionalProperties: false,
  required: ["group", "skills"],
  properties: {
    group: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
  },
} as const;

const experienceItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["role", "company", "dates", "location", "startDate", "endDate", "bullets"],
  properties: {
    role: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    dates: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    startDate: { type: ["string", "null"] },
    endDate: { type: ["string", "null"] },
    bullets: { type: "array", items: bulletClaimSchema },
  },
} as const;

const projectItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "descriptor", "dates", "bullets"],
  properties: {
    name: { type: ["string", "null"] },
    descriptor: { type: ["string", "null"] },
    dates: { type: ["string", "null"] },
    bullets: { type: "array", items: bulletClaimSchema },
  },
} as const;

const educationItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["institution", "degree", "dates", "details"],
  properties: {
    institution: { type: ["string", "null"] },
    degree: { type: ["string", "null"] },
    dates: { type: ["string", "null"] },
    details: { type: "array", items: { type: "string" } },
  },
} as const;

function sectionVariantSchema(type: string, itemSchema: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "type", "priority", "items"],
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      type: { type: "string", enum: [type] },
      priority: {
        type: "string",
        enum: ["primary", "secondary", "supporting"],
      },
      items: { type: "array", items: itemSchema },
    },
  } as const;
}

const sectionSchema = {
  anyOf: [
    sectionVariantSchema("summary", bulletClaimSchema),
    sectionVariantSchema("inline", bulletClaimSchema),
    sectionVariantSchema("bullets", bulletClaimSchema),
    sectionVariantSchema("certifications", bulletClaimSchema),
    sectionVariantSchema("experience", dynamicExperienceItemSchema),
    sectionVariantSchema("projects", projectItemSchema),
    sectionVariantSchema("skills", dynamicSkillSchema),
    sectionVariantSchema("education", educationItemSchema),
  ],
} as const;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "roleArchetype",
    "targetPositioning",
    "cvAngle",
    "sectionPlan",
    "evidenceAllocation",
    "claimBoundaries",
    "strongestEvidenceUsed",
    "stillLimited",
    "beforeScoreRecommendation",
    "afterScoreRecommendation",
    "cvJson",
    "cvText",
    "assumptions",
  ],
  properties: {
    roleArchetype: { type: "string" },
    targetPositioning: { type: "string" },
    cvAngle: { type: "string" },
    sectionPlan: { type: "array", items: { type: "string" } },
    evidenceAllocation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId", "evidence", "rationale"],
        properties: {
          sectionId: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
      },
    },
    claimBoundaries: { type: "array", items: { type: "string" } },
    strongestEvidenceUsed: { type: "array", items: { type: "string" } },
    stillLimited: { type: "array", items: { type: "string" } },
    beforeScoreRecommendation: { type: "number" },
    afterScoreRecommendation: { type: "number" },
    cvJson: {
      type: "object",
      additionalProperties: false,
      required: [
        "sectionOrder",
        "header",
        "summary",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
        "sections",
        "roleArchetype",
      ],
      properties: {
        roleArchetype: { type: ["string", "null"] },
        sectionOrder: { type: "array", items: { type: "string" } },
        header: {
          type: "object",
          additionalProperties: false,
          required: ["name", "targetTitle", "location", "phone", "email", "links"],
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
                required: ["group", "skills"],
                properties: {
                  group: { type: "string" },
                  skills: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        experience: { type: "array", items: experienceItemSchema },
        projects: { type: "array", items: projectItemSchema },
        education: { type: "array", items: educationItemSchema },
        certifications: { type: "array", items: { type: "string" } },
        sections: { type: "array", items: sectionSchema },
      },
    },
    cvText: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
  },
} as const;

function words(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

function clean(text: string) {
  return text.replace(/—/g, "-").replace(/\s+/g, " ").trim();
}

function fallbackOutput(context: {
  job?: { title?: string; company?: string | null; roleDomain?: string | null; archetypeHint?: string | null };
  candidateProfile?: {
    contactInfoJson?: unknown;
    linksJson?: unknown;
    summary?: string;
    skillsJson?: unknown;
    toolsJson?: unknown;
    educationJson?: unknown;
    certificationsJson?: unknown;
  };
  matchAnalysis?: {
    currentMatchScore?: number;
    cvAngle?: string;
    roleArchetype?: string;
    topStrengths?: string[];
    weakSpots?: string[];
    evidenceCards?: Array<{ content?: string; requirementLabel?: string; candidateChunkId?: string | null }>;
  };
  gapEvidence?: Array<{ id?: string; sourceId?: string | null; content: string; metadataJson?: unknown }>;
}) {
  const contact =
    context.candidateProfile?.contactInfoJson &&
    typeof context.candidateProfile.contactInfoJson === "object"
      ? (context.candidateProfile.contactInfoJson as Record<string, unknown>)
      : {};
  const links =
    context.candidateProfile?.linksJson &&
    typeof context.candidateProfile.linksJson === "object"
      ? (context.candidateProfile.linksJson as Record<string, unknown>)
      : {};
  const textArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const evidence = [
    ...(context.matchAnalysis?.evidenceCards ?? [])
      .map((card) => ({
        text: clean(card.content ?? ""),
        sourceChunkIds: card.candidateChunkId ? [card.candidateChunkId] : [],
        gapAnswerIds: [] as string[],
      }))
      .filter((item) => item.text),
    ...(context.gapEvidence ?? [])
      .map((item) => ({
        text: clean(item.content),
        sourceChunkIds: item.id ? [item.id] : [],
        gapAnswerIds: item.sourceId ? [item.sourceId] : [],
      }))
      .filter((item) => item.text),
  ];
  const strongest = evidence.slice(0, 4);
  const title = context.job?.title ?? "Target Role";
  const roleArchetype =
    context.matchAnalysis?.roleArchetype ??
    context.job?.archetypeHint ??
    context.job?.roleDomain ??
    "general";
  const technical = /ai|software|data|engineer|developer|technical|llm|rag/i.test(
    `${title} ${roleArchetype}`
  );
  const skills = [
    ...textArray(context.candidateProfile?.skillsJson),
    ...textArray(context.candidateProfile?.toolsJson),
  ].slice(0, 22);
  const groupedSkills = technical
    ? [
        { group: "Languages", skills: skills.filter((skill) => /python|javascript|typescript|sql/i.test(skill)) },
        { group: "Backend & APIs", skills: skills.filter((skill) => /fastapi|node|express|api|rest|trpc|prisma/i.test(skill)) },
        { group: "AI & Data", skills: skills.filter((skill) => /llm|rag|embedding|openai|anthropic|pandas|scikit|agent|vector|pgvector/i.test(skill)) },
        { group: "Databases & Frontend", skills: skills.filter((skill) => /postgres|mongo|sqlite|react|next/i.test(skill)) },
        { group: "Cloud & Tools", skills: skills.filter((skill) => /aws|docker|git|github|deployment/i.test(skill)) },
      ].filter((group) => group.skills.length > 0)
    : [{ group: "Strengths", skills }];
  const summary = clean(
    `${title} profile with role-aligned evidence across ${strongest
      .slice(0, 2)
      .map((item) => item.text.toLowerCase())
      .join(" and ") || "practical delivery"}.`
  );
  const boundedSummary =
    words(summary).length > 62 ? `${words(summary).slice(0, 62).join(" ")}.` : summary;
  const proofBullets = strongest.length
    ? strongest.map((item) => ({
        text: clean(item.text).slice(0, 210),
        sourceChunkIds: item.sourceChunkIds,
        gapAnswerIds: item.gapAnswerIds,
      }))
    : [{
        text: clean(context.candidateProfile?.summary ?? "Built practical evidence aligned to the target role."),
        sourceChunkIds: [],
        gapAnswerIds: [],
      }];
  const sectionLabel = technical
    ? "Selected AI Engineering Evidence"
    : "Key Achievements";
  const sections = [
    {
      id: "summary",
      label: "Profile",
      type: "summary" as const,
      priority: "primary" as const,
      items: [{ text: boundedSummary, sourceChunkIds: [], gapAnswerIds: [] }],
    },
    {
      id: "selected-evidence",
      label: sectionLabel,
      type: "bullets" as const,
      priority: "primary" as const,
      items: proofBullets,
    },
    ...(skills.length
      ? [
          {
            id: "skills",
            label: technical ? "Technical Skills" : "Role Skills",
            type: "skills" as const,
            priority: "secondary" as const,
            items: groupedSkills,
          },
        ]
      : []),
  ];
  const afterBase =
    (context.matchAnalysis?.currentMatchScore ?? 48) +
    24 +
    Math.min(10, proofBullets.length * 3) +
    (context.gapEvidence?.length ? 5 : 0);
  const afterScoreRecommendation = Math.min(
    strongest.length >= 4 ? 96 : strongest.length >= 2 ? 92 : 84,
    Math.max(58, afterBase)
  );
  const cvJson = {
    roleArchetype,
    sectionOrder: sections.map((section) => section.id),
    header: {
      name: typeof contact.fullName === "string" ? contact.fullName : null,
      targetTitle:
        typeof contact.professionalTitle === "string"
          ? contact.professionalTitle
          : title,
      location: typeof contact.location === "string" ? contact.location : null,
      phone: typeof contact.phone === "string" ? contact.phone : null,
      email: typeof contact.email === "string" ? contact.email : null,
      links: [
        typeof links.linkedin === "string"
          ? { label: "LinkedIn", url: links.linkedin }
          : null,
        typeof links.github === "string" ? { label: "GitHub", url: links.github } : null,
        typeof links.portfolio === "string"
          ? { label: "Portfolio", url: links.portfolio }
          : null,
      ].filter((link): link is { label: string; url: string } => !!link),
    },
    summary: boundedSummary,
    skills: { groups: groupedSkills },
    experience: [
      {
        role: context.candidateProfile?.summary ? "Relevant Experience" : null,
        company: null,
        dates: null,
        location: null,
        startDate: null,
        endDate: null,
        bullets: proofBullets.slice(0, 1),
      },
    ].filter((item) => item.bullets.length > 0),
    projects: proofBullets.map((bullet, index) => ({
      name: index === 0 ? sectionLabel : "Supporting Evidence",
      descriptor: null,
      dates: null,
      bullets: [bullet],
    })),
    education: [],
    certifications: textArray(context.candidateProfile?.certificationsJson),
    sections,
  };

  return {
    roleArchetype,
    targetPositioning: `${title} candidate positioned around strongest verified evidence.`,
    cvAngle:
      context.matchAnalysis?.cvAngle ??
      `Lead with ${sectionLabel.toLowerCase()} and keep unsupported claims conservative.`,
    sectionPlan: sections.map((section) => section.label),
    evidenceAllocation: sections.map((section) => ({
      sectionId: section.id,
      evidence: section.items.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item)
      ),
      rationale: `Use ${section.label} to support the role angle.`,
    })),
    claimBoundaries:
      context.matchAnalysis?.weakSpots?.map((spot) => `Do not overstate ${spot}.`) ?? [],
    strongestEvidenceUsed: strongest.map((item) => item.text),
    stillLimited: context.matchAnalysis?.weakSpots?.slice(0, 3) ?? [],
    beforeScoreRecommendation: Math.min(
      context.matchAnalysis?.currentMatchScore ?? 48,
      strongest.length >= 5 ? 78 : 69
    ),
    afterScoreRecommendation,
    cvJson,
    cvText: [
      cvJson.header.name,
      cvJson.header.targetTitle,
      [cvJson.header.location, cvJson.header.phone, cvJson.header.email]
        .filter(Boolean)
        .join(" | "),
      "",
      ...sections.flatMap((section) => [
        section.label.toUpperCase(),
        ...section.items.map((item) =>
          typeof item === "string"
            ? item
            : "text" in item && typeof item.text === "string"
              ? item.text
              : JSON.stringify(item)
        ),
        "",
      ]),
    ]
      .filter((line) => line !== null)
      .join("\n")
      .trim(),
    assumptions: [],
  };
}

export async function runCvBuilderAgent(args: {
  applicationId: string;
  context: unknown;
}): Promise<CvBuilderOutput> {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "CV Builder Agent",
    model: "strong",
    systemPrompt: cvBuilderPrompt,
    userPrompt: JSON.stringify(args.context),
    schema: CvBuilderOutputSchema,
    jsonSchema,
    normalizeRawOutput: normalizeCvBuilderRawOutput,
    temperature: 0.2,
    mockOutput: () => fallbackOutput(args.context as Parameters<typeof fallbackOutput>[0]),
  }) as Promise<CvBuilderOutput>;
}
