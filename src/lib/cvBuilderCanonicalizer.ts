import { isRecord, textArray, textOrNull } from "./cvDocument.ts";

type CvBuilderRecord = Record<string, unknown>;
type SectionPriority = "primary" | "secondary" | "supporting";
type SectionType =
  | "summary"
  | "inline"
  | "bullets"
  | "certifications"
  | "experience"
  | "projects"
  | "skills"
  | "education";

const sectionTypes = new Set<SectionType>([
  "summary",
  "inline",
  "bullets",
  "certifications",
  "experience",
  "projects",
  "skills",
  "education",
]);

function cleanText(value: string) {
  return value.replace(/—/g, "-").replace(/\s+/g, " ").trim();
}

function cleanTextOrNull(value: unknown) {
  const text = textOrNull(value);
  return text ? cleanText(text) : null;
}

function normalizePriority(value: unknown): SectionPriority {
  return value === "primary" || value === "secondary" || value === "supporting"
    ? value
    : "secondary";
}

function normalizeBullet(value: unknown) {
  const text =
    typeof value === "string"
      ? cleanText(value)
      : isRecord(value)
        ? cleanTextOrNull(value.text) ?? cleanTextOrNull(value.content)
        : null;
  if (!text) return null;

  return {
    text,
    sourceChunkIds: isRecord(value) ? textArray(value.sourceChunkIds) : [],
    gapAnswerIds: isRecord(value) ? textArray(value.gapAnswerIds) : [],
  };
}

function normalizeBullets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeBullet).filter((item): item is NonNullable<typeof item> => !!item);
}

function normalizeSkillGroups(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      group: cleanTextOrNull(item.group) ?? cleanTextOrNull(item.label),
      skills: textArray(item.skills).map(cleanText).filter(Boolean),
    }))
    .filter(
      (item): item is { group: string; skills: string[] } =>
        !!item.group && item.skills.length > 0
    );
}

function normalizeExperienceItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      role: cleanTextOrNull(item.role) ?? cleanTextOrNull(item.title),
      company: cleanTextOrNull(item.company) ?? cleanTextOrNull(item.organization),
      location: cleanTextOrNull(item.location),
      dates: cleanTextOrNull(item.dates),
      startDate: cleanTextOrNull(item.startDate),
      endDate: cleanTextOrNull(item.endDate),
      bullets: normalizeBullets(item.bullets),
    }))
    .filter((item) => item.bullets.length > 0);
}

function normalizeProjectItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      name: cleanTextOrNull(item.name) ?? cleanTextOrNull(item.title),
      descriptor: cleanTextOrNull(item.descriptor),
      dates: cleanTextOrNull(item.dates),
      bullets: normalizeBullets(item.bullets).length
        ? normalizeBullets(item.bullets)
        : normalizeBullets(item.items),
    }))
    .filter((item) => item.bullets.length > 0);
}

function normalizeEducationItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      institution: cleanTextOrNull(item.institution) ?? cleanTextOrNull(item.school),
      degree: cleanTextOrNull(item.degree) ?? cleanTextOrNull(item.credential),
      dates: cleanTextOrNull(item.dates),
      details: textArray(item.details).length
        ? textArray(item.details).map(cleanText).filter(Boolean)
        : textArray(item.items).map(cleanText).filter(Boolean),
    }))
    .filter((item) =>
      Boolean(item.institution || item.degree || item.dates || item.details.length)
    );
}

function normalizeCertifications(value: unknown) {
  return textArray(value).map(cleanText).filter(Boolean);
}

function normalizeSectionBase(section: CvBuilderRecord) {
  const id = cleanTextOrNull(section.id);
  const label = cleanTextOrNull(section.label);
  const type = cleanTextOrNull(section.type);
  if (!id || !label || !type || !sectionTypes.has(type as SectionType)) {
    return null;
  }
  return {
    id,
    label,
    type: type as SectionType,
    priority: normalizePriority(section.priority),
  };
}

function bulletSectionFrom(base: ReturnType<typeof normalizeSectionBase>, items: unknown) {
  if (!base) return null;
  const bullets = normalizeBullets(items);
  if (!bullets.length) return null;
  return {
    ...base,
    type: "bullets" as const,
    items: bullets,
  };
}

function normalizeSection(section: CvBuilderRecord, cvJson: CvBuilderRecord) {
  const base = normalizeSectionBase(section);
  if (!base) return null;

  const items = section.items;
  if (base.type === "summary" || base.type === "inline" || base.type === "bullets") {
    const bullets = normalizeBullets(items);
    return bullets.length ? { ...base, items: bullets } : null;
  }
  if (base.type === "certifications") {
    const bullets = normalizeBullets(items);
    if (bullets.length) return { ...base, items: bullets };
    const certifications = normalizeCertifications(cvJson.certifications).map((text) => ({
      text,
      sourceChunkIds: [],
      gapAnswerIds: [],
    }));
    return certifications.length ? { ...base, items: certifications } : null;
  }
  if (base.type === "experience") {
    const experience = normalizeExperienceItems(items);
    if (experience.length) return { ...base, items: experience };
    const topLevelExperience = normalizeExperienceItems(cvJson.experience);
    return topLevelExperience.length ? { ...base, items: topLevelExperience } : null;
  }
  if (base.type === "projects") {
    const projects = normalizeProjectItems(items);
    if (projects.length) return { ...base, items: projects };
    const topLevelProjects = normalizeProjectItems(cvJson.projects);
    if (topLevelProjects.length) return { ...base, items: topLevelProjects };
    return bulletSectionFrom(base, items);
  }
  if (base.type === "skills") {
    const groups = normalizeSkillGroups(items);
    if (groups.length) return { ...base, items: groups };
    const skills = isRecord(cvJson.skills) ? normalizeSkillGroups(cvJson.skills.groups) : [];
    return skills.length ? { ...base, items: skills } : null;
  }
  if (base.type === "education") {
    const education = normalizeEducationItems(items);
    if (education.length) return { ...base, items: education };
    const topLevelEducation = normalizeEducationItems(cvJson.education);
    if (topLevelEducation.length) return { ...base, items: topLevelEducation };
    return bulletSectionFrom(base, items);
  }
  return null;
}

function normalizeSections(value: unknown, cvJson: CvBuilderRecord) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((section) => normalizeSection(section, cvJson))
    .filter((section): section is NonNullable<typeof section> => !!section);
}

export function normalizeCvBuilderRawOutput(rawOutput: unknown) {
  if (!isRecord(rawOutput) || !isRecord(rawOutput.cvJson)) {
    return rawOutput;
  }

  const output = { ...rawOutput };
  const cvJson = { ...rawOutput.cvJson };
  const skills = isRecord(cvJson.skills) ? { ...cvJson.skills } : {};

  skills.groups = normalizeSkillGroups(skills.groups);
  cvJson.skills = skills;
  cvJson.experience = normalizeExperienceItems(cvJson.experience);
  cvJson.projects = normalizeProjectItems(cvJson.projects);
  cvJson.education = normalizeEducationItems(cvJson.education);
  cvJson.certifications = normalizeCertifications(cvJson.certifications);
  cvJson.sections = normalizeSections(cvJson.sections, cvJson);

  if (!Array.isArray(cvJson.sectionOrder) || textArray(cvJson.sectionOrder).length === 0) {
    cvJson.sectionOrder = (cvJson.sections as Array<{ id: string }>).map((section) => section.id);
  } else {
    cvJson.sectionOrder = textArray(cvJson.sectionOrder);
  }

  output.cvJson = cvJson;
  return output;
}
