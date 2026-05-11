export type CvHeader = {
  name: string | null;
  targetTitle: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  links: Array<{ label: string | null; url: string }>;
};

export type CvBulletClaim = {
  text: string;
  sourceChunkIds: string[];
  gapAnswerIds: string[];
};

export type CvSkillGroup = {
  group: string;
  skills: string[];
};

export type CvExperienceItem = {
  role: string | null;
  company: string | null;
  location: string | null;
  dates: string | null;
  startDate: string | null;
  endDate: string | null;
  bullets: CvBulletClaim[];
};

export type CvProjectItem = {
  name: string | null;
  descriptor: string | null;
  dates: string | null;
  bullets: CvBulletClaim[];
};

export type CvEducationItem = {
  institution: string | null;
  degree: string | null;
  dates: string | null;
  details: string[];
};

export type DynamicCvSection = {
  id: string;
  label: string;
  type:
    | "summary"
    | "bullets"
    | "experience"
    | "projects"
    | "skills"
    | "education"
    | "certifications"
    | "inline";
  priority: "primary" | "secondary" | "supporting";
  items: unknown[];
};

export type StructuredCv = {
  sectionOrder: string[];
  header: CvHeader;
  summary: string;
  skills: { groups: CvSkillGroup[] };
  experience: CvExperienceItem[];
  projects: CvProjectItem[];
  education: CvEducationItem[];
  certifications: string[];
  sections: DynamicCvSection[];
  roleArchetype: string | null;
};

export type CvSectionId =
  | "summary"
  | "projects"
  | "experience"
  | "skills"
  | "education"
  | "certifications";

const defaultSectionOrder: CvSectionId[] = [
  "summary",
  "projects",
  "experience",
  "skills",
  "education",
  "certifications",
];

export type NormalizedCvSection =
  | {
      id: string;
      label: string;
      type: "summary" | "inline";
      priority: "primary" | "secondary" | "supporting";
      paragraphs: string[];
    }
  | {
      id: string;
      label: string;
      type: "bullets" | "certifications";
      priority: "primary" | "secondary" | "supporting";
      bullets: CvBulletClaim[];
    }
  | {
      id: string;
      label: string;
      type: "experience";
      priority: "primary" | "secondary" | "supporting";
      items: CvExperienceItem[];
    }
  | {
      id: string;
      label: string;
      type: "projects";
      priority: "primary" | "secondary" | "supporting";
      items: CvProjectItem[];
    }
  | {
      id: string;
      label: string;
      type: "skills";
      priority: "primary" | "secondary" | "supporting";
      groups: CvSkillGroup[];
    }
  | {
      id: string;
      label: string;
      type: "education";
      priority: "primary" | "secondary" | "supporting";
      items: CvEducationItem[];
    };

export type CvContactKind =
  | "location"
  | "phone"
  | "email"
  | "linkedin"
  | "github"
  | "portfolio"
  | "link";

export type CvContactItem = {
  kind: CvContactKind;
  label: string;
  value: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function textArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
}

export function claimText(claim: CvBulletClaim) {
  return claim.text;
}

function parseClaim(value: unknown): CvBulletClaim | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { text, sourceChunkIds: [], gapAnswerIds: [] } : null;
  }
  if (!isRecord(value)) return null;
  const text = textOrNull(value.text) ?? textOrNull(value.content);
  if (!text) return null;

  return {
    text,
    sourceChunkIds: textArray(value.sourceChunkIds),
    gapAnswerIds: textArray(value.gapAnswerIds),
  };
}

function parseClaims(value: unknown): CvBulletClaim[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseClaim).filter((claim): claim is CvBulletClaim => !!claim);
}

function parseDates(value: Record<string, unknown>) {
  const dates = textOrNull(value.dates);
  const startDate = textOrNull(value.startDate);
  const endDate = textOrNull(value.endDate);
  return {
    dates:
      dates ??
      joinPresent([startDate, endDate], " - ") ??
      null,
    startDate,
    endDate,
  };
}

function parseHeader(value: unknown): CvHeader | null {
  if (!isRecord(value)) return null;

  const links = Array.isArray(value.links)
    ? value.links
        .filter(isRecord)
        .map((link) => ({
          label: textOrNull(link.label),
          url: textOrNull(link.url),
        }))
        .filter((link): link is { label: string | null; url: string } =>
          Boolean(link.url)
        )
    : [];

  return {
    name: textOrNull(value.name),
    targetTitle: textOrNull(value.targetTitle),
    location: textOrNull(value.location),
    phone: textOrNull(value.phone),
    email: textOrNull(value.email),
    links,
  };
}

function parseSkillGroups(value: unknown): CvSkillGroup[] | null {
  if (!isRecord(value) || !Array.isArray(value.groups)) return null;

  return value.groups
    .filter(isRecord)
    .map((group) => ({
      group: textOrNull(group.group) ?? textOrNull(group.label),
      skills: textArray(group.skills).length
        ? textArray(group.skills)
        : textArray(group.items),
    }))
    .filter(
      (group): group is CvSkillGroup =>
        Boolean(group.group) && group.skills.length > 0
    );
}

function parseExperience(value: unknown): CvExperienceItem[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((item) => {
      const dates = parseDates(item);
      return {
        role: textOrNull(item.role) ?? textOrNull(item.title),
        company: textOrNull(item.company) ?? textOrNull(item.organization),
        location: textOrNull(item.location),
        dates: dates.dates,
        startDate: dates.startDate,
        endDate: dates.endDate,
        bullets: parseClaims(item.bullets),
      };
    })
    .filter((item) => item.bullets.length > 0);
}

function parseProjects(value: unknown): CvProjectItem[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((item) => ({
      name: textOrNull(item.name),
      descriptor: textOrNull(item.descriptor),
      dates: textOrNull(item.dates),
      bullets: parseClaims(item.bullets),
    }))
    .filter((item) => item.bullets.length > 0);
}

function parseEducation(value: unknown): CvEducationItem[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((item) => ({
      institution: textOrNull(item.institution),
      degree: textOrNull(item.degree),
      dates: textOrNull(item.dates),
      details: textArray(item.details),
    }))
    .filter((item) =>
      Boolean(item.institution || item.degree || item.dates || item.details.length)
    );
}

function parseDynamicSections(value: unknown): DynamicCvSection[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((section) => {
      const id = textOrNull(section.id);
      const label = textOrNull(section.label);
      const type = textOrNull(section.type);
      const priority = textOrNull(section.priority);
      const items = Array.isArray(section.items) ? section.items : [];

      if (
        !id ||
        !label ||
        !type ||
        ![
          "summary",
          "bullets",
          "experience",
          "projects",
          "skills",
          "education",
          "certifications",
          "inline",
        ].includes(type) ||
        !priority ||
        !["primary", "secondary", "supporting"].includes(priority) ||
        items.length === 0
      ) {
        return null;
      }

      return {
        id,
        label,
        type: type as DynamicCvSection["type"],
        priority: priority as DynamicCvSection["priority"],
        items,
      };
    })
    .filter((section): section is DynamicCvSection => !!section);
}

export function parseStructuredCv(value: unknown): StructuredCv | null {
  if (!isRecord(value)) return null;

  const header = parseHeader(value.header);
  const sectionOrder = textArray(value.sectionOrder);
  const summary = textOrNull(value.summary);
  const skillGroups = parseSkillGroups(value.skills);
  const experience = parseExperience(value.experience);
  const projects = parseProjects(value.projects);
  const education = parseEducation(value.education);
  const certifications = textArray(value.certifications);
  const sections = parseDynamicSections(value.sections);
  const roleArchetype = textOrNull(value.roleArchetype);

  if (
    !header ||
    sectionOrder.length === 0 ||
    !summary ||
    !skillGroups ||
    !experience ||
    !projects ||
    !education
  ) {
    return null;
  }

  return {
    sectionOrder,
    header,
    summary,
    skills: { groups: skillGroups },
    experience,
    projects,
    education,
    certifications,
    sections,
    roleArchetype,
  };
}

export function joinPresent(
  values: Array<string | null | undefined>,
  separator: string
) {
  const joined = values.filter(Boolean).join(separator);
  return joined || "";
}

export function linkText(link: { label: string | null; url: string }) {
  return link.label && link.label !== link.url
    ? `${link.label}: ${link.url}`
    : link.url;
}

function linkKind(link: { label: string | null; url: string }): CvContactKind {
  const value = `${link.label ?? ""} ${link.url}`.toLowerCase();
  if (value.includes("linkedin")) return "linkedin";
  if (value.includes("github")) return "github";
  if (value.includes("portfolio")) return "portfolio";
  return "link";
}

export function contactItems(header: CvHeader): CvContactItem[] {
  return [
    header.location
      ? { kind: "location" as const, label: "Location", value: header.location }
      : null,
    header.phone ? { kind: "phone" as const, label: "Phone", value: header.phone } : null,
    header.email ? { kind: "email" as const, label: "Email", value: header.email } : null,
    ...header.links.map((link) => ({
      kind: linkKind(link),
      label: link.label ?? "Link",
      value: linkText(link),
    })),
  ].filter((item): item is CvContactItem => !!item);
}

export function normalizeSectionId(section: string): CvSectionId | null {
  const normalized = section.toLowerCase().replace(/[^a-z]+/g, " ").trim();

  if (!normalized || normalized === "header") return null;
  if (normalized === "summary" || normalized === "professional summary") {
    return "summary";
  }
  if (
    normalized === "project" ||
    normalized === "projects" ||
    normalized === "selected project" ||
    normalized === "selected projects"
  ) {
    return "projects";
  }
  if (normalized === "experience" || normalized === "work experience") {
    return "experience";
  }
  if (normalized === "skill" || normalized === "skills") return "skills";
  if (normalized === "education") return "education";
  if (normalized === "certification" || normalized === "certifications") {
    return "certifications";
  }

  return null;
}

function archetypeSectionOrder(roleArchetype?: string | null): CvSectionId[] {
  const normalized = (roleArchetype ?? "").toLowerCase();
  if (/\b(ai|software|data|technical|engineer|developer|backend|frontend|full.?stack|llm|rag)\b/.test(normalized)) {
    return ["summary", "projects", "skills", "experience", "education", "certifications"];
  }
  if (/\b(product|product manager|pm)\b/.test(normalized)) {
    return ["summary", "projects", "experience", "skills", "education", "certifications"];
  }
  if (/\b(teacher|teaching|education|academic)\b/.test(normalized)) {
    return ["summary", "experience", "education", "skills", "certifications", "projects"];
  }
  if (/\b(clinical|health|healthcare|nurse|medical)\b/.test(normalized)) {
    return ["summary", "experience", "certifications", "skills", "education", "projects"];
  }
  if (/\b(sales|retail|hospitality|service)\b/.test(normalized)) {
    return ["summary", "experience", "skills", "projects", "education", "certifications"];
  }
  if (/\b(trades|trade|construction|electrical|plumbing|mechanic)\b/.test(normalized)) {
    return ["summary", "certifications", "experience", "skills", "education", "projects"];
  }
  if (/\b(finance|accounting|analyst|banking)\b/.test(normalized)) {
    return ["summary", "experience", "skills", "projects", "education", "certifications"];
  }
  return defaultSectionOrder;
}

export function orderedSections(sectionOrder: string[], roleArchetype?: string | null) {
  const sections: CvSectionId[] = [];

  for (const section of sectionOrder) {
    const normalized = normalizeSectionId(section);
    if (normalized && !sections.includes(normalized)) {
      sections.push(normalized);
    }
  }

  for (const section of archetypeSectionOrder(roleArchetype)) {
    if (!sections.includes(section)) sections.push(section);
  }

  return sections;
}

function nonEmptyPriority(value: unknown): DynamicCvSection["priority"] {
  return value === "primary" || value === "secondary" || value === "supporting"
    ? value
    : "secondary";
}

function parseDynamicSkills(items: unknown[]) {
  return items
    .filter(isRecord)
    .map((item) => ({
      group: textOrNull(item.group) ?? textOrNull(item.label),
      skills: textArray(item.skills).length
        ? textArray(item.skills)
        : textArray(item.items),
    }))
    .filter(
      (item): item is CvSkillGroup =>
        Boolean(item.group) && item.skills.length > 0
    );
}

function parseDynamicExperience(items: unknown[]) {
  return items
    .filter(isRecord)
    .map((item) => {
      const dates = parseDates(item);
      return {
        role: textOrNull(item.role) ?? textOrNull(item.title),
        company: textOrNull(item.company) ?? textOrNull(item.organization),
        location: textOrNull(item.location),
        dates: dates.dates,
        startDate: dates.startDate,
        endDate: dates.endDate,
        bullets: parseClaims(item.bullets),
      };
    })
    .filter((item) => item.bullets.length > 0);
}

function parseDynamicProjects(items: unknown[]) {
  return items
    .filter(isRecord)
    .map((item) => ({
      name: textOrNull(item.name) ?? textOrNull(item.title),
      descriptor: textOrNull(item.descriptor),
      dates: textOrNull(item.dates),
      bullets: parseClaims(item.bullets).length
        ? parseClaims(item.bullets)
        : parseClaims(item.items),
    }))
    .filter((item) => item.bullets.length > 0);
}

function parseDynamicEducation(items: unknown[]) {
  return items
    .filter(isRecord)
    .map((item) => ({
      institution: textOrNull(item.institution),
      degree: textOrNull(item.degree) ?? textOrNull(item.credential),
      dates: textOrNull(item.dates),
      details: textArray(item.details).length
        ? textArray(item.details)
        : textArray(item.items),
    }))
    .filter((item) =>
      Boolean(item.institution || item.degree || item.dates || item.details.length)
    );
}

export function normalizeCvSections(cv: StructuredCv): NormalizedCvSection[] {
  const dynamic = cv.sections
    .map((section): NormalizedCvSection | null => {
      const priority = nonEmptyPriority(section.priority);
      if (section.type === "summary" || section.type === "inline") {
        const paragraphs = section.items
          .map((item) =>
            typeof item === "string"
              ? item.trim()
              : isRecord(item)
                ? textOrNull(item.text) ?? textOrNull(item.content)
                : null
          )
          .filter((item): item is string => !!item);
        if (!paragraphs.length) return null;
        return { id: section.id, label: section.label, type: section.type, priority, paragraphs };
      }
      if (section.type === "bullets" || section.type === "certifications") {
        const bullets = parseClaims(section.items);
        if (!bullets.length) return null;
        return { id: section.id, label: section.label, type: section.type, priority, bullets };
      }
      if (section.type === "experience") {
        const items = parseDynamicExperience(section.items);
        if (!items.length) return null;
        return { id: section.id, label: section.label, type: "experience", priority, items };
      }
      if (section.type === "projects") {
        const items = parseDynamicProjects(section.items);
        if (!items.length) return null;
        return { id: section.id, label: section.label, type: "projects", priority, items };
      }
      if (section.type === "skills") {
        const groups = parseDynamicSkills(section.items);
        if (!groups.length) return null;
        return { id: section.id, label: section.label, type: "skills", priority, groups };
      }
      if (section.type === "education") {
        const items = parseDynamicEducation(section.items);
        if (!items.length) return null;
        return { id: section.id, label: section.label, type: "education", priority, items };
      }
      return null;
    })
    .filter((section): section is NormalizedCvSection => !!section);

  const canonical = orderedSections(cv.sectionOrder, cv.roleArchetype)
    .map((section): NormalizedCvSection | null => {
      if (section === "summary") {
        return {
          id: "summary",
          label: "Profile",
          type: "summary",
          priority: "primary",
          paragraphs: [cv.summary],
        };
      }
      if (section === "projects" && cv.projects.length > 0) {
        return {
          id: "projects",
          label: "Selected Projects",
          type: "projects",
          priority: "primary",
          items: cv.projects,
        };
      }
      if (section === "experience" && cv.experience.length > 0) {
        return {
          id: "experience",
          label: "Experience",
          type: "experience",
          priority: "secondary",
          items: cv.experience,
        };
      }
      if (section === "skills" && cv.skills.groups.length > 0) {
        return {
          id: "skills",
          label: "Technical Skills",
          type: "skills",
          priority: "secondary",
          groups: cv.skills.groups,
        };
      }
      if (section === "education" && cv.education.length > 0) {
        return {
          id: "education",
          label: "Education",
          type: "education",
          priority: "supporting",
          items: cv.education,
        };
      }
      if (section === "certifications" && cv.certifications.length > 0) {
        return {
          id: "certifications",
          label: "Certifications",
          type: "certifications",
          priority: "supporting",
          bullets: cv.certifications.map((text) => ({
            text,
            sourceChunkIds: [],
            gapAnswerIds: [],
          })),
        };
      }
      return null;
    })
    .filter((section): section is NormalizedCvSection => !!section);

  if (dynamic.length > 0) {
    const dynamicIds = new Set(dynamic.map((section) => section.id));
    const dynamicTypes = new Set(dynamic.map((section) => section.type));
    return [
      ...dynamic,
      ...canonical.filter(
        (section) => !dynamicIds.has(section.id) && !dynamicTypes.has(section.type)
      ),
    ];
  }

  return canonical;
}
