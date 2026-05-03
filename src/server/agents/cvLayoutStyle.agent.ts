import {
  AgentJsonSchemas,
  CvLayoutStyleOutputSchema,
} from "~/lib/schemas";
import type { CvLayoutStyleOutput } from "~/lib/types";
import {
  canonicalPresentationSectionIds,
  type PresentationSectionId,
} from "~/lib/cvPresentation";
import { runJsonAgent } from "~/server/agents/agentRunner";
import { cvLayoutStylePrompt } from "~/server/prompts/cvLayoutStyle.prompt";

type LayoutSectionStyle = NonNullable<
  CvLayoutStyleOutput["sectionStyles"]["summary"]
>;

const sectionStyle = (contentStyle: LayoutSectionStyle["contentStyle"]) => ({
  treatment: "accent_heading" as const,
  priority: "standard" as const,
  divider: true,
  spacingBefore: "normal" as const,
  spacingAfter: "normal" as const,
  width: "full_width" as const,
  contentStyle,
});

function allSectionStyles(
  overrides: Partial<Record<PresentationSectionId, LayoutSectionStyle>> = {}
) {
  return Object.fromEntries(
    canonicalPresentationSectionIds.map((section) => [
      section,
      overrides[section] ??
        sectionStyle(section === "summary" ? "simple_paragraphs" : "bullets"),
    ])
  ) as CvLayoutStyleOutput["sectionStyles"];
}

function allLabels(
  labels: Partial<Record<PresentationSectionId, string | null>>
) {
  return Object.fromEntries(
    canonicalPresentationSectionIds.map((section) => [section, labels[section] ?? null])
  ) as CvLayoutStyleOutput["sectionLabelOverrides"];
}

function textFromContext(context: unknown) {
  return JSON.stringify(context ?? {}).toLowerCase();
}

const accentUse: CvLayoutStyleOutput["accentUsageRules"]["useAccentFor"] = [
  "section_headings",
  "divider_lines",
  "selected_labels",
  "links",
  "small_emphasis",
];

export function mockCvLayoutStyleOutput(context: unknown): CvLayoutStyleOutput {
  const text = textFromContext(context);
  const technical =
    /\b(ai|software|developer|engineer|llm|machine learning|backend|frontend|full stack|typescript|python|cloud)\b/.test(
      text
    );
  const marketing =
    /\b(marketing|campaign|content|social media|brand|seo|copywriting|comms)\b/.test(
      text
    );
  const retail =
    /\b(retail|barista|customer service|store|hospitality|front of house|sales assistant|starbucks)\b/.test(
      text
    );
  const finance = /\b(finance|analyst|trader|quant|investment|banking)\b/.test(
    text
  );
  const trades =
    /\b(electrician|plumber|carpenter|builder|site|apprentice|trade|mechanic|hvac)\b/.test(
      text
    );

  const base: Omit<CvLayoutStyleOutput, "templateId" | "careerStyle"> = {
    schemaVersion: 1 as const,
    density: "balanced" as const,
    pageTarget: "one_page" as const,
    typography: {
      fontPairing: "modern_sans" as const,
      nameSize: "large" as const,
      subtitleStyle: "muted_under_name" as const,
      bodySize: "standard" as const,
      headingWeight: "bold" as const,
    },
    colourSystem: {
      accentPalette: "blue" as const,
      bodyText: "dark" as const,
      mutedText: "grey" as const,
      dividerStyle: "accent_line" as const,
    },
    accentUsageRules: {
      useAccentFor: accentUse,
      neverUseAccentForBodyText: true as const,
      bodyTextMustRemain: "dark" as const,
      metadataTextMustRemain: "grey" as const,
    },
    headerStyle: "left_aligned_large_name" as const,
    skillsStyle: "grouped_rows" as const,
    sectionStyles: allSectionStyles({
      summary: sectionStyle("simple_paragraphs"),
      skills: sectionStyle("grouped_rows"),
    }),
    sectionLabelOverrides: allLabels({}),
    renderWarnings: [],
    rationale:
      "Use a safe, role-aware presentation while preserving the writer's CV content exactly.",
  };

  if (technical) {
    return {
      ...base,
      templateId: "technical_compact",
      careerStyle: "technical",
      typography: { ...base.typography, fontPairing: "technical_sans" },
      colourSystem: { ...base.colourSystem, accentPalette: "navy" },
      skillsStyle: "two_column_table",
      sectionStyles: allSectionStyles({
        summary: sectionStyle("simple_paragraphs"),
        skills: sectionStyle("table_like"),
        projects: { ...sectionStyle("bullets"), priority: "primary" },
      }),
      sectionLabelOverrides: allLabels({
        summary: "Professional Summary",
        projects: "Selected Projects",
        skills: "Technical Skills",
      }),
      rationale:
        "A compact technical layout highlights project evidence, grouped technical skills, and strong hierarchy.",
    };
  }

  if (marketing) {
    return {
      ...base,
      templateId: "creative_marketing",
      careerStyle: "marketing",
      colourSystem: { ...base.colourSystem, accentPalette: "teal" },
      headerStyle: "editorial_header",
      skillsStyle: "category_blocks",
      sectionLabelOverrides: allLabels({
        summary: "Profile",
        projects: "Campaign Projects",
        skills: "Marketing Skills",
        experience: "Relevant Experience",
      }),
      rationale:
        "A polished commercial layout supports campaign, content, and platform-focused evidence.",
    };
  }

  if (retail) {
    return {
      ...base,
      templateId: "retail_service",
      careerStyle: "retail",
      density: "compact",
      colourSystem: { ...base.colourSystem, accentPalette: "teal" },
      headerStyle: "compact_top_bar",
      skillsStyle: "simple_list",
      sectionLabelOverrides: allLabels({
        summary: "Profile",
        experience: "Customer Experience",
        skills: "Customer Service Skills",
      }),
      rationale:
        "A simple readable layout foregrounds service, reliability, communication, and availability.",
    };
  }

  if (finance) {
    return {
      ...base,
      templateId: "analytical_finance",
      careerStyle: "finance",
      typography: { ...base.typography, fontPairing: "compact_sans" },
      colourSystem: { ...base.colourSystem, accentPalette: "navy" },
      skillsStyle: "two_column_table",
      sectionLabelOverrides: allLabels({
        summary: "Professional Summary",
        projects: "Research & Projects",
        skills: "Analytical Skills",
      }),
      rationale:
        "A conservative analytical layout keeps hierarchy sharp and evidence easy to scan.",
    };
  }

  if (trades) {
    return {
      ...base,
      templateId: "trades_practical",
      careerStyle: "trades",
      density: "compact",
      colourSystem: { ...base.colourSystem, accentPalette: "green" },
      headerStyle: "compact_top_bar",
      skillsStyle: "simple_list",
      sectionLabelOverrides: allLabels({
        summary: "Profile",
        experience: "Site Experience",
        skills: "Tools & Site Skills",
      }),
      rationale:
        "A practical direct layout keeps licences, tools, site experience, and reliability easy to find.",
    };
  }

  return {
    ...base,
    templateId: "modern_professional",
    careerStyle: "general",
  };
}

export async function runCvLayoutStyleAgent(args: {
  applicationId: string;
  context: unknown;
}) {
  return runJsonAgent({
    applicationId: args.applicationId,
    agentName: "CV Layout Style Agent",
    model: "fast",
    systemPrompt: cvLayoutStylePrompt,
    userPrompt: JSON.stringify(args.context),
    schema: CvLayoutStyleOutputSchema,
    jsonSchema: AgentJsonSchemas.cvLayoutStyle,
    temperature: 0,
    mockOutput: () => mockCvLayoutStyleOutput(args.context),
  });
}
