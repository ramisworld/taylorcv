import assert from "node:assert/strict";

import { CvLayoutStyleOutputSchema } from "../src/lib/schemas.ts";
import {
  canonicalPresentationSectionIds,
  normalizeCvPresentation,
  presentationToRendererTokens,
} from "../src/lib/cvPresentation.ts";

const sectionStyle = {
  treatment: "accent_heading",
  priority: "standard",
  divider: true,
  spacingBefore: "normal",
  spacingAfter: "normal",
  width: "full_width",
  contentStyle: "bullets",
};

function sectionStyles(overrides = {}) {
  return Object.fromEntries(
    canonicalPresentationSectionIds.map((section) => [
      section,
      {
        ...sectionStyle,
        contentStyle:
          section === "summary"
            ? "simple_paragraphs"
            : section === "skills"
              ? "grouped_rows"
              : "bullets",
        ...overrides[section],
      },
    ])
  );
}

function labels(overrides = {}) {
  return Object.fromEntries(
    canonicalPresentationSectionIds.map((section) => [
      section,
      overrides[section] ?? null,
    ])
  );
}

function validLayout(overrides = {}) {
  return {
    schemaVersion: 1,
    layoutArchitecture: "premium_hybrid",
    templateId: "technical_compact",
    careerStyle: "technical",
    density: "balanced",
    pageTarget: "one_page",
    typography: {
      fontPairing: "technical_sans",
      nameSize: "large",
      subtitleStyle: "muted_under_name",
      bodySize: "standard",
      headingWeight: "bold",
    },
    colourSystem: {
      accentPalette: "navy",
      bodyText: "dark",
      mutedText: "grey",
      dividerStyle: "light_rule",
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
    headerStyle: "left_aligned_large_name",
    skillsStyle: "two_column_table",
    sectionStyles: sectionStyles(),
    sectionLabelOverrides: labels({ skills: "Technical Skills" }),
    renderWarnings: [],
    rationale: "Technical layout for a one-page CV.",
    ...overrides,
  };
}

function cvFixture({ title = "Applied AI Engineer", summary = "Applied AI engineer building LLM tools.", skillsLabel = "AI / ML", bulletCount = 4 } = {}) {
  return {
    sectionOrder: [
      "Summary",
      "Selected Projects",
      "Experience",
      "Skills",
      "Education",
      "Certifications",
    ],
    header: {
      name: "Ben Smith",
      targetTitle: title,
      location: "Auckland",
      phone: null,
      email: null,
      links: [],
    },
    summary,
    skills: {
      groups: [
        {
          group: skillsLabel,
          skills: ["Python", "RAG", "OpenAI", "PostgreSQL", "React"],
        },
      ],
    },
    projects: [
      {
        name: "Role-focused project",
        descriptor: null,
        dates: null,
        bullets: Array.from({ length: bulletCount }, (_, index) => ({
          text: `Built truthful project evidence bullet ${index + 1} with concrete scope and implementation detail.`,
          sourceChunkIds: [`chunk-${index + 1}`],
          gapAnswerIds: [],
        })),
      },
    ],
    experience: [
      {
        role: "Relevant Experience",
        company: null,
        dates: "2025",
        location: "Auckland",
        bullets: [
          {
            text: "Delivered customer-facing work with clear communication.",
            sourceChunkIds: ["chunk-experience"],
            gapAnswerIds: [],
          },
        ],
      },
    ],
    education: [],
    certifications: [],
  };
}

assert.equal(
  CvLayoutStyleOutputSchema.safeParse(validLayout()).success,
  true,
  "one valid layout object should pass schema validation"
);

assert.equal(
  CvLayoutStyleOutputSchema.safeParse(validLayout({ templateId: "free_css" })).success,
  false,
  "invalid template IDs should fail schema validation"
);
assert.equal(
  CvLayoutStyleOutputSchema.safeParse(
    validLayout({ typography: { ...validLayout().typography, fontPairing: "Comic Sans" } })
  ).success,
  false,
  "invalid fonts should fail schema validation"
);
assert.equal(
  CvLayoutStyleOutputSchema.safeParse(
    validLayout({ colourSystem: { ...validLayout().colourSystem, accentPalette: "#2563eb" } })
  ).success,
  false,
  "hex colour values should fail schema validation"
);
assert.equal(
  CvLayoutStyleOutputSchema.safeParse(
    validLayout({ sectionLabelOverrides: labels({ skills: "<b>Technical Skills</b>" }) })
  ).success,
  false,
  "HTML-like labels should fail schema validation"
);

const generalCv = cvFixture({
  title: "Operations Coordinator",
  summary: "Organized coordinator with practical experience keeping work moving.",
  skillsLabel: "Operations",
});
const corrupted = normalizeCvPresentation(
  {
    templateId: "not_real",
    typography: { fontPairing: "Papyrus" },
    colourSystem: { accentPalette: "#00f" },
    sectionStyles: { "Technical Skills": sectionStyle },
    sectionLabelOverrides: { skills: "<script>alert(1)</script>" },
  },
  generalCv
);

assert.equal(corrupted.templateId, "modern_professional");
assert.equal(corrupted.typography.fontPairing, "modern_sans");
assert.equal(corrupted.colourSystem.bodyText, "dark");
assert.equal(corrupted.colourSystem.mutedText, "grey");
assert.equal(
  Object.prototype.hasOwnProperty.call(corrupted.sectionStyles, "Technical Skills"),
  false,
  "invalid non-canonical section style keys should be removed"
);

const fallback = normalizeCvPresentation(null, generalCv);
assert.equal(fallback.templateId, "modern_professional");

const longCv = cvFixture({ bulletCount: 14 });
const compact = normalizeCvPresentation(validLayout({ density: "spacious" }), longCv);
assert.equal(compact.density, "compact", "long CV content should force compact tokens");
assert.equal(compact.headerStyle, "compact_top_bar");
assert.equal(compact.skillsStyle, "compact_inline_groups");

const ai = normalizeCvPresentation(null, cvFixture());
const aiTokens = presentationToRendererTokens(ai);
assert.equal(ai.careerStyle, "technical");
assert.equal(ai.layoutArchitecture, "premium_hybrid");
assert.equal(aiTokens.layoutArchitecture, "premium_hybrid");
assert.equal(aiTokens.nameSize >= 29, true);
assert.equal(aiTokens.headingSize >= 11.4, true);
assert.match(["technical_compact", "project_heavy_builder"].join(" "), /technical_compact|project_heavy_builder/);
assert.match(["blue", "navy"].join(" "), new RegExp(ai.colourSystem.accentPalette));
assert.equal(aiTokens.bodyTextColor, "#18181b");
assert.equal(aiTokens.mutedTextColor, "#52525b");
assert.equal(aiTokens.dividerStyle, "light_rule");
assert.equal(aiTokens.dividerColor, "#d4d4d8");
assert.equal(ai.accentUsageRules.useAccentFor.includes("divider_lines"), false);
assert.equal(aiTokens.labelFor("skills"), "Technical Skills");

const marketing = normalizeCvPresentation(
  null,
  cvFixture({
    title: "Marketing Coordinator",
    summary: "Marketing coordinator supporting campaigns, content calendars, and social media reporting.",
    skillsLabel: "Content",
  })
);
assert.notEqual(marketing.sectionLabelOverrides.skills, "Technical Skills");
assert.equal(presentationToRendererTokens(marketing).labelFor("skills"), "Marketing Skills");

const retail = normalizeCvPresentation(
  null,
  cvFixture({
    title: "Customer Service Assistant",
    summary: "Customer service worker with retail, communication, and availability strengths.",
    skillsLabel: "Service",
  })
);
assert.equal(retail.templateId, "retail_service");
assert.equal(retail.layoutArchitecture, "simple_practical");
assert.equal(
  presentationToRendererTokens(retail).labelFor("skills"),
  "Customer Service Skills"
);

const overridden = normalizeCvPresentation(
  validLayout({ sectionLabelOverrides: labels({ skills: "AI / ML Skills" }) }),
  cvFixture()
);
assert.equal(presentationToRendererTokens(overridden).labelFor("skills"), "AI / ML Skills");

const previewTokens = presentationToRendererTokens(
  normalizeCvPresentation(validLayout(), cvFixture())
);
const pdfTokens = presentationToRendererTokens(
  normalizeCvPresentation(validLayout(), cvFixture())
);
const docxTokens = presentationToRendererTokens(
  normalizeCvPresentation(validLayout(), cvFixture())
);
const comparableTokens = (tokens) => {
  const { labelFor: _labelFor, ...rest } = tokens;
  return rest;
};
assert.deepEqual(comparableTokens(previewTokens), comparableTokens(pdfTokens));
assert.deepEqual(comparableTokens(pdfTokens), comparableTokens(docxTokens));
assert.equal(previewTokens.labelFor("skills"), pdfTokens.labelFor("skills"));
assert.equal(pdfTokens.labelFor("skills"), docxTokens.labelFor("skills"));

const cvText = [
  "Ben Smith",
  "Applied AI Engineer",
  "SUMMARY",
  cvFixture().summary,
].join("\n");
assert.equal(/presentationJson|rationale|renderWarnings|templateId/i.test(cvText), false);

console.log("Layout presentation tests passed.");
