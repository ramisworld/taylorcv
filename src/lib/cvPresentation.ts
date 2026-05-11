import {
  claimText,
  orderedSections,
  type CvSectionId,
  type StructuredCv,
} from "./cvDocument.ts";

export const canonicalPresentationSectionIds = [
  "summary",
  "experience",
  "projects",
  "skills",
  "education",
  "certifications",
  "achievements",
  "links",
] as const;

export const cvTemplateIds = [
  "technical_compact",
  "modern_professional",
  "creative_marketing",
  "graduate_clean",
  "executive_clean",
  "trades_practical",
  "retail_service",
  "analytical_finance",
  "project_heavy_builder",
] as const;

export const cvCareerStyles = [
  "technical",
  "marketing",
  "finance",
  "trades",
  "retail",
  "corporate",
  "creative",
  "academic",
  "general",
] as const;

export const cvDensityTokens = ["compact", "balanced", "spacious"] as const;
export const cvPageTargets = ["one_page"] as const;
export const cvFontPairings = [
  "modern_sans",
  "classic_serif_sans",
  "compact_sans",
  "editorial_serif",
  "technical_sans",
] as const;
export const cvNameSizes = ["large", "very_large"] as const;
export const cvSubtitleStyles = [
  "muted_inline",
  "muted_under_name",
  "compact_role_line",
] as const;
export const cvBodySizes = ["compact", "standard"] as const;
export const cvHeadingWeights = ["medium", "semibold", "bold"] as const;
export const cvAccentPalettes = [
  "blue",
  "teal",
  "green",
  "purple",
  "graphite",
  "burgundy",
  "navy",
  "amber",
] as const;
export const cvDividerStyles = ["light_rule", "no_rule"] as const;
export const cvHeaderStyles = [
  "left_aligned_large_name",
  "centered_classic",
  "compact_top_bar",
  "sidebar_identity",
  "editorial_header",
] as const;
export const cvSkillsStyles = [
  "grouped_rows",
  "two_column_table",
  "compact_inline_groups",
  "tool_grid",
  "category_blocks",
  "simple_list",
] as const;
export const cvSectionTreatments = [
  "accent_heading",
  "clean_heading",
  "boxed_label",
  "minimal_heading",
] as const;
export const cvSectionPriorities = ["primary", "standard", "supporting"] as const;
export const cvSectionSpacings = ["tight", "normal", "roomy"] as const;
export const cvSectionWidths = ["full_width", "compact"] as const;
export const cvSectionContentStyles = [
  "bullets",
  "grouped_rows",
  "table_like",
  "simple_paragraphs",
  "inline",
] as const;
export const cvAccentUsageTargets = [
  "section_headings",
  "selected_labels",
  "links",
  "small_emphasis",
] as const;
export const cvLayoutArchitectures = [
  "premium_hybrid",
  "classic_single_column",
  "simple_practical",
] as const;

export type PresentationSectionId =
  (typeof canonicalPresentationSectionIds)[number];
export type CvTemplateId = (typeof cvTemplateIds)[number];
export type CvCareerStyle = (typeof cvCareerStyles)[number];
export type CvDensity = (typeof cvDensityTokens)[number];
export type CvAccentPalette = (typeof cvAccentPalettes)[number];
export type CvSkillsStyle = (typeof cvSkillsStyles)[number];
export type CvLayoutArchitecture = (typeof cvLayoutArchitectures)[number];

export type CvSectionPresentation = {
  treatment: (typeof cvSectionTreatments)[number];
  priority: (typeof cvSectionPriorities)[number];
  divider: boolean;
  spacingBefore: (typeof cvSectionSpacings)[number];
  spacingAfter: (typeof cvSectionSpacings)[number];
  width: (typeof cvSectionWidths)[number];
  contentStyle: (typeof cvSectionContentStyles)[number];
};

export type CvPresentation = {
  schemaVersion: 1;
  layoutArchitecture: CvLayoutArchitecture;
  templateId: CvTemplateId;
  careerStyle: CvCareerStyle;
  density: CvDensity;
  pageTarget: "one_page";
  typography: {
    fontPairing: (typeof cvFontPairings)[number];
    nameSize: (typeof cvNameSizes)[number];
    subtitleStyle: (typeof cvSubtitleStyles)[number];
    bodySize: (typeof cvBodySizes)[number];
    headingWeight: (typeof cvHeadingWeights)[number];
  };
  colourSystem: {
    accentPalette: CvAccentPalette;
    bodyText: "dark";
    mutedText: "grey";
    dividerStyle: (typeof cvDividerStyles)[number];
  };
  accentUsageRules: {
    useAccentFor: Array<(typeof cvAccentUsageTargets)[number]>;
    neverUseAccentForBodyText: true;
    bodyTextMustRemain: "dark";
    metadataTextMustRemain: "grey";
  };
  headerStyle: (typeof cvHeaderStyles)[number];
  skillsStyle: CvSkillsStyle;
  sectionStyles: Partial<Record<PresentationSectionId, CvSectionPresentation>>;
  sectionLabelOverrides: Partial<Record<PresentationSectionId, string>>;
  renderWarnings: string[];
  rationale: string;
};

export type RendererTokens = {
  layoutArchitecture: CvLayoutArchitecture;
  templateId: CvTemplateId;
  careerStyle: CvCareerStyle;
  density: CvDensity;
  headerStyle: (typeof cvHeaderStyles)[number];
  skillsStyle: CvSkillsStyle;
  fontFamily: string;
  pdfFontFamily: "Helvetica" | "Times-Roman" | "Courier";
  docxFontFamily: string;
  pagePadding: number;
  pagePaddingCss: string;
  headerAlign: "left" | "center";
  nameSize: number;
  subtitleSize: number;
  bodySize: number;
  headingSize: number;
  lineHeight: number;
  sectionGap: number;
  itemGap: number;
  bulletGap: number;
  headingWeight: number;
  bodyTextColor: string;
  mutedTextColor: string;
  accentColor: string;
  dividerColor: string;
  dividerStyle: (typeof cvDividerStyles)[number];
  labelFor: (section: CvSectionId | PresentationSectionId) => string;
};

const defaultSectionLabels = {
  summary: "Professional Summary",
  experience: "Experience",
  projects: "Selected Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
  links: "Links",
} satisfies Record<PresentationSectionId, string>;

const paletteHex = {
  blue: "#2563eb",
  teal: "#0f766e",
  green: "#15803d",
  purple: "#7c3aed",
  graphite: "#374151",
  burgundy: "#9f1239",
  navy: "#1d4ed8",
  amber: "#b45309",
} satisfies Record<CvAccentPalette, string>;

const templateDefaults = {
  technical_compact: {
    careerStyle: "technical",
    accentPalette: "navy",
    fontPairing: "technical_sans",
    headerStyle: "left_aligned_large_name",
    skillsStyle: "two_column_table",
  },
  modern_professional: {
    careerStyle: "general",
    accentPalette: "blue",
    fontPairing: "modern_sans",
    headerStyle: "left_aligned_large_name",
    skillsStyle: "grouped_rows",
  },
  creative_marketing: {
    careerStyle: "marketing",
    accentPalette: "teal",
    fontPairing: "modern_sans",
    headerStyle: "editorial_header",
    skillsStyle: "category_blocks",
  },
  graduate_clean: {
    careerStyle: "general",
    accentPalette: "blue",
    fontPairing: "compact_sans",
    headerStyle: "compact_top_bar",
    skillsStyle: "compact_inline_groups",
  },
  executive_clean: {
    careerStyle: "corporate",
    accentPalette: "graphite",
    fontPairing: "classic_serif_sans",
    headerStyle: "centered_classic",
    skillsStyle: "grouped_rows",
  },
  trades_practical: {
    careerStyle: "trades",
    accentPalette: "green",
    fontPairing: "compact_sans",
    headerStyle: "compact_top_bar",
    skillsStyle: "simple_list",
  },
  retail_service: {
    careerStyle: "retail",
    accentPalette: "teal",
    fontPairing: "modern_sans",
    headerStyle: "compact_top_bar",
    skillsStyle: "simple_list",
  },
  analytical_finance: {
    careerStyle: "finance",
    accentPalette: "navy",
    fontPairing: "compact_sans",
    headerStyle: "left_aligned_large_name",
    skillsStyle: "two_column_table",
  },
  project_heavy_builder: {
    careerStyle: "technical",
    accentPalette: "blue",
    fontPairing: "technical_sans",
    headerStyle: "left_aligned_large_name",
    skillsStyle: "grouped_rows",
  },
} satisfies Record<
  CvTemplateId,
  {
    careerStyle: CvCareerStyle;
    accentPalette: CvAccentPalette;
    fontPairing: (typeof cvFontPairings)[number];
    headerStyle: (typeof cvHeaderStyles)[number];
    skillsStyle: CvSkillsStyle;
  }
>;

function includesToken<T extends readonly string[]>(
  tokens: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && tokens.includes(value);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function estimateCvLoad(cv: StructuredCv) {
  const summaryWords = cv.summary.trim().split(/\s+/).filter(Boolean).length;
  const projectBullets = cv.projects.reduce(
    (total, item) => total + item.bullets.length,
    0
  );
  const experienceBullets = cv.experience.reduce(
    (total, item) => total + item.bullets.length,
    0
  );
  const skillItems = cv.skills.groups.reduce(
    (total, group) => total + group.skills.length,
    0
  );
  const educationItems = cv.education.length;
  const certificationItems = cv.certifications.length;
  const bulletWords = [...cv.projects, ...cv.experience]
    .flatMap((item) => item.bullets)
    .map(claimText)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    summaryWords,
    bulletCount: projectBullets + experienceBullets,
    skillItems,
    sectionCount: orderedSections(cv.sectionOrder, cv.roleArchetype).length,
    estimatedWords: summaryWords + bulletWords + skillItems * 2,
    supportingItems: educationItems + certificationItems,
  };
}

export function needsCompactPageFit(cv: StructuredCv) {
  const load = estimateCvLoad(cv);

  return (
    load.estimatedWords > 560 ||
    load.bulletCount > 11 ||
    load.skillItems > 24 ||
    (load.sectionCount >= 6 && load.estimatedWords > 480) ||
    (load.supportingItems > 4 && load.estimatedWords > 450)
  );
}

function inferCareerStyleFromText(text: string): CvCareerStyle {
  const normalized = text.toLowerCase();
  if (
    /\b(ai|software|developer|engineer|llm|machine learning|data scientist|backend|frontend|full stack|cloud|devops|cyber|technical)\b/.test(
      normalized
    )
  ) {
    return "technical";
  }
  if (/\b(marketing|campaign|content|social media|brand|seo|copywriter)\b/.test(normalized)) {
    return "marketing";
  }
  if (/\b(finance|analyst|trader|quant|investment|accounting|banking)\b/.test(normalized)) {
    return "finance";
  }
  if (/\b(electrician|plumber|carpenter|builder|site|apprentice|trade|hvac|mechanic)\b/.test(normalized)) {
    return "trades";
  }
  if (/\b(retail|barista|customer service|store|hospitality|front of house|sales assistant)\b/.test(normalized)) {
    return "retail";
  }
  if (/\b(design|creative|artist|editorial|photographer|video|fashion)\b/.test(normalized)) {
    return "creative";
  }
  if (/\b(research|academic|lecturer|phd|university|laboratory)\b/.test(normalized)) {
    return "academic";
  }
  return "general";
}

function inferCareerStyle(cv: StructuredCv, context?: unknown) {
  const contextText =
    typeof context === "string" ? context : JSON.stringify(context ?? {});
  return inferCareerStyleFromText(
    [
      cv.header.targetTitle,
      cv.summary,
      cv.roleArchetype,
      cv.skills.groups.map((group) => `${group.group} ${group.skills.join(" ")}`).join(" "),
      contextText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function templateForCareer(careerStyle: CvCareerStyle, cv: StructuredCv): CvTemplateId {
  if (careerStyle === "technical") {
    return cv.projects.length > cv.experience.length
      ? "project_heavy_builder"
      : "technical_compact";
  }
  if (careerStyle === "marketing" || careerStyle === "creative") {
    return "creative_marketing";
  }
  if (careerStyle === "finance") return "analytical_finance";
  if (careerStyle === "trades") return "trades_practical";
  if (careerStyle === "retail") return "retail_service";
  if (careerStyle === "corporate") return "executive_clean";
  return "modern_professional";
}

function safeLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (
    !trimmed ||
    trimmed.length > 48 ||
    /[<>{}#[\];=]/.test(trimmed) ||
    /\b(style|script|class|font-family|color)\b/i.test(trimmed)
  ) {
    return fallback;
  }

  return trimmed;
}

function defaultLabelsForCareer(careerStyle: CvCareerStyle) {
  if (careerStyle === "technical") {
    return {
      ...defaultSectionLabels,
      summary: "Professional Summary",
      skills: "Technical Skills",
      projects: "Selected Projects",
    };
  }
  if (careerStyle === "marketing" || careerStyle === "creative") {
    return {
      ...defaultSectionLabels,
      summary: "Profile",
      skills: "Marketing Skills",
      projects: "Campaign Projects",
      experience: "Relevant Experience",
    };
  }
  if (careerStyle === "retail") {
    return {
      ...defaultSectionLabels,
      summary: "Profile",
      experience: "Customer Experience",
      skills: "Customer Service Skills",
    };
  }
  if (careerStyle === "trades") {
    return {
      ...defaultSectionLabels,
      summary: "Profile",
      skills: "Tools & Site Skills",
      experience: "Site Experience",
    };
  }
  if (careerStyle === "finance") {
    return {
      ...defaultSectionLabels,
      summary: "Professional Summary",
      projects: "Research & Projects",
      skills: "Analytical Skills",
    };
  }
  return defaultSectionLabels;
}

function defaultSectionStyle(
  section: PresentationSectionId,
  density: CvDensity,
  skillsStyle: CvSkillsStyle
): CvSectionPresentation {
  const compact = density === "compact";

  return {
    treatment: section === "summary" ? "clean_heading" : "accent_heading",
    priority:
      section === "summary" || section === "projects" || section === "experience"
        ? "primary"
        : "standard",
    divider: true,
    spacingBefore: compact ? "tight" : "normal",
    spacingAfter: compact ? "tight" : "normal",
    width: "full_width",
    contentStyle:
      section === "skills"
        ? skillsStyle === "two_column_table"
          ? "table_like"
          : "grouped_rows"
        : section === "summary"
          ? "simple_paragraphs"
          : "bullets",
  };
}

function normalizeSectionStyle(
  value: unknown,
  fallback: CvSectionPresentation
): CvSectionPresentation {
  const source = record(value);
  if (!source) return fallback;

  return {
    treatment: includesToken(cvSectionTreatments, source.treatment)
      ? source.treatment
      : fallback.treatment,
    priority: includesToken(cvSectionPriorities, source.priority)
      ? source.priority
      : fallback.priority,
    divider: typeof source.divider === "boolean" ? source.divider : fallback.divider,
    spacingBefore: includesToken(cvSectionSpacings, source.spacingBefore)
      ? source.spacingBefore
      : fallback.spacingBefore,
    spacingAfter: includesToken(cvSectionSpacings, source.spacingAfter)
      ? source.spacingAfter
      : fallback.spacingAfter,
    width: includesToken(cvSectionWidths, source.width) ? source.width : fallback.width,
    contentStyle: includesToken(cvSectionContentStyles, source.contentStyle)
      ? source.contentStyle
      : fallback.contentStyle,
  };
}

export function normalizeCvPresentation(
  rawPresentation: unknown,
  cv: StructuredCv,
  context?: unknown
): CvPresentation {
  const source = record(rawPresentation);
  const compact = needsCompactPageFit(cv);
  const inferredCareerStyle = inferCareerStyle(cv, context);
  const rawTemplateId = source?.templateId;
  const rawLayoutArchitecture = source?.layoutArchitecture;
  const layoutArchitecture = includesToken(
    cvLayoutArchitectures,
    rawLayoutArchitecture
  )
    ? rawLayoutArchitecture
    : inferredCareerStyle === "technical" || inferredCareerStyle === "academic"
      ? "premium_hybrid"
      : inferredCareerStyle === "retail" || inferredCareerStyle === "trades"
        ? "simple_practical"
        : "classic_single_column";
  const templateId = includesToken(cvTemplateIds, rawTemplateId)
    ? rawTemplateId
    : templateForCareer(inferredCareerStyle, cv);
  const template = templateDefaults[templateId];
  const rawCareerStyle = source?.careerStyle;
  const careerStyle = includesToken(cvCareerStyles, rawCareerStyle)
    ? rawCareerStyle
    : template.careerStyle;
  const density: CvDensity = compact
    ? "compact"
    : includesToken(cvDensityTokens, source?.density)
      ? source.density
      : "balanced";
  const typography = record(source?.typography);
  const colourSystem = record(source?.colourSystem);
  const sectionStylesSource = record(source?.sectionStyles);
  const labelSource = record(source?.sectionLabelOverrides);
  const labels = defaultLabelsForCareer(careerStyle);
  const normalizedDividerStyle =
    colourSystem?.dividerStyle === "no_rule" ? "no_rule" : "light_rule";
  const skillsStyle: CvSkillsStyle = compact
    ? "compact_inline_groups"
    : includesToken(cvSkillsStyles, source?.skillsStyle)
      ? source.skillsStyle
      : template.skillsStyle;

  const sectionStyles: CvPresentation["sectionStyles"] = {};
  const sectionLabelOverrides: CvPresentation["sectionLabelOverrides"] = {};

  for (const section of canonicalPresentationSectionIds) {
    sectionStyles[section] = normalizeSectionStyle(
      sectionStylesSource?.[section],
      defaultSectionStyle(section, density, skillsStyle)
    );
    sectionLabelOverrides[section] = safeLabel(labelSource?.[section], labels[section]);
  }

  return {
    schemaVersion: 1,
    layoutArchitecture,
    templateId,
    careerStyle,
    density,
    pageTarget: "one_page",
    typography: {
      fontPairing: compact
        ? "compact_sans"
        : includesToken(cvFontPairings, typography?.fontPairing)
          ? typography.fontPairing
          : template.fontPairing,
      nameSize: compact
        ? "large"
        : includesToken(cvNameSizes, typography?.nameSize)
          ? typography.nameSize
          : "large",
      subtitleStyle: compact
        ? "compact_role_line"
        : includesToken(cvSubtitleStyles, typography?.subtitleStyle)
          ? typography.subtitleStyle
          : "muted_under_name",
      bodySize: compact
        ? "compact"
        : includesToken(cvBodySizes, typography?.bodySize)
          ? typography.bodySize
          : "standard",
      headingWeight: includesToken(cvHeadingWeights, typography?.headingWeight)
        ? typography.headingWeight
        : "bold",
    },
    colourSystem: {
      accentPalette: includesToken(cvAccentPalettes, colourSystem?.accentPalette)
        ? colourSystem.accentPalette
        : template.accentPalette,
      bodyText: "dark",
      mutedText: "grey",
      dividerStyle: normalizedDividerStyle,
    },
    accentUsageRules: {
      useAccentFor: [
        "section_headings",
        "selected_labels",
        "links",
        "small_emphasis",
      ],
      neverUseAccentForBodyText: true,
      bodyTextMustRemain: "dark",
      metadataTextMustRemain: "grey",
    },
    headerStyle: compact
      ? "compact_top_bar"
      : includesToken(cvHeaderStyles, source?.headerStyle)
        ? source.headerStyle
        : template.headerStyle,
    skillsStyle,
    sectionStyles,
    sectionLabelOverrides,
    renderWarnings:
      compact || !source
        ? [
            compact
              ? "Page-fit normalization applied compact presentation tokens."
              : "Fallback presentation normalization applied.",
          ]
        : Array.isArray(source.renderWarnings)
          ? source.renderWarnings
              .filter((warning): warning is string => typeof warning === "string")
              .map((warning) => warning.slice(0, 180))
              .slice(0, 5)
          : [],
    rationale:
      typeof source?.rationale === "string"
        ? source.rationale.slice(0, 500)
        : "Normalized safe CV presentation plan.",
  };
}

function fontFamilyFor(pairing: CvPresentation["typography"]["fontPairing"]) {
  if (pairing === "classic_serif_sans" || pairing === "editorial_serif") {
    return {
      css: "Georgia, 'Times New Roman', serif",
      pdf: "Times-Roman" as const,
      docx: "Georgia",
    };
  }
  if (pairing === "technical_sans" || pairing === "compact_sans") {
    return {
      css: "Arial, Helvetica, sans-serif",
      pdf: "Helvetica" as const,
      docx: "Arial",
    };
  }
  return {
    css: "Inter, Arial, Helvetica, sans-serif",
    pdf: "Helvetica" as const,
    docx: "Aptos",
  };
}

export function presentationToRendererTokens(
  presentation: CvPresentation
): RendererTokens {
  const compact = presentation.density === "compact";
  const spacious = presentation.density === "spacious";
  const fonts = fontFamilyFor(presentation.typography.fontPairing);
  const accentColor = paletteHex[presentation.colourSystem.accentPalette];
  const centered =
    presentation.headerStyle === "centered_classic" ||
    presentation.headerStyle === "editorial_header";

  return {
    layoutArchitecture: presentation.layoutArchitecture,
    templateId: presentation.templateId,
    careerStyle: presentation.careerStyle,
    density: presentation.density,
    headerStyle: presentation.headerStyle,
    skillsStyle: presentation.skillsStyle,
    fontFamily: fonts.css,
    pdfFontFamily: fonts.pdf,
    docxFontFamily: fonts.docx,
    pagePadding: compact ? 30 : spacious ? 48 : 40,
    pagePaddingCss: compact ? "30px 38px" : spacious ? "48px 56px" : "40px 48px",
    headerAlign: centered ? "center" : "left",
    nameSize:
      presentation.typography.nameSize === "very_large" && !compact ? 32 : 29,
    subtitleSize: compact ? 11.5 : 12.5,
    bodySize:
      presentation.typography.bodySize === "compact" || compact ? 11.2 : 12,
    headingSize: compact ? 11.4 : 12.6,
    lineHeight: compact ? 1.38 : 1.48,
    sectionGap: compact ? 12 : spacious ? 22 : 16,
    itemGap: compact ? 7 : spacious ? 12 : 9,
    bulletGap: compact ? 1.5 : 3,
    headingWeight:
      presentation.typography.headingWeight === "medium"
        ? 500
        : presentation.typography.headingWeight === "semibold"
          ? 600
          : 700,
    bodyTextColor: "#18181b",
    mutedTextColor: "#52525b",
    accentColor,
    dividerColor: "#d4d4d8",
    dividerStyle: presentation.colourSystem.dividerStyle,
    labelFor: (section) =>
      safeLabel(
        presentation.sectionLabelOverrides[section],
        defaultSectionLabels[section]
      ),
  };
}

export function stripCvPresentationDebug(rawPresentation: unknown) {
  const source = record(rawPresentation);
  if (!source) return rawPresentation;
  const { rationale: _rationale, renderWarnings: _renderWarnings, ...rest } = source;
  return rest;
}
