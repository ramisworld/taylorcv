"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  joinPresent,
  linkText,
  orderedSections,
  parseStructuredCv,
  textArray,
  type CvSectionId,
  type StructuredCv,
} from "~/lib/cvDocument";
import { exportCvDocx, exportCvPdf } from "~/lib/cvExport";
import {
  normalizeCvPresentation,
  presentationToRendererTokens,
} from "~/lib/cvPresentation";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";
const dreamRoleExamples = [
  "Marketing Coordinator at Nike",
  "Financial Analyst at Deloitte",
  "Registered Nurse in Auckland",
  "Hotel Operations Manager at Hilton",
  "Primary School Teacher in Wellington",
  "Junior Architect at Warren and Mahoney",
  "Policy Advisor at MBIE",
  "Product Manager at Air New Zealand",
  "Sustainability Consultant at Beca",
  "UX Designer at Canva",
  "Graduate Software Developer at Xero",
  "Data Analyst Intern in Auckland",
  "Civil Engineer at Fulton Hogan",
  "HR Business Partner at Fonterra",
  "Sales Development Representative at Salesforce",
  "Lab Technician at Fisher & Paykel Healthcare",
];
const stages = [
  "landing",
  "job_input",
  "job_result",
  "candidate_input",
  "profile_confirmation",
  "match_strategy",
  "honest_read",
  "gap_questions",
  "cv_generating",
  "cv_editor",
] as const;
const stageLabels = [
  "Dream role",
  "Job",
  "Evidence",
  "Fit",
  "Gaps",
  "CV",
] as const;

type AppStage =
  | "landing"
  | "job_input"
  | "job_scanning"
  | "job_result"
  | "candidate_input"
  | "candidate_scanning"
  | "profile_confirmation"
  | "match_strategy"
  | "honest_read"
  | "gap_questions"
  | "cv_generating"
  | "cv_editor";
type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;
type GapAnswerDraft = {
  answerText: string;
  skipped?: boolean;
};
type CandidateProfileDraft =
  RouterInputs["application"]["confirmCandidateProfile"]["profile"];
type ChatMessage = {
  role: "agent" | "user";
  text: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function deriveStageFromState(state: ApplicationState | null): AppStage {
  if (!state?.application?.dreamRole) return "landing";
  if (!state.job) return "job_input";
  if (!state.candidateProfile) return "job_result";
  if (!state.candidateProfile.profileConfirmedAt) return "profile_confirmation";
  if (!state.requirementFitScores.length) return "profile_confirmation";
  if (state.cvDraft) return "cv_editor";
  if (state.gapQuestions.some((question) => question.status === "unanswered")) {
    return "match_strategy";
  }
  return "match_strategy";
}

function stageProgress(stage: AppStage) {
  if (stage === "landing") return 0;
  if (stage === "job_input" || stage === "job_scanning" || stage === "job_result") {
    return 1;
  }
  if (
    stage === "candidate_input" ||
    stage === "candidate_scanning" ||
    stage === "profile_confirmation"
  ) {
    return 2;
  }
  if (stage === "match_strategy" || stage === "honest_read") return 3;
  if (stage === "gap_questions") return 4;
  return 5;
}

function firstString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function answerQuality(answer: string) {
  const length = answer.trim().length;
  if (length >= 180) return { label: "Strong answer", tone: "text-emerald-300" };
  if (length >= 60) return { label: "Good detail", tone: "text-cyan-200" };
  return { label: "Needs more detail", tone: "text-amber-200" };
}

function readableParagraphs(text: string) {
  const explicitParagraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) return explicitParagraphs;

  const sentences =
    text
      .trim()
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];

  if (sentences.length <= 2) return [text.trim()].filter(Boolean);

  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (current && next.length > 190) {
      paragraphs.push(current);
      current = sentence;
      continue;
    }
    current = next;
  }

  if (current) paragraphs.push(current);
  return paragraphs.length > 0 ? paragraphs : [text.trim()].filter(Boolean);
}

function uniqueItems(items: Array<string | null | undefined>, max = 6) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= max) break;
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function textFromRecord(value: unknown, key: string) {
  return isRecord(value) ? firstString(value[key]) : null;
}

function arrayFromJson(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function emptyCandidateProfileDraft(): CandidateProfileDraft {
  return {
    contactInfo: {
      fullName: null,
      professionalTitle: null,
      location: null,
      email: null,
      phone: null,
    },
    links: {
      linkedin: null,
      github: null,
      portfolio: null,
      other: [],
    },
    sourceSummary: null,
    summary: "Candidate profile details confirmed by the user.",
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    tools: [],
    achievements: [],
  };
}

function initialManualProfileDraft(): CandidateProfileDraft {
  return {
    ...emptyCandidateProfileDraft(),
    education: [
      {
        institution: null,
        credential: null,
        degree: null,
        startYear: null,
        endYear: null,
        current: false,
        expected: false,
        details: null,
        coursework: [],
        notes: null,
      },
    ],
    experience: [],
    projects: [],
    certifications: [],
  };
}

function candidateProfileDraftFromState(
  profile: ApplicationState["candidateProfile"] | null | undefined
): CandidateProfileDraft {
  const draft = emptyCandidateProfileDraft();
  if (!profile) return draft;

  const contactInfo = isRecord(profile.contactInfoJson)
    ? profile.contactInfoJson
    : {};
  const links = isRecord(profile.linksJson) ? profile.linksJson : {};

  return {
    ...draft,
    contactInfo: {
      fullName: textFromRecord(contactInfo, "fullName"),
      professionalTitle: textFromRecord(contactInfo, "professionalTitle"),
      location: textFromRecord(contactInfo, "location"),
      email: textFromRecord(contactInfo, "email"),
      phone: textFromRecord(contactInfo, "phone"),
    },
    links: {
      linkedin: textFromRecord(links, "linkedin"),
      github: textFromRecord(links, "github"),
      portfolio: textFromRecord(links, "portfolio"),
      other: arrayFromJson(links.other)
        .filter(isRecord)
        .map((link) => ({
          label: textFromRecord(link, "label"),
          url: textFromRecord(link, "url") ?? "",
        }))
        .filter((link) => link.url),
    },
    sourceSummary: profile.sourceSummary,
    summary: profile.summary || draft.summary,
    skills: stringArray(profile.skillsJson),
    projects: arrayFromJson(profile.projectsJson).filter(isRecord).map((project) => ({
      name: textFromRecord(project, "name"),
      description:
        textFromRecord(project, "description") ?? "Project details provided by the candidate.",
      tools: stringArray(project.tools),
      outcomes: stringArray(project.outcomes),
      links: stringArray(project.links),
    })),
    experience: arrayFromJson(profile.experienceJson).filter(isRecord).map((item) => ({
      role: textFromRecord(item, "role"),
      organization: textFromRecord(item, "organization"),
      startDate: textFromRecord(item, "startDate"),
      endDate: textFromRecord(item, "endDate"),
      current: item.current === true,
      description:
        textFromRecord(item, "description") ??
        stringArray(item.bullets).join(" ") ??
        "Experience details provided by the candidate.",
      bullets: stringArray(item.bullets),
      technologies: stringArray(item.technologies),
      tools: stringArray(item.tools),
      achievements: stringArray(item.achievements),
      outcomes: stringArray(item.outcomes),
    })),
    education: arrayFromJson(profile.educationJson).filter(isRecord).map((item) => ({
      institution: textFromRecord(item, "institution"),
      credential: textFromRecord(item, "credential"),
      degree: textFromRecord(item, "degree") ?? textFromRecord(item, "credential"),
      startYear: textFromRecord(item, "startYear"),
      endYear: textFromRecord(item, "endYear"),
      current: item.current === true,
      expected: item.expected === true,
      details: textFromRecord(item, "details"),
      coursework: stringArray(item.coursework),
      notes: textFromRecord(item, "notes"),
    })),
    certifications: arrayFromJson(profile.certificationsJson)
      .filter(isRecord)
      .map((item) => ({
        name: textFromRecord(item, "name") ?? "Certification",
        issuer: textFromRecord(item, "issuer"),
        date: textFromRecord(item, "date"),
        status: textFromRecord(item, "status"),
        details: textFromRecord(item, "details"),
      })),
    tools: stringArray(profile.toolsJson),
    achievements: stringArray(profile.achievementsJson),
  };
}

function profileMissingEssentials(profile: CandidateProfileDraft) {
  return [
    ["Full name", profile.contactInfo.fullName],
    ["Professional title / specialty", profile.contactInfo.professionalTitle],
    ["Location", profile.contactInfo.location],
    ["Preferred email", profile.contactInfo.email],
  ]
    .filter(([, value]) => !firstString(value))
    .map(([label]) => label);
}

function hasTechSignals(profile: CandidateProfileDraft) {
  const haystack = [
    profile.contactInfo.professionalTitle,
    profile.summary,
    ...profile.skills,
    ...profile.tools,
    ...profile.projects.flatMap((project) => project.tools),
  ]
    .join(" ")
    .toLowerCase();

  return /\b(software|developer|engineer|data|ai|ml|cloud|github|react|typescript|python|java|api|frontend|backend|full-stack|fullstack)\b/.test(
    haystack
  );
}

function manualProfileToText(profile: CandidateProfileDraft, extra: string) {
  const lines = [
    `Full name: ${profile.contactInfo.fullName ?? ""}`,
    `Professional title: ${profile.contactInfo.professionalTitle ?? ""}`,
    `Location: ${profile.contactInfo.location ?? ""}`,
    `Email: ${profile.contactInfo.email ?? ""}`,
    `Phone: ${profile.contactInfo.phone ?? ""}`,
    `LinkedIn: ${profile.links.linkedin ?? ""}`,
    `GitHub: ${profile.links.github ?? ""}`,
    `Portfolio: ${profile.links.portfolio ?? ""}`,
    "",
    "Education:",
    ...profile.education.map(
      (item) =>
        `${item.institution ?? ""} | ${item.degree ?? item.credential ?? ""} | ${item.startYear ?? ""}-${item.endYear ?? ""} | ${item.notes ?? item.details ?? ""}`
    ),
    "",
    "Experience:",
    ...profile.experience.map(
      (item) =>
        `${item.role ?? ""} at ${item.organization ?? ""} | ${item.startDate ?? ""}-${item.current ? "Current" : item.endDate ?? ""} | ${item.description} ${item.bullets.join(" ")}`
    ),
    "",
    "Projects:",
    ...profile.projects.map(
      (item) =>
        `${item.name ?? ""}: ${item.description}. Tools: ${item.tools.join(", ")}. Outcomes: ${item.outcomes.join(" ")}`
    ),
    "",
    "Certifications:",
    ...profile.certifications.map(
      (item) =>
        `${item.name} | ${item.issuer ?? ""} | ${item.date ?? item.status ?? ""}`
    ),
    "",
    "Skills:",
    profile.skills.join(", "),
    "",
    "Tools:",
    profile.tools.join(", "),
    "",
    "Achievements:",
    profile.achievements.join("\n"),
    "",
    "Anything else Taylor should know:",
    extra,
  ];

  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}

function sanitizeProfileDraft(profile: CandidateProfileDraft): CandidateProfileDraft {
  const clean = (value: string | null | undefined) => firstString(value);
  const summary =
    clean(profile.summary) ??
    clean(
      [
        profile.contactInfo.professionalTitle,
        profile.contactInfo.location,
        ...profile.skills.slice(0, 4),
      ]
        .filter(Boolean)
        .join(" ")
    ) ??
    "Candidate profile details confirmed by the user.";

  return {
    contactInfo: {
      fullName: clean(profile.contactInfo.fullName),
      professionalTitle: clean(profile.contactInfo.professionalTitle),
      location: clean(profile.contactInfo.location),
      email: clean(profile.contactInfo.email),
      phone: clean(profile.contactInfo.phone),
    },
    links: {
      linkedin: clean(profile.links.linkedin),
      github: clean(profile.links.github),
      portfolio: clean(profile.links.portfolio),
      other: profile.links.other
        .map((link) => ({ label: clean(link.label), url: clean(link.url) ?? "" }))
        .filter((link) => link.url),
    },
    sourceSummary: clean(profile.sourceSummary),
    summary,
    skills: uniqueItems(profile.skills.map(clean), 40),
    projects: profile.projects
      .map((project) => ({
        name: clean(project.name),
        description:
          clean(project.description) ??
          clean(project.outcomes.join(" ")) ??
          clean(project.name) ??
          "Project details provided by the candidate.",
        tools: uniqueItems(project.tools.map(clean), 30),
        outcomes: uniqueItems(project.outcomes.map(clean), 20),
        links: uniqueItems(project.links.map(clean), 10),
      }))
      .filter(
        (project) =>
          project.name ||
          project.description !== "Project details provided by the candidate." ||
          project.tools.length > 0 ||
          project.outcomes.length > 0
      ),
    experience: profile.experience
      .map((item) => ({
        role: clean(item.role),
        organization: clean(item.organization),
        startDate: clean(item.startDate),
        endDate: item.current ? null : clean(item.endDate),
        current: item.current,
        description:
          clean(item.description) ??
          clean(item.bullets.join(" ")) ??
          "Experience details provided by the candidate.",
        bullets: uniqueItems(item.bullets.map(clean), 20),
        technologies: uniqueItems(item.technologies.map(clean), 30),
        tools: uniqueItems(item.tools.map(clean), 30),
        achievements: uniqueItems(item.achievements.map(clean), 20),
        outcomes: uniqueItems(item.outcomes.map(clean), 20),
      }))
      .filter(
        (item) =>
          item.role ||
          item.organization ||
          item.description !== "Experience details provided by the candidate." ||
          item.bullets.length > 0
      ),
    education: profile.education
      .map((item) => ({
        institution: clean(item.institution),
        credential: clean(item.credential ?? item.degree),
        degree: clean(item.degree ?? item.credential),
        startYear: clean(item.startYear),
        endYear: clean(item.endYear),
        current: item.current,
        expected: item.expected,
        details: clean(item.details),
        coursework: uniqueItems(item.coursework.map(clean), 20),
        notes: clean(item.notes),
      }))
      .filter((item) => item.institution || item.degree || item.credential),
    certifications: profile.certifications
      .map((item) => ({
        name: clean(item.name) ?? "Certification",
        issuer: clean(item.issuer),
        date: clean(item.date),
        status: clean(item.status),
        details: clean(item.details),
      }))
      .filter((item) => item.name !== "Certification" || item.issuer || item.date || item.status),
    tools: uniqueItems(profile.tools.map(clean), 40),
    achievements: uniqueItems(profile.achievements.map(clean), 30),
  };
}

function SectionShell(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-5 py-6",
        props.className
      )}
      exit={{ opacity: 0, y: -18, scale: 0.985 }}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="mb-7 max-w-3xl">
        {props.eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            {props.eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.children}
    </motion.section>
  );
}

function GlassPanel(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/25 backdrop-blur-2xl",
        "rounded-lg",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-white/10 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  );
}

function TopRail(props: {
  stage: AppStage;
  onReset: () => void;
  resetDisabled?: boolean;
}) {
  const current = stageProgress(props.stage);
  const { isSignedIn } = useAuth();

  return (
    <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Taylor CV</p>
          <p className="text-xs text-zinc-400">CV tailoring assistant</p>
        </div>
      </div>
      <nav className="hidden items-center gap-2 md:flex">
        {stageLabels.map((label, index) => {
          const isDone = index < current;
          const isCurrent = index === current;
          return (
            <div className="flex items-center gap-2" key={label}>
              <span
                className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[11px] font-semibold",
                  isCurrent
                    ? "border-cyan-200 bg-cyan-200 text-zinc-950 shadow-[0_0_28px_rgba(103,232,249,0.35)]"
                    : isDone
                      ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-zinc-500"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-xs",
                  isCurrent ? "text-white" : isDone ? "text-zinc-300" : "text-zinc-500"
                )}
              >
                {label}
              </span>
              {index < stageLabels.length - 1 ? (
                <span className="mx-1 h-px w-8 bg-white/10" />
              ) : null}
            </div>
          );
        })}
      </nav>
      <SecondaryButton
        className="px-3 py-2 text-xs"
        disabled={props.resetDisabled}
        onClick={props.onReset}
        type="button"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        New CV
      </SecondaryButton>
      <div className="hidden items-center gap-2 md:flex">
        {isSignedIn ? (
          <>
          <a
            className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/[0.1]"
            href="/hub"
          >
            Hub
          </a>
          <UserButton />
          </>
        ) : (
          <SignInButton mode="modal">
            <button
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/[0.1]"
              type="button"
            >
              Sign in
            </button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}

function DreamRoleInput(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [typedExample, setTypedExample] = useState("");
  const [isDeletingExample, setIsDeletingExample] = useState(false);

  useEffect(() => {
    if (props.value.trim()) return;

    const currentExample = dreamRoleExamples[exampleIndex] ?? "";
    const isFullyTyped = typedExample === currentExample;
    const isEmpty = typedExample.length === 0;
    const delay = isFullyTyped
      ? 1300
      : isDeletingExample
        ? 24
        : 48;

    const timeout = window.setTimeout(() => {
      if (!isDeletingExample && !isFullyTyped) {
        setTypedExample(currentExample.slice(0, typedExample.length + 1));
        return;
      }

      if (!isDeletingExample && isFullyTyped) {
        setIsDeletingExample(true);
        return;
      }

      if (isDeletingExample && !isEmpty) {
        setTypedExample(currentExample.slice(0, typedExample.length - 1));
        return;
      }

      setIsDeletingExample(false);
      setExampleIndex((current) => (current + 1) % dreamRoleExamples.length);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [exampleIndex, isDeletingExample, props.value, typedExample]);

  return (
    <GlassPanel className="max-w-3xl p-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="min-h-16 flex-1 rounded-lg border border-white/10 bg-black/30 px-5 text-lg text-white outline-none ring-0 placeholder:text-zinc-500 focus:border-cyan-200/60"
          onChange={(event) => props.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onSubmit();
          }}
          placeholder={`${typedExample || "Dream role"}▌`}
          value={props.value}
        />
        <PrimaryButton
          className="min-h-16 px-6"
          disabled={props.isLoading || !props.value.trim()}
          onClick={props.onSubmit}
          type="button"
        >
          {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Start my CV
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </GlassPanel>
  );
}

function TextDropPanel(props: {
  title: string;
  subtitle: string;
  helperTitle: string;
  helperBullets: string[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  uploadLabel: string;
  maxLength: number;
  isLoading?: boolean;
  onFile?: (file: File) => void;
  accept?: string;
  error?: string | null;
}) {
  return (
    <GlassPanel className="grid max-h-[70vh] grid-cols-1 overflow-hidden lg:grid-cols-[0.72fr_1.28fr]">
      <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-200/10 text-cyan-100">
          <FileText className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">{props.title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">{props.subtitle}</p>
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-cyan-100">{props.helperTitle}</p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-300">
            {props.helperBullets.map((bullet) => (
              <li className="flex gap-2" key={bullet}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]">
          <Upload className="h-4 w-4" />
          {props.uploadLabel}
          <input
            accept={props.accept}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onFile?.(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        {props.error ? (
          <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
            {props.error}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-col p-4">
        <textarea
          className="min-h-[340px] flex-1 resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
          maxLength={props.maxLength}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Paste it here. Messy is fine."
          value={props.value}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {props.value.length.toLocaleString()} / {props.maxLength.toLocaleString()}
          </p>
          <PrimaryButton
            disabled={props.isLoading || !props.value.trim()}
            onClick={props.onSubmit}
            type="button"
          >
            {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {props.submitLabel}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>
    </GlassPanel>
  );
}

function FormField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {props.label}
        {props.required ? <span className="text-amber-200">missing if blank</span> : null}
      </span>
      <input
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-200/60"
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        value={props.value}
      />
    </label>
  );
}

function CandidateSourceStage(props: {
  candidateText: string;
  candidateFileName: string | null;
  linkedinUrl: string;
  linkedinFallbackText: string;
  showLinkedInFallback: boolean;
  manualProfile: CandidateProfileDraft;
  manualExtra: string;
  error?: string | null;
  isLoading: boolean;
  isReadingFile: boolean;
  onCandidateText: (value: string) => void;
  onCandidateFile: (file: File) => void;
  onLinkedInUrl: (value: string) => void;
  onLinkedInFallbackText: (value: string) => void;
  onManualProfile: (value: CandidateProfileDraft) => void;
  onManualExtra: (value: string) => void;
  onUploadSubmit: () => void;
  onLinkedInSubmit: () => void;
  onManualSubmit: () => void;
}) {
  const [mode, setMode] = useState<"upload" | "linkedin" | "manual">("upload");
  const profile = props.manualProfile;
  const updateProfile = (patch: Partial<CandidateProfileDraft>) =>
    props.onManualProfile({ ...profile, ...patch });
  const updateContact = (
    key: keyof CandidateProfileDraft["contactInfo"],
    value: string
  ) =>
    updateProfile({
      contactInfo: { ...profile.contactInfo, [key]: value || null },
    });
  const updateLinks = (key: keyof CandidateProfileDraft["links"], value: string) =>
    updateProfile({
      links: { ...profile.links, [key]: value || null },
    });
  const updateEducation = (
    index: number,
    patch: Partial<CandidateProfileDraft["education"][number]>
  ) =>
    updateProfile({
      education: profile.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  const updateExperience = (
    index: number,
    patch: Partial<CandidateProfileDraft["experience"][number]>
  ) =>
    updateProfile({
      experience: profile.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  const updateProject = (
    index: number,
    patch: Partial<CandidateProfileDraft["projects"][number]>
  ) =>
    updateProfile({
      projects: profile.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  const updateCertification = (
    index: number,
    patch: Partial<CandidateProfileDraft["certifications"][number]>
  ) =>
    updateProfile({
      certifications: profile.certifications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });

  return (
    <SectionShell
      eyebrow="Candidate profile"
      title="Choose how Taylor should learn your background."
      subtitle="Upload is fastest. LinkedIn is useful when it works. Manual start is there when you want full control."
    >
      <div className="grid max-h-[74vh] min-h-0 gap-4 overflow-hidden lg:grid-cols-[0.42fr_0.58fr]">
        <div className="space-y-3 overflow-y-auto pr-1">
          {[
            {
              id: "upload" as const,
              title: "Upload current CV",
              copy: "Recommended. PDF, DOCX, TXT, or pasted CV text.",
              icon: Upload,
            },
            {
              id: "linkedin" as const,
              title: "Import LinkedIn URL",
              copy: "Public profile only, with paste fallback if blocked.",
              icon: FileText,
            },
            {
              id: "manual" as const,
              title: "Start from scratch",
              copy: "Guided sections for contact, education, work, and projects.",
              icon: MessageCircle,
            },
          ].map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition",
                  active
                    ? "border-cyan-200/50 bg-cyan-200/12 shadow-[0_0_28px_rgba(103,232,249,0.12)]"
                    : "border-white/10 bg-white/[0.05] hover:bg-white/[0.08]"
                )}
                key={option.id}
                onClick={() => setMode(option.id)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-cyan-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-white">
                      {option.title}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-zinc-400">
                      {option.copy}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <GlassPanel className="min-h-0 overflow-y-auto p-5">
          {mode === "upload" ? (
            <div>
              <h2 className="text-xl font-semibold text-white">Upload current CV</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Taylor will extract profile details first, then you can confirm
                what should appear on the final CV.
              </p>
              <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-200/30 bg-cyan-200/10 px-4 py-5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-200/15">
                {props.isReadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {props.isReadingFile
                  ? "Reading file..."
                  : props.candidateFileName ?? "Choose PDF, DOCX, TXT, or MD"}
                <input
                  accept=".txt,.md,.pdf,.doc,.docx"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) props.onCandidateFile(file);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </label>
              <textarea
                className="mt-4 min-h-[300px] w-full resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                maxLength={30_000}
                onChange={(event) => props.onCandidateText(event.target.value)}
                placeholder="Or paste your current CV text here."
                value={props.candidateText}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  {props.candidateText.length.toLocaleString()} / 30,000
                </p>
                <PrimaryButton
                  disabled={props.isLoading || props.isReadingFile || !props.candidateText.trim()}
                  onClick={props.onUploadSubmit}
                  type="button"
                >
                  {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Scan my CV
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </div>
          ) : null}

          {mode === "linkedin" ? (
            <div>
              <h2 className="text-xl font-semibold text-white">LinkedIn public profile</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Taylor will try the public URL without using your LinkedIn
                credentials. If LinkedIn blocks it, paste the visible profile
                text below.
              </p>
              <FormField
                label="LinkedIn URL"
                onChange={props.onLinkedInUrl}
                placeholder="https://www.linkedin.com/in/..."
                value={props.linkedinUrl}
              />
              {props.showLinkedInFallback ? (
                <div className="mt-4 rounded-lg border border-amber-200/20 bg-amber-200/10 p-3 text-sm leading-6 text-amber-50">
                  LinkedIn import did not work. Paste your LinkedIn
                  About/Experience/Education text here instead.
                </div>
              ) : null}
              <textarea
                className="mt-4 min-h-[260px] w-full resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                maxLength={30_000}
                onChange={(event) => props.onLinkedInFallbackText(event.target.value)}
                placeholder="Paste LinkedIn About, Experience, Education, Projects, Certifications, or Skills text here if needed."
                value={props.linkedinFallbackText}
              />
              <div className="mt-4 flex justify-end">
                <PrimaryButton
                  disabled={
                    props.isLoading ||
                    (!props.linkedinUrl.trim() && !props.linkedinFallbackText.trim())
                  }
                  onClick={props.onLinkedInSubmit}
                  type="button"
                >
                  {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Import profile
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </div>
          ) : null}

          {mode === "manual" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Start from scratch</h2>
              <details className="rounded-lg border border-white/10 bg-black/20 p-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                  Profile details
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Full name" onChange={(value) => updateContact("fullName", value)} required value={profile.contactInfo.fullName ?? ""} />
                  <FormField label="Professional title" onChange={(value) => updateContact("professionalTitle", value)} required value={profile.contactInfo.professionalTitle ?? ""} />
                  <FormField label="Location" onChange={(value) => updateContact("location", value)} required value={profile.contactInfo.location ?? ""} />
                  <FormField label="Email" onChange={(value) => updateContact("email", value)} required value={profile.contactInfo.email ?? ""} />
                  <FormField label="Phone" onChange={(value) => updateContact("phone", value)} value={profile.contactInfo.phone ?? ""} />
                  <FormField label="LinkedIn" onChange={(value) => updateLinks("linkedin", value)} value={profile.links.linkedin ?? ""} />
                  <FormField label="GitHub" onChange={(value) => updateLinks("github", value)} value={profile.links.github ?? ""} />
                  <FormField label="Portfolio" onChange={(value) => updateLinks("portfolio", value)} value={profile.links.portfolio ?? ""} />
                </div>
              </details>

              <details className="rounded-lg border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                  Education
                </summary>
                {(profile.education.length ? profile.education : [emptyCandidateProfileDraft().education[0]]).map((item, index) => (
                  <div className="mt-4 grid gap-4 md:grid-cols-2" key={index}>
                    <FormField label="Institution" onChange={(value) => updateEducation(index, { institution: value || null })} value={item?.institution ?? ""} />
                    <FormField label="Degree / programme" onChange={(value) => updateEducation(index, { degree: value || null, credential: value || null })} value={item?.degree ?? item?.credential ?? ""} />
                    <FormField label="Start year" onChange={(value) => updateEducation(index, { startYear: value || null })} value={item?.startYear ?? ""} />
                    <FormField label="End / expected year" onChange={(value) => updateEducation(index, { endYear: value || null })} value={item?.endYear ?? ""} />
                  </div>
                ))}
                <SecondaryButton
                  className="mt-4"
                  onClick={() =>
                    updateProfile({
                      education: [
                        ...profile.education,
                        {
                          institution: null,
                          credential: null,
                          degree: null,
                          startYear: null,
                          endYear: null,
                          current: false,
                          expected: false,
                          details: null,
                          coursework: [],
                          notes: null,
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  Add education
                </SecondaryButton>
              </details>

              <details className="rounded-lg border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                  Experience
                </summary>
                {profile.experience.map((item, index) => (
                  <div className="mt-4 grid gap-4 md:grid-cols-2" key={index}>
                    <FormField label="Role" onChange={(value) => updateExperience(index, { role: value || null })} value={item.role ?? ""} />
                    <FormField label="Company" onChange={(value) => updateExperience(index, { organization: value || null })} value={item.organization ?? ""} />
                    <FormField label="Start" onChange={(value) => updateExperience(index, { startDate: value || null })} value={item.startDate ?? ""} />
                    <FormField label="End / current" onChange={(value) => updateExperience(index, { endDate: value || null, current: /current/i.test(value) })} value={item.current ? "Current" : item.endDate ?? ""} />
                    <label className="md:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Description / bullets</span>
                      <textarea className="mt-2 min-h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-200/60" onChange={(event) => updateExperience(index, { description: event.target.value || "Experience details provided by the candidate.", bullets: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} value={item.bullets.join("\n") || item.description} />
                    </label>
                  </div>
                ))}
                <SecondaryButton
                  className="mt-4"
                  onClick={() =>
                    updateProfile({
                      experience: [
                        ...profile.experience,
                        {
                          role: null,
                          organization: null,
                          startDate: null,
                          endDate: null,
                          current: false,
                          description: "Experience details provided by the candidate.",
                          bullets: [],
                          technologies: [],
                          tools: [],
                          achievements: [],
                          outcomes: [],
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  Add experience
                </SecondaryButton>
              </details>

              <details className="rounded-lg border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
                  Projects and certifications
                </summary>
                {profile.projects.map((item, index) => (
                  <div className="mt-4 grid gap-4 md:grid-cols-2" key={`project-${index}`}>
                    <FormField label="Project name" onChange={(value) => updateProject(index, { name: value || null })} value={item.name ?? ""} />
                    <FormField label="Tools" onChange={(value) => updateProject(index, { tools: value.split(",").map((tool) => tool.trim()).filter(Boolean) })} value={item.tools.join(", ")} />
                    <label className="md:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Description / outcome</span>
                      <textarea className="mt-2 min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-200/60" onChange={(event) => updateProject(index, { description: event.target.value || "Project details provided by the candidate." })} value={item.description} />
                    </label>
                  </div>
                ))}
                <SecondaryButton
                  className="mt-4"
                  onClick={() =>
                    updateProfile({
                      projects: [
                        ...profile.projects,
                        {
                          name: null,
                          description: "Project details provided by the candidate.",
                          tools: [],
                          outcomes: [],
                          links: [],
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  Add project
                </SecondaryButton>
                {profile.certifications.map((item, index) => (
                  <div className="mt-4 grid gap-4 md:grid-cols-3" key={`cert-${index}`}>
                    <FormField label="Certification" onChange={(value) => updateCertification(index, { name: value || "Certification" })} value={item.name} />
                    <FormField label="Issuer" onChange={(value) => updateCertification(index, { issuer: value || null })} value={item.issuer ?? ""} />
                    <FormField label="Date / status" onChange={(value) => updateCertification(index, { date: value || null, status: value || null })} value={item.date ?? item.status ?? ""} />
                  </div>
                ))}
                <SecondaryButton
                  className="mt-4"
                  onClick={() =>
                    updateProfile({
                      certifications: [
                        ...profile.certifications,
                        {
                          name: "Certification",
                          issuer: null,
                          date: null,
                          status: null,
                          details: null,
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  Add certification
                </SecondaryButton>
              </details>

              <textarea
                className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                onChange={(event) => props.onManualExtra(event.target.value)}
                placeholder="Anything else Taylor should know?"
                value={props.manualExtra}
              />
              <PrimaryButton
                disabled={props.isLoading}
                onClick={props.onManualSubmit}
                type="button"
              >
                {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Scan manual profile
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </div>
          ) : null}

          {props.error ? (
            <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              {props.error}
            </p>
          ) : null}
        </GlassPanel>
      </div>
    </SectionShell>
  );
}

function ProfileConfirmationStage(props: {
  profile: CandidateProfileDraft;
  isAlreadyConfirmed: boolean;
  isLoading: boolean;
  onProfile: (profile: CandidateProfileDraft) => void;
  onSubmit: () => void;
}) {
  const profile = props.profile;
  const missing = profileMissingEssentials(profile);
  const techSignals = hasTechSignals(profile);
  const updateContact = (
    key: keyof CandidateProfileDraft["contactInfo"],
    value: string
  ) =>
    props.onProfile({
      ...profile,
      contactInfo: { ...profile.contactInfo, [key]: value || null },
    });
  const updateLinks = (key: keyof CandidateProfileDraft["links"], value: string) =>
    props.onProfile({
      ...profile,
      links: { ...profile.links, [key]: value || null },
    });

  return (
    <SectionShell
      eyebrow="Profile confirmation"
      title="Taylor found your profile details. Confirm what should appear on your CV."
      subtitle="Missing essentials are required before CV generation. Recommended fields improve the final header but will not block you."
    >
      <div className="grid max-h-[74vh] min-h-0 gap-5 overflow-hidden lg:grid-cols-[0.62fr_0.38fr]">
        <GlassPanel className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full name" onChange={(value) => updateContact("fullName", value)} required value={profile.contactInfo.fullName ?? ""} />
            <FormField label="Professional title / specialty" onChange={(value) => updateContact("professionalTitle", value)} required value={profile.contactInfo.professionalTitle ?? ""} />
            <FormField label="Location" onChange={(value) => updateContact("location", value)} required value={profile.contactInfo.location ?? ""} />
            <FormField label="Preferred email" onChange={(value) => updateContact("email", value)} required value={profile.contactInfo.email ?? ""} />
            <FormField label="Phone recommended" onChange={(value) => updateContact("phone", value)} value={profile.contactInfo.phone ?? ""} />
            <FormField label="LinkedIn recommended" onChange={(value) => updateLinks("linkedin", value)} value={profile.links.linkedin ?? ""} />
            {(techSignals || profile.links.github) ? (
              <FormField label="GitHub" onChange={(value) => updateLinks("github", value)} value={profile.links.github ?? ""} />
            ) : null}
            <FormField label="Portfolio" onChange={(value) => updateLinks("portfolio", value)} value={profile.links.portfolio ?? ""} />
          </div>

          <details className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
              Education
            </summary>
            {profile.education.length > 0 ? (
              <div className="mt-4 space-y-3">
                {profile.education.map((item, index) => (
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3" key={index}>
                    <p className="font-medium text-white">
                      {[item.degree ?? item.credential, item.institution]
                        .filter(Boolean)
                        .join(" - ") || "Education"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {[item.startYear, item.endYear].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">No education found yet.</p>
            )}
          </details>

          <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-cyan-100">
              Experience, projects, certifications, and skills
            </summary>
            <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-300">
              {profile.experience.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Experience</p>
                  {profile.experience.map((item, index) => (
                    <p key={index}>
                      {[item.role, item.organization].filter(Boolean).join(" - ") ||
                        item.description}
                    </p>
                  ))}
                </div>
              ) : null}
              {profile.projects.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Projects</p>
                  {profile.projects.map((item, index) => (
                    <p key={index}>{item.name ?? item.description}</p>
                  ))}
                </div>
              ) : null}
              {profile.certifications.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Certifications</p>
                  <p>{profile.certifications.map((item) => item.name).join(", ")}</p>
                </div>
              ) : null}
              <div>
                <p className="font-semibold text-white">Skills/tools</p>
                <p>{uniqueItems([...profile.skills, ...profile.tools], 18).join(", ") || "None found yet."}</p>
              </div>
            </div>
          </details>
        </GlassPanel>

        <GlassPanel className="min-h-0 overflow-y-auto p-5">
          <p className="text-sm font-semibold text-white">Profile readiness</p>
          <div className="mt-4 space-y-3">
            {["Full name", "Professional title / specialty", "Location", "Preferred email"].map((label) => {
              const isMissing = missing.includes(label);
              return (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-sm",
                    isMissing
                      ? "border-amber-200/20 bg-amber-200/10 text-amber-50"
                      : "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
                  )}
                  key={label}
                >
                  <span>{label}</span>
                  <span>{isMissing ? "Missing" : "Ready"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
            Phone and LinkedIn are recommended for a more complete CV header.
            GitHub is only suggested for technical profiles or when you provide it.
          </div>
          <PrimaryButton
            className="mt-5 w-full"
            disabled={props.isLoading || missing.length > 0}
            onClick={props.onSubmit}
            type="button"
          >
            {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {props.isAlreadyConfirmed
              ? "Continue to evidence match"
              : "Confirm profile details"}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </GlassPanel>
      </div>
    </SectionShell>
  );
}

function ScanningStage(props: {
  title: string;
  subtitle: string;
  messages: string[];
}) {
  return (
    <SectionShell title={props.title} subtitle={props.subtitle}>
      <GlassPanel className="max-w-3xl p-6">
        <ProgressChecklist items={props.messages} />
      </GlassPanel>
    </SectionShell>
  );
}

function ProgressChecklist(props: { items: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemKey = props.items.join("|");

  useEffect(() => {
    setCurrentIndex(0);
    if (props.items.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((current) =>
        Math.min(current + 1, props.items.length - 1)
      );
    }, 950);

    return () => window.clearInterval(interval);
  }, [itemKey, props.items.length]);

  return (
    <ol className="space-y-3">
      {props.items.map((item, index) => {
        const completed = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 transition",
              completed
                ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
                : current
                  ? "border-cyan-200/30 bg-cyan-200/10 text-white shadow-[0_0_28px_rgba(103,232,249,0.12)]"
                  : "border-white/10 bg-white/[0.04] text-zinc-500"
            )}
            key={item}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                completed
                  ? "border-emerald-200/30 bg-emerald-200/15 text-emerald-100"
                  : current
                    ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                    : "border-white/10 bg-white/[0.04] text-zinc-500"
              )}
            >
              {completed ? (
                <Check className="h-4 w-4" />
              ) : current ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            <span className="text-sm font-medium">{item}</span>
          </li>
        );
      })}
    </ol>
  );
}

function JobResultStage(props: {
  state: ApplicationState;
  onContinue: () => void;
}) {
  const profile = props.state.jobProfileSummary;

  return (
    <SectionShell
      eyebrow="Role profile"
      title={profile?.role ?? "I found the role profile."}
      subtitle="Here is the compact version of what Taylor will optimize around."
    >
      <GlassPanel className="max-w-4xl p-6">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm text-zinc-400">Role</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {profile?.role}
            </p>
            {profile?.company ? (
              <p className="mt-1 text-zinc-300">{profile.company}</p>
            ) : null}
            <p className="mt-5 text-sm leading-6 text-zinc-300">
              {profile?.summary}
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200/15 bg-emerald-200/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
                What they care about most
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-100">
                {profile?.topRequirements
                  ?.slice(0, 3)
                  .map((item) => item.label)
                  .join(", ") || "Clear evidence against the main requirements."}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200/15 bg-amber-200/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                Hidden hiring signal
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-100">
                {profile?.hiddenHiringSignal}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.topRequirements?.map((requirement) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-zinc-200"
                  key={requirement.id}
                >
                  {requirement.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <PrimaryButton onClick={props.onContinue} type="button">
            Continue
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </GlassPanel>
    </SectionShell>
  );
}

function MatchStrategyStage(props: {
  state: ApplicationState;
  onHonestRead: () => void;
  gapQuestionError?: string | null;
  onRetryGapQuestions?: () => void;
}) {
  const score = props.state.updatedEvidenceMatchScore ?? props.state.evidenceMatchScore.score;
  const strategy = props.state.cvStrategy;
  const weakSpots = props.state.weakSpots.slice(0, 3);
  const strongMatches = props.state.strongMatches.slice(0, 3);

  return (
    <SectionShell
      eyebrow="Evidence fit"
      title={`${score}% Evidence Match Score`}
      subtitle="Taylor has matched your evidence against the role and found the clearest positioning angle."
    >
      <div className="grid h-[68vh] min-h-0 gap-5 overflow-hidden lg:grid-cols-[0.78fr_1.22fr]">
        <GlassPanel className="min-h-0 overflow-y-auto p-6">
          <p className="text-sm font-medium text-zinc-300">Positioning angle</p>
          <p className="mt-3 text-2xl font-semibold leading-tight text-white">
            {strategy?.targetPositioning ??
              props.state.cvStrategy?.strategySummary ??
              "Lead with the strongest role-relevant evidence and avoid unsupported claims."}
          </p>
          <details className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              View score breakdown
            </summary>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Taylor checks each role requirement against the strongest evidence
              found in your background.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {props.state.evidenceMatchScore.earnedPoints.toFixed(2)} earned of{" "}
              {props.state.evidenceMatchScore.possiblePoints.toFixed(2)} possible
              weighted score points.
            </p>
          </details>
          <PrimaryButton
            className="mt-6 w-full"
            onClick={
              props.gapQuestionError && props.onRetryGapQuestions
                ? props.onRetryGapQuestions
                : props.onHonestRead
            }
            type="button"
          >
            {props.gapQuestionError ? "Retry gap check" : "Hear Taylor's honest read"}
            {props.gapQuestionError ? (
              <RefreshCcw className="h-4 w-4" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
          </PrimaryButton>
        </GlassPanel>
        <GlassPanel className="min-h-0 overflow-hidden p-5">
          <div className="grid h-full min-h-0 gap-4 md:grid-cols-2">
            <div className="min-h-0 overflow-y-auto pr-1">
              <p className="mb-3 text-sm font-semibold text-emerald-100">
                Strong matches
              </p>
              <div className="space-y-3">
                {strongMatches.map((match) => (
                  <div
                    className="rounded-lg border border-emerald-200/15 bg-emerald-200/10 p-3"
                    key={match.requirementId}
                  >
                    <p className="font-medium text-white">{match.requirementLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-300">
                      {match.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto pr-1">
              <p className="mb-3 text-sm font-semibold text-amber-100">
                Weak spots
              </p>
              <div className="space-y-3">
                {props.gapQuestionError ? (
                  <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 p-3 text-sm leading-6 text-amber-50">
                    The fit score is ready, but Taylor could not prepare the
                    clarification questions. Retry the gap check before creating
                    the CV so the weak spots are handled properly.
                  </div>
                ) : weakSpots.length > 0 ? (
                  weakSpots.map((spot) => (
                    <div
                      className="rounded-lg border border-amber-200/15 bg-amber-200/10 p-3"
                      key={spot.id}
                    >
                      <p className="font-medium text-white">{spot.label}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-300">
                        {spot.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-cyan-200/15 bg-cyan-200/10 p-3 text-sm text-zinc-200">
                    No meaningful clarification gaps were found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </SectionShell>
  );
}

function HonestReadStage(props: {
  state: ApplicationState;
  onClarify: () => void;
  onCreateCv: () => void;
}) {
  const hasQuestions = props.state.gapQuestions.some(
    (question) => question.status === "unanswered"
  );
  const message =
    props.state.gapCoachInsight?.openingMessage ??
    (hasQuestions
      ? "Here is the honest read: you have real evidence to work with. I only need a few precise answers to sharpen the claims and keep the CV truthful."
      : "You already have strong evidence for the main requirements. I do not need extra clarification - I can build the CV now.");
  const paragraphs = readableParagraphs(message);

  return (
    <SectionShell eyebrow="Taylor's read" title="Here is the honest read.">
      <GlassPanel className="max-w-3xl p-7">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-xl leading-8 text-zinc-100"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.45 }}
        >
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </motion.div>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-7"
          initial={{ opacity: 0, y: 8 }}
          transition={{ delay: 0.35, duration: 0.25 }}
        >
          <PrimaryButton
            onClick={hasQuestions ? props.onClarify : props.onCreateCv}
            type="button"
          >
            {hasQuestions ? "Clarify the gaps" : "Create my CV"}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </motion.div>
      </GlassPanel>
    </SectionShell>
  );
}

function GapQuestionsStage(props: {
  questions: ApplicationState["gapQuestions"];
  answers: Record<string, GapAnswerDraft>;
  onChange: (questionId: string, answer: GapAnswerDraft) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [index, setIndex] = useState(0);
  const question = props.questions[index];
  const answer = question
    ? props.answers[question.id] ?? { answerText: "" }
    : { answerText: "" };
  const quality = answerQuality(answer.answerText);

  if (!question) {
    return (
      <SectionShell title="No gaps to clarify.">
        <PrimaryButton onClick={props.onSubmit} type="button">
          Create my CV
        </PrimaryButton>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      eyebrow="Clarify the gaps"
      title={`Question ${index + 1} of ${props.questions.length}`}
      subtitle="Answer naturally. The goal is usable evidence, not perfect wording."
    >
      <GlassPanel className="max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-center gap-3">
          {props.questions.map((item, itemIndex) => {
            const draft = props.answers[item.id];
            const completed = !!draft?.answerText && draft.answerText.length >= 60;
            return (
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold",
                  itemIndex === index
                    ? "border-cyan-200 bg-cyan-200 text-zinc-950 shadow-[0_0_24px_rgba(103,232,249,0.35)]"
                    : completed
                      ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-zinc-500"
                )}
                key={item.id}
              >
                {completed ? <Check className="h-4 w-4" /> : itemIndex + 1}
              </span>
            );
          })}
        </div>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Question
              </p>
              <p className="mt-2 text-2xl font-semibold leading-tight text-white">
                {question.question}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-cyan-100">Why this matters</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {question.whyItMatters ?? question.reason}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-emerald-100">
                Example answer
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {textArray(question.exampleAnglesJson)[0] ??
                  question.answerGuidance ??
                  "Mention the context, what you personally did, tools used, and the outcome."}
              </p>
            </div>
          </div>
          <div className="flex min-h-[360px] flex-col">
            <textarea
              className="min-h-0 flex-1 resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
              onChange={(event) =>
                props.onChange(question.id, {
                  answerText: event.target.value,
                })
              }
              placeholder="Write the real example here. What happened, what did you do, and what changed?"
              value={answer.answerText}
            />
            <div className="mt-3 flex items-center justify-between">
              <p className={cn("text-sm font-medium", quality.tone)}>
                {quality.label}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <SecondaryButton
            disabled={index === 0 || props.isSubmitting}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </SecondaryButton>
          <PrimaryButton
            disabled={props.isSubmitting}
            onClick={() => {
              if (index < props.questions.length - 1) {
                setIndex((current) => current + 1);
                return;
              }
              props.onSubmit();
            }}
            type="button"
          >
            {props.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {index === props.questions.length - 1 ? "Create my CV" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </GlassPanel>
    </SectionShell>
  );
}

function CvPaper(props: {
  cv: StructuredCv;
  presentation?: unknown;
  onEditSummary?: (text: string) => void;
  compact?: boolean;
}) {
  const presentation = normalizeCvPresentation(props.presentation, props.cv);
  const tokens = presentationToRendererTokens(presentation);
  const meta = [
    props.cv.header.targetTitle,
    props.cv.header.location,
    props.cv.header.phone,
    props.cv.header.email,
    ...props.cv.header.links.map(linkText),
  ].filter(Boolean);
  const headerAlign = props.cv.header.name ? tokens.headerAlign : "left";

  function heading(section: CvSectionId) {
    return (
      <h2
        className="pb-1 uppercase tracking-normal"
        style={{
          borderBottom:
            tokens.dividerStyle === "no_rule"
              ? "0"
              : `1px solid ${tokens.dividerColor}`,
          color: tokens.accentColor,
          fontSize: tokens.headingSize,
          fontWeight: tokens.headingWeight,
        }}
      >
        {tokens.labelFor(section)}
      </h2>
    );
  }

  function bullets(items: string[]) {
    return (
      <ul
        className="mt-1.5 list-disc pl-5"
        style={{
          color: tokens.bodyTextColor,
          fontSize: tokens.bodySize,
          lineHeight: tokens.lineHeight,
        }}
      >
        {items.map((bullet, index) => (
          <li key={`${bullet}-${index}`} style={{ marginBottom: tokens.bulletGap }}>
            {bullet}
          </li>
        ))}
      </ul>
    );
  }

  function renderSection(section: CvSectionId) {
    if (section === "summary") {
      return (
        <section key="summary">
          {heading("summary")}
          <p
            className="mt-2 rounded-sm outline-cyan-500/40 focus:outline"
            contentEditable={!!props.onEditSummary}
            onBlur={(event) =>
              props.onEditSummary?.(event.currentTarget.textContent ?? "")
            }
            style={{
              color: tokens.bodyTextColor,
              fontSize: tokens.bodySize,
              lineHeight: tokens.lineHeight,
            }}
            suppressContentEditableWarning
          >
            {props.cv.summary}
          </p>
        </section>
      );
    }

    if (section === "projects" && props.cv.projects.length > 0) {
      return (
        <section key="projects">
          {heading("projects")}
          <div className="mt-2" style={{ display: "grid", gap: tokens.itemGap }}>
            {props.cv.projects.map((project, index) => {
              const title = joinPresent([project.name, project.descriptor], " - ");
              return (
                <div key={`${title}-${index}`}>
                  {title || project.dates ? (
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className="font-semibold leading-snug"
                        style={{
                          color: tokens.bodyTextColor,
                          fontSize: tokens.bodySize + 0.5,
                        }}
                      >
                        {title}
                      </p>
                      <p
                        style={{
                          color: tokens.mutedTextColor,
                          fontSize: tokens.subtitleSize,
                        }}
                      >
                        {project.dates}
                      </p>
                    </div>
                  ) : null}
                  {bullets(project.bullets)}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (section === "experience" && props.cv.experience.length > 0) {
      return (
        <section key="experience">
          {heading("experience")}
          <div className="mt-2" style={{ display: "grid", gap: tokens.itemGap }}>
            {props.cv.experience.map((item, index) => {
              const title = joinPresent([item.title, item.company], " - ");
              const metaText = joinPresent([item.dates, item.location], " | ");
              return (
                <div key={`${title}-${index}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className="font-semibold leading-snug"
                      style={{
                        color: tokens.bodyTextColor,
                        fontSize: tokens.bodySize + 0.5,
                      }}
                    >
                      {title}
                    </p>
                    <p
                      style={{
                        color: tokens.mutedTextColor,
                        fontSize: tokens.subtitleSize,
                      }}
                    >
                      {metaText}
                    </p>
                  </div>
                  {bullets(item.bullets)}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (section === "skills" && props.cv.skills.groups.length > 0) {
      return (
        <section key="skills">
          {heading("skills")}
          <dl
            className={cn(
              "mt-2",
              tokens.skillsStyle === "compact_inline_groups"
                ? "space-y-0.5"
                : "space-y-1"
            )}
            style={{
              color: tokens.bodyTextColor,
              fontSize: tokens.bodySize,
              lineHeight: tokens.lineHeight,
            }}
          >
            {props.cv.skills.groups.map((group) => (
              <div
                className={cn(
                  "grid gap-2",
                  tokens.skillsStyle === "compact_inline_groups"
                    ? "grid-cols-[92px_1fr]"
                    : "grid-cols-[120px_1fr]"
                )}
                key={group.label}
              >
                <dt className="font-semibold" style={{ color: tokens.accentColor }}>
                  {group.label}:
                </dt>
                <dd style={{ color: tokens.bodyTextColor }}>
                  {group.items.join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      );
    }

    if (section === "education" && props.cv.education.length > 0) {
      return (
        <section key="education">
          {heading("education")}
          <div className="mt-2" style={{ display: "grid", gap: tokens.itemGap }}>
            {props.cv.education.map((item, index) => (
              <div key={`${item.institution}-${index}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="font-semibold"
                    style={{
                      color: tokens.bodyTextColor,
                      fontSize: tokens.bodySize + 0.5,
                    }}
                  >
                    {joinPresent([item.degree, item.institution], " - ")}
                  </p>
                  <p
                    style={{
                      color: tokens.mutedTextColor,
                      fontSize: tokens.subtitleSize,
                    }}
                  >
                    {item.dates}
                  </p>
                </div>
                {item.details.length > 0 ? (
                  <p
                    style={{
                      color: tokens.bodyTextColor,
                      fontSize: tokens.bodySize,
                      lineHeight: tokens.lineHeight,
                    }}
                  >
                    {item.details.join("; ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (section === "certifications" && props.cv.certifications.length > 0) {
      return (
        <section key="certifications">
          {heading("certifications")}
          <p
            className="mt-2"
            style={{
              color: tokens.bodyTextColor,
              fontSize: tokens.bodySize,
              lineHeight: tokens.lineHeight,
            }}
          >
            {props.cv.certifications.join("; ")}
          </p>
        </section>
      );
    }

    return null;
  }

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[820px] bg-white text-zinc-950 shadow-2xl shadow-black/30",
        props.compact ? "px-8 py-7" : "min-h-[980px]"
      )}
      style={{
        color: tokens.bodyTextColor,
        fontFamily: tokens.fontFamily,
        padding: props.compact ? "28px 32px" : tokens.pagePaddingCss,
      }}
    >
      <header style={{ textAlign: headerAlign }}>
        {props.cv.header.name ? (
          <h1
            className="font-bold leading-tight tracking-normal"
            style={{
              color: tokens.bodyTextColor,
              fontSize: tokens.nameSize,
            }}
          >
            {props.cv.header.name}
          </h1>
        ) : null}
        {meta.length > 0 ? (
          <p
            className="mt-1 leading-5"
            style={{
              color: tokens.mutedTextColor,
              fontSize: tokens.subtitleSize,
            }}
          >
            {meta.join(" | ")}
          </p>
        ) : null}
      </header>
      <div
        className="mt-5"
        style={{ display: "grid", gap: tokens.sectionGap }}
      >
        {orderedSections(props.cv.sectionOrder).map(renderSection)}
      </div>
    </article>
  );
}

function sectionText(cv: StructuredCv | null, section: string) {
  if (!cv) return "";
  if (section === "summary") return cv.summary;
  if (section === "skills") {
    return cv.skills.groups
      .map((group) => `${group.label}: ${group.items.join(", ")}`)
      .join("\n");
  }
  if (section === "projects") {
    return cv.projects
      .map((project) =>
        [joinPresent([project.name, project.descriptor], " - "), ...project.bullets]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");
  }
  if (section === "experience") {
    return cv.experience
      .map((item) =>
        [joinPresent([item.title, item.company], " - "), ...item.bullets]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");
  }
  if (section === "education") {
    return cv.education
      .map((item) =>
        [
          joinPresent([item.degree, item.institution], " - "),
          ...item.details,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");
  }
  if (section === "certifications") return cv.certifications.join("\n");
  return "";
}

function CvSkeletonPreview() {
  const sectionWidths = ["w-11/12", "w-10/12", "w-full", "w-9/12"];

  return (
    <div className="h-full overflow-y-auto rounded-lg bg-white/5 p-5">
      <div className="mx-auto min-h-[760px] w-full max-w-[820px] bg-white px-10 py-9 shadow-2xl shadow-black/30">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-zinc-900/85" />
          <div className="h-3 w-80 rounded bg-zinc-300" />
        </div>
        <div className="mt-8 space-y-8">
          {[0, 1, 2, 3].map((section) => (
            <div key={section}>
              <div className="h-3 w-36 rounded bg-cyan-900/70" />
              <div className="mt-3 space-y-2">
                {sectionWidths.map((width, index) => (
                  <div
                    className={cn("h-3 rounded bg-zinc-200", width)}
                    key={`${section}-${index}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CvGeneratingStage(props: {
  cv: StructuredCv | null;
  presentation?: unknown;
}) {
  const statuses = [
    "Building your CV around your strongest evidence",
    "Leading with role-specific projects",
    "Pulling in clarified gap answers",
    "Tightening skills for this job",
    "Checking for unsupported claims",
    "Preparing final document",
  ];

  return (
    <SectionShell title="Building your focused CV." subtitle="Your CV is being drafted here.">
      <div className="grid h-[72vh] min-h-0 gap-5 lg:grid-cols-[0.34fr_0.66fr]">
        <GlassPanel className="min-h-0 overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-100" />
            <p className="font-semibold text-white">Taylor is writing</p>
          </div>
          <div className="mt-5">
            <ProgressChecklist items={statuses} />
          </div>
        </GlassPanel>
        <div className="min-h-0 overflow-y-auto rounded-lg">
          {props.cv ? (
            <CvPaper cv={props.cv} presentation={props.presentation} compact />
          ) : (
            <CvSkeletonPreview />
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function finalEvidenceScore(state: ApplicationState) {
  return state.updatedEvidenceMatchScore ?? state.evidenceMatchScore.score;
}

function scoreImprovement(state: ApplicationState) {
  const original = state.originalEvidenceMatchScore;
  if (original === null || original === undefined) return null;

  const improvement = finalEvidenceScore(state) - original;
  return improvement > 0 ? improvement : null;
}

function strongestEvidence(state: ApplicationState) {
  const importanceRank = { high: 0, medium: 1, low: 2 } as const;
  const confidenceRank = { high: 0, medium: 1, weak: 2, missing: 3 } as const;

  return [...state.strongMatches]
    .sort(
      (a, b) =>
        (confidenceRank[a.overallConfidence] ?? 4) -
          (confidenceRank[b.overallConfidence] ?? 4) ||
        (importanceRank[a.requirementImportance] ?? 3) -
          (importanceRank[b.requirementImportance] ?? 3)
    )
    .slice(0, 3);
}

function roleKeywords(state: ApplicationState) {
  const importanceRank = { high: 0, medium: 1, low: 2 } as const;
  const sortedRequirements = [...state.jobRequirements].sort(
    (a, b) =>
      (importanceRank[a.importance] ?? 3) - (importanceRank[b.importance] ?? 3)
  );

  return uniqueItems(
    [
      ...strongestEvidence(state).map((match) => match.requirementLabel),
      ...sortedRequirements.map((requirement) => requirement.label),
    ],
    7
  );
}

function remainingWeakSpots(state: ApplicationState) {
  const openRequirementIds = new Set(
    state.requirementFitScores
      .filter(
        (score) =>
          score.finalConfidence === "weak" || score.finalConfidence === "missing"
      )
      .map((score) => score.jobRequirementId)
  );

  return state.weakSpots
    .filter(
      (spot) =>
        !spot.targetRequirementId || openRequirementIds.has(spot.targetRequirementId)
    )
    .slice(0, 2);
}

function sharpeningNotes(state: ApplicationState) {
  const strategy = state.cvStrategy;
  const sectionOrder = textArray(strategy?.sectionOrderJson);
  const keywords = roleKeywords(state);
  const evidence = strongestEvidence(state);
  const notes: string[] = [];

  if (strategy?.targetPositioning || strategy?.strategySummary) {
    notes.push("Repositioned the CV around the strongest credible angle for this role.");
  }

  const projectIndex = sectionOrder.findIndex((section) =>
    /project/i.test(section)
  );
  const experienceIndex = sectionOrder.findIndex((section) =>
    /experience/i.test(section)
  );
  if (projectIndex >= 0 && (experienceIndex < 0 || projectIndex < experienceIndex)) {
    notes.push("Moved project proof ahead of general experience so the best evidence is easier to scan.");
  }

  if (evidence[0]) {
    notes.push(`Put stronger proof for ${evidence[0].requirementLabel} near the top.`);
  }

  if (keywords.length > 0) {
    notes.push("Added role-specific language without turning the CV into keyword stuffing.");
  }

  if (state.cvDraft) {
    notes.push("Turned the strategy into a cleaner finished CV instead of leaving it as notes.");
  }

  notes.push("Removed or avoided claims that were not backed by the evidence you provided.");
  return uniqueItems(notes, 5);
}

function FinalResultPanel(props: { state: ApplicationState }) {
  const score = finalEvidenceScore(props.state);
  const improvement = scoreImprovement(props.state);
  const angle =
    props.state.cvStrategy?.targetPositioning ??
    props.state.cvStrategy?.strategySummary ??
    "This CV leads with the strongest role-relevant proof and avoids unsupported claims.";
  const evidence = strongestEvidence(props.state);
  const keywords = roleKeywords(props.state);
  const weakSpots = remainingWeakSpots(props.state);
  const changes = sharpeningNotes(props.state);

  return (
    <GlassPanel className="flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          Final result
        </p>
        <div className="mt-3 flex items-end gap-3">
          <p className="text-5xl font-semibold leading-none text-white">{score}%</p>
          <p className="pb-1 text-sm font-medium text-zinc-300">
            Evidence Match Score
          </p>
        </div>
        {improvement !== null ? (
          <p className="mt-3 inline-flex rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-sm font-medium text-emerald-100">
            +{improvement} points from the original score
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <p className="text-sm font-semibold text-cyan-100">
            Improved positioning angle
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{angle}</p>
        </section>

        {evidence.length > 0 ? (
          <section>
            <p className="text-sm font-semibold text-emerald-100">
              Strongest evidence now used
            </p>
            <div className="mt-3 space-y-2">
              {evidence.map((match) => (
                <div
                  className="rounded-lg border border-emerald-200/15 bg-emerald-200/10 p-3"
                  key={match.requirementId}
                >
                  <p className="text-sm font-medium text-white">
                    {match.requirementLabel}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-300">
                    {match.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <p className="text-sm font-semibold text-cyan-100">
            Role-specific keywords / ATS alignment
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Keyword coverage improved with role-specific terms
            {keywords.length > 0 ? ` such as ${keywords.join(", ")}` : ""}.
            The CV is structured for recruiter and ATS readability.
          </p>
        </section>

        <section>
          <p className="text-sm font-semibold text-white">
            What Taylor changed to make it sharper
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-300">
            {changes.map((change) => (
              <li className="flex gap-2" key={change}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Honesty note</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Unsupported claims were avoided. Taylor used the strongest evidence
            available and kept weaker areas conservative.
          </p>
        </section>

        {weakSpots.length > 0 ? (
          <section className="rounded-lg border border-amber-200/15 bg-amber-200/10 p-4">
            <p className="text-sm font-semibold text-amber-100">
              Optional next improvement
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Add a stronger example for{" "}
              {weakSpots.map((spot) => spot.label).join(", ")} if you have one.
            </p>
          </section>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function CvEditorStage(props: {
  state: ApplicationState;
  cv: StructuredCv | null;
  presentation?: unknown;
  chatMessages: ChatMessage[];
  selectedSection: string;
  rewriteInstruction: string;
  editText: string;
  exportError: string | null;
  isBusy: boolean;
  onCopy: () => void;
  onPdf: () => void;
  onDocx: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  onSelectSection: (section: string) => void;
  onRewriteInstruction: (value: string) => void;
  onRewrite: () => void;
  onEditText: (value: string) => void;
  onSaveSection: () => void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editableSections = [
    "summary",
    "projects",
    "experience",
    "skills",
    "education",
    "certifications",
  ];

  return (
    <SectionShell className="!max-w-7xl justify-start" title="Your tailored CV is ready.">
      <div className="grid h-[76vh] min-h-0 gap-5 lg:grid-cols-[0.31fr_0.69fr]">
        <FinalResultPanel state={props.state} />
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={props.onPdf} type="button">
                <Download className="h-4 w-4" />
                Export PDF
              </SecondaryButton>
              <SecondaryButton onClick={props.onDocx} type="button">
                <Download className="h-4 w-4" />
                Export DOCX
              </SecondaryButton>
              <SecondaryButton onClick={props.onCopy} type="button">
                <Clipboard className="h-4 w-4" />
                Copy CV
              </SecondaryButton>
              <SecondaryButton onClick={props.onSave} type="button">
                <Check className="h-4 w-4" />
                Save CV
              </SecondaryButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton disabled={props.isBusy} onClick={props.onRegenerate} type="button">
                <RefreshCcw className="h-4 w-4" />
                Regenerate
              </SecondaryButton>
              <SecondaryButton onClick={() => setIsEditOpen(true)} type="button">
                <MessageCircle className="h-4 w-4" />
                Ask Taylor to edit
              </SecondaryButton>
            </div>
          </div>
          {props.exportError ? (
            <p className="mb-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              {props.exportError}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
            {props.cv ? (
              <CvPaper cv={props.cv} presentation={props.presentation} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400">
                CV data is loading.
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-4 backdrop-blur-sm">
          <GlassPanel className="flex h-full w-full max-w-md flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-semibold text-white">Ask Taylor to edit</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Keep edits focused. Taylor will keep the claims truthful and role-specific.
                </p>
              </div>
              <button
                className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={() => setIsEditOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {props.chatMessages.map((message, index) => (
                  <div
                    className={cn(
                      "rounded-lg p-3 text-sm leading-6",
                      message.role === "agent"
                        ? "border border-white/10 bg-white/[0.05] text-zinc-200"
                        : "ml-8 bg-cyan-200 text-zinc-950"
                    )}
                    key={`${message.text}-${index}`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                  onChange={(event) => props.onSelectSection(event.target.value)}
                  value={props.selectedSection}
                >
                  {editableSections.map((section) => (
                    <option className="bg-zinc-950" key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
                <textarea
                  className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                  onChange={(event) =>
                    props.onRewriteInstruction(event.target.value)
                  }
                  placeholder="Make the summary more confident, shorten projects, keep it one page..."
                  value={props.rewriteInstruction}
                />
                <PrimaryButton
                  className="w-full"
                  disabled={props.isBusy || !props.rewriteInstruction.trim()}
                  onClick={props.onRewrite}
                  type="button"
                >
                  {props.isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send edit request
                  <Send className="h-4 w-4" />
                </PrimaryButton>
              </div>
              <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Edit a section directly
                </p>
                <textarea
                  className="min-h-44 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-200/60"
                  onChange={(event) => props.onEditText(event.target.value)}
                  value={props.editText}
                />
                <SecondaryButton
                  className="w-full"
                  disabled={props.isBusy}
                  onClick={props.onSaveSection}
                  type="button"
                >
                  Save section
                </SecondaryButton>
              </div>
            </div>
          </GlassPanel>
        </div>
      ) : null}
    </SectionShell>
  );
}

function AccountGateModal(props: {
  open: boolean;
  claimUrl: string;
  onClose: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <GlassPanel className="w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-white">
              Create an account to export, save this CV, and access it later.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Taylor will save this application to your Application Hub after
              sign-up or sign-in.
            </p>
          </div>
          <button
            className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={props.onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <SignUpButton forceRedirectUrl={props.claimUrl} mode="redirect">
            <PrimaryButton type="button">Create account</PrimaryButton>
          </SignUpButton>
          <SignInButton forceRedirectUrl={props.claimUrl} mode="redirect">
            <SecondaryButton type="button">Sign in</SecondaryButton>
          </SignInButton>
        </div>
      </GlassPanel>
    </div>
  );
}

export default function Home() {
  const utils = api.useUtils();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [resumedApplicationId, setResumedApplicationId] = useState<string | null>(null);
  const [stage, setStage] = useState<AppStage>("landing");
  const [dreamRole, setDreamRoleValue] = useState("");
  const [jobText, setJobText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [candidateFileName, setCandidateFileName] = useState<string | null>(null);
  const [isCandidateFileReading, setIsCandidateFileReading] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinFallbackText, setLinkedinFallbackText] = useState("");
  const [showLinkedInFallback, setShowLinkedInFallback] = useState(false);
  const [manualProfile, setManualProfile] = useState<CandidateProfileDraft>(
    initialManualProfileDraft
  );
  const [manualExtra, setManualExtra] = useState("");
  const [confirmedProfile, setConfirmedProfile] =
    useState<CandidateProfileDraft>(emptyCandidateProfileDraft);
  const [gapAnswers, setGapAnswers] = useState<Record<string, GapAnswerDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [gapQuestionError, setGapQuestionError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "Tell me what you want changed. I will keep the CV truthful and focused on this role.",
    },
  ]);
  const [selectedSection, setSelectedSection] = useState("summary");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [editText, setEditText] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [isAccountGateOpen, setIsAccountGateOpen] = useState(false);
  const generationTimer = useRef<number | null>(null);

  const createApplication = api.application.createApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  useEffect(() => {
    const requestedApplicationId = new URLSearchParams(window.location.search).get(
      "applicationId"
    );
    if (requestedApplicationId) {
      localStorage.setItem(currentApplicationStorageKey, requestedApplicationId);
      setApplicationId(requestedApplicationId);
      return;
    }
    const storedApplicationId = localStorage.getItem(currentApplicationStorageKey);
    if (storedApplicationId) {
      setApplicationId(storedApplicationId);
      return;
    }
    createApplication.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateQuery = api.application.getApplicationState.useQuery(
    { applicationId: applicationId ?? "" },
    { enabled: !!applicationId, retry: false }
  );

  const state = stateQuery.data ?? null;
  const structuredCv = useMemo(
    () => parseStructuredCv(state?.cvDraft?.cvJson ?? null),
    [state?.cvDraft?.cvJson]
  );
  const cvPresentation = state?.cvDraft?.presentationJson ?? null;

  useEffect(() => {
    if (applicationId && stateQuery.data === null && !createApplication.isPending) {
      localStorage.removeItem(currentApplicationStorageKey);
      createApplication.mutate();
    }
  }, [applicationId, createApplication, stateQuery.data]);

  useEffect(() => {
    if (!applicationId || !state || resumedApplicationId === applicationId) return;
    setResumedApplicationId(applicationId);
    setStage(deriveStageFromState(state));
    setDreamRoleValue(state.application.dreamRole ?? "");
    setJobText(state.job?.rawText ?? "");
    setCandidateText(
      state.candidateProfile?.rawBackgroundText ??
        state.candidateProfile?.rawCvText ??
        ""
    );
    setConfirmedProfile(candidateProfileDraftFromState(state.candidateProfile));
    setLinkedinUrl(state.candidateProfile?.sourceUrl ?? "");
  }, [applicationId, resumedApplicationId, state]);

  useEffect(() => {
    setEditText(sectionText(structuredCv, selectedSection));
  }, [selectedSection, structuredCv]);

  useEffect(
    () => () => {
      if (generationTimer.current) window.clearTimeout(generationTimer.current);
    },
    []
  );

  const saveDreamRole = api.application.setDreamRole.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("job_input");
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const submitJob = api.application.submitJob.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("job_result");
      setError(null);
    },
    onError: (mutationError) => {
      setStage("job_input");
      setError(mutationError.message);
    },
  });

  const generateQuestions = api.application.generateGapQuestions.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("match_strategy");
      setGapQuestionError(null);
      setError(null);
    },
    onError: async (mutationError) => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("match_strategy");
      setGapQuestionError(mutationError.message);
      setError("Taylor could not prepare the clarification questions. Retry the gap check before creating the CV.");
    },
  });

  const runMatching = api.application.runEvidenceMatching.useMutation({
    onSuccess: () => {
      if (!applicationId) return;
      setGapQuestionError(null);
      generateQuestions.mutate({ applicationId });
    },
    onError: (mutationError) => {
      setStage("candidate_input");
      setError(mutationError.message);
    },
  });

  const submitCandidate = api.application.submitCandidateProfileSource.useMutation({
    onSuccess: async (data) => {
      if (!applicationId) return;
      if (data.importStatus === "needs_paste") {
        setShowLinkedInFallback(true);
        setStage("candidate_input");
        setError(data.message);
        return;
      }
      await utils.application.getApplicationState.invalidate({ applicationId });
      setConfirmedProfile(candidateProfileDraftFromState(data.candidateProfile));
      setStage("profile_confirmation");
      setError(null);
    },
    onError: (mutationError) => {
      setStage("candidate_input");
      setError(mutationError.message);
    },
  });

  const confirmProfile = api.application.confirmCandidateProfile.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      if (!applicationId) return;
      setStage("candidate_scanning");
      runMatching.mutate({ applicationId });
      setError(null);
    },
    onError: (mutationError) => {
      setStage("profile_confirmation");
      setError(mutationError.message);
    },
  });

  const generateCv = api.application.generateCv.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      generationTimer.current = window.setTimeout(() => {
        setStage("cv_editor");
      }, 450);
      setError(null);
    },
    onError: (mutationError) => {
      setStage("match_strategy");
      setError(mutationError.message);
    },
  });

  const generateStrategy = api.application.generateCvStrategy.useMutation({
    onSuccess: async (data) => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({ applicationId });
        generateCv.mutate({ applicationId, strategyId: data.strategy.id });
      }
    },
    onError: (mutationError) => {
      setStage("match_strategy");
      setError(mutationError.message);
    },
  });

  const answerQuestions = api.application.answerGapQuestions.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("cv_generating");
      if (applicationId) generateStrategy.mutate({ applicationId });
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const rewriteSection = api.application.rewriteCvSection.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setChatMessages((messages) => [
        ...messages,
        { role: "agent", text: "I updated that section and kept the claims grounded." },
      ]);
      setRewriteInstruction("");
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const updateSection = api.application.updateCvSection.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const claimCurrentApplication = api.application.claimApplication.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
    },
    onError: (mutationError) => setExportError(mutationError.message),
  });

  const resetApplication = api.application.resetApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
      setStage("landing");
      setDreamRoleValue("");
      setJobText("");
      setCandidateText("");
      setCandidateFileName(null);
      setLinkedinUrl("");
      setLinkedinFallbackText("");
      setShowLinkedInFallback(false);
      setManualProfile(initialManualProfileDraft());
      setManualExtra("");
      setConfirmedProfile(emptyCandidateProfileDraft());
      setGapAnswers({});
      setChatMessages([
        {
          role: "agent",
          text: "Tell me what you want changed. I will keep the CV truthful and focused on this role.",
        },
      ]);
      setShowReset(false);
      setGapQuestionError(null);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  async function extractScreenshotText(file: File) {
    setOcrError(null);
    setIsOcrRunning(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text.trim();
      if (!text) {
        setOcrError("I could not read useful text from that screenshot. Paste the job description text instead.");
        return;
      }
      setJobText(text);
    } catch {
      setOcrError("Screenshot extraction failed. Paste the job description text and I can continue.");
    } finally {
      setIsOcrRunning(false);
    }
  }

  async function readCandidateFile(file: File) {
    setOcrError(null);
    setIsCandidateFileReading(true);
    setCandidateFileName(file.name);
    try {
      const name = file.name.toLowerCase();
      let text = "";
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url
        ).toString();
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
          );
        }
        text = pages.join("\n\n");
      } else if (name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer(),
        });
        text = result.value;
      } else if (name.endsWith(".doc")) {
        setOcrError("Older .doc files are not reliable in-browser. Export as DOCX/PDF or paste your CV text here.");
        return;
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setOcrError("I could not read text from that file. Paste your CV text instead.");
        return;
      }
      setCandidateText(text);
    } catch {
      setOcrError("I could not read that file. Paste your CV or describe your background instead.");
    } finally {
      setIsCandidateFileReading(false);
    }
  }

  function claimUrl() {
    const params = new URLSearchParams();
    if (applicationId) params.set("applicationId", applicationId);
    params.set("next", "/hub");
    return `/auth/claim?${params.toString()}`;
  }

  async function ensureAccountThen(action: () => void | Promise<void>) {
    if (!isAuthLoaded) return;
    if (!isSignedIn) {
      setIsAccountGateOpen(true);
      return;
    }
    if (applicationId) {
      await claimCurrentApplication.mutateAsync({ applicationId });
    }
    await action();
  }

  function startCvGeneration() {
    if (!applicationId) return;
    setStage("cv_generating");
    generateStrategy.mutate({ applicationId });
  }

  const pending =
    saveDreamRole.isPending ||
    submitJob.isPending ||
    submitCandidate.isPending ||
    confirmProfile.isPending ||
    runMatching.isPending ||
    generateQuestions.isPending ||
    answerQuestions.isPending ||
    generateStrategy.isPending ||
    generateCv.isPending ||
    rewriteSection.isPending ||
    updateSection.isPending ||
    resetApplication.isPending ||
    claimCurrentApplication.isPending;
  const unansweredQuestions =
    state?.gapQuestions.filter((question) => question.status === "unanswered") ?? [];
  const needsGapQuestionScan =
    !!state &&
    state.requirementFitScores.length > 0 &&
    !state.cvDraft &&
    state.application.currentStep === "evidence_ready" &&
    state.gapQuestions.length === 0;
  const scanningMessages =
    stage === "job_scanning"
      ? [
          "Reading the job description",
          "Extracting the core requirements",
          "Finding the hiring signals",
          "Ranking what matters most",
          "Preparing the role profile",
        ]
      : [
          "Finding projects and achievements",
          "Finding skills and tools",
          "Finding relevant experience",
          "Finding education and certifications",
          "Matching evidence to the role",
          "Preparing the gap check",
        ];

  return (
    <main className="relative h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(250,204,21,0.12),transparent_25%),linear-gradient(135deg,#09090b_0%,#111827_45%,#052e2b_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="relative z-10 flex h-full flex-col">
        <TopRail
          onReset={() => setShowReset(true)}
          resetDisabled={!applicationId || resetApplication.isPending}
          stage={stage}
        />

        {error ? (
          <div className="absolute left-1/2 top-20 z-30 w-[min(720px,calc(100%-32px))] -translate-x-1/2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100 backdrop-blur-xl">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait">
            {stage === "landing" ? (
              <SectionShell
                key="landing"
                title="Build the CV for the job you actually want."
                subtitle="Paste the role. Add your background. Taylor finds your angle, fills the gaps, and builds a focused CV that sounds like you — only sharper."
              >
                <DreamRoleInput
                  isLoading={saveDreamRole.isPending}
                  onChange={setDreamRoleValue}
                  onSubmit={() => {
                    if (!applicationId) return;
                    saveDreamRole.mutate({ applicationId, dreamRole });
                  }}
                  value={dreamRole}
                />
              </SectionShell>
            ) : null}

            {stage === "job_input" ? (
              <SectionShell
                key="job_input"
                title="Now send me the job description so I can see what they actually care about."
              >
                <TextDropPanel
                  accept="image/*,.txt,.md"
                  error={ocrError}
                  isLoading={submitJob.isPending || isOcrRunning}
                  maxLength={20_000}
                  onChange={setJobText}
                  onFile={(file) => {
                    if (file.type.startsWith("image/")) {
                      void extractScreenshotText(file);
                      return;
                    }
                    void file.text().then((text) => setJobText(text));
                  }}
                  onSubmit={() => {
                    if (!applicationId) return;
                    setStage("job_scanning");
                    submitJob.mutate({ applicationId, rawJobText: jobText });
                  }}
                  submitLabel={isOcrRunning ? "Reading screenshot..." : "Scan job"}
                  helperBullets={[
                    "Role title, company, and seniority clues",
                    "Must-have requirements and repeated priorities",
                    "Hidden hiring signals in the description",
                    "Role-specific language to reuse later",
                  ]}
                  helperTitle="Taylor will extract"
                  subtitle="Use pasted job text or upload a screenshot. No links for now."
                  title="Job description"
                  uploadLabel="Upload/paste screenshot"
                  value={jobText}
                />
              </SectionShell>
            ) : null}

            {stage === "job_scanning" ? (
              <ScanningStage
                key="job_scanning"
                messages={scanningMessages}
                subtitle="Taylor is extracting the requirements and ranking what matters most."
                title="Scanning the role."
              />
            ) : null}

            {stage === "job_result" && state ? (
              <JobResultStage
                key="job_result"
                onContinue={() => setStage("candidate_input")}
                state={state}
              />
            ) : null}

            {stage === "candidate_input" ? (
              <CandidateSourceStage
                candidateFileName={candidateFileName}
                candidateText={candidateText}
                error={ocrError}
                isLoading={submitCandidate.isPending}
                isReadingFile={isCandidateFileReading}
                key="candidate_input"
                linkedinFallbackText={linkedinFallbackText}
                linkedinUrl={linkedinUrl}
                manualExtra={manualExtra}
                manualProfile={manualProfile}
                onCandidateFile={(file) => void readCandidateFile(file)}
                onCandidateText={setCandidateText}
                onLinkedInFallbackText={setLinkedinFallbackText}
                onLinkedInSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setGapQuestionError(null);
                  setStage("candidate_scanning");
                  submitCandidate.mutate({
                    applicationId,
                    source: linkedinFallbackText.trim()
                      ? "linkedin_paste"
                      : "linkedin_url",
                    sourceUrl: linkedinUrl || null,
                    rawBackgroundText: linkedinFallbackText.trim() || null,
                    rawCvText: null,
                  });
                }}
                onLinkedInUrl={setLinkedinUrl}
                onManualExtra={setManualExtra}
                onManualProfile={setManualProfile}
                onManualSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setGapQuestionError(null);
                  setStage("candidate_scanning");
                  submitCandidate.mutate({
                    applicationId,
                    source: "manual",
                    rawCvText: null,
                    rawBackgroundText: manualProfileToText(
                      sanitizeProfileDraft(manualProfile),
                      manualExtra
                    ),
                    manualProfile: sanitizeProfileDraft(manualProfile),
                    sourceUrl: null,
                  });
                }}
                onUploadSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setGapQuestionError(null);
                  setStage("candidate_scanning");
                  submitCandidate.mutate({
                    applicationId,
                    source: "cv_upload",
                    rawCvText: candidateText,
                    rawBackgroundText: null,
                    sourceUrl: null,
                  });
                }}
                showLinkedInFallback={showLinkedInFallback}
              />
            ) : null}

            {stage === "profile_confirmation" && state?.candidateProfile ? (
              <ProfileConfirmationStage
                isAlreadyConfirmed={!!state.candidateProfile.profileConfirmedAt}
                isLoading={confirmProfile.isPending || runMatching.isPending}
                key="profile_confirmation"
                onProfile={setConfirmedProfile}
                onSubmit={() => {
                  if (!applicationId) return;
                  const cleaned = sanitizeProfileDraft(confirmedProfile);
                  setConfirmedProfile(cleaned);
                  if (state.candidateProfile?.profileConfirmedAt) {
                    setStage("candidate_scanning");
                    runMatching.mutate({ applicationId });
                    return;
                  }
                  confirmProfile.mutate({ applicationId, profile: cleaned });
                }}
                profile={confirmedProfile}
              />
            ) : null}

            {stage === "candidate_scanning" ? (
              <ScanningStage
                key="candidate_scanning"
                messages={scanningMessages}
                subtitle="Taylor is extracting useful evidence before showing any gaps."
                title="Understanding your background."
              />
            ) : null}

            {stage === "match_strategy" && state ? (
              <MatchStrategyStage
                gapQuestionError={
                  gapQuestionError ??
                  (needsGapQuestionScan
                    ? "The clarification questions are not ready for this fit score yet."
                    : null)
                }
                key="match_strategy"
                onHonestRead={() => setStage("honest_read")}
                onRetryGapQuestions={() => {
                  if (!applicationId) return;
                  setError(null);
                  setGapQuestionError(null);
                  setStage("candidate_scanning");
                  generateQuestions.mutate({ applicationId });
                }}
                state={state}
              />
            ) : null}

            {stage === "honest_read" && state ? (
              <HonestReadStage
                key="honest_read"
                onClarify={() => setStage("gap_questions")}
                onCreateCv={startCvGeneration}
                state={state}
              />
            ) : null}

            {stage === "gap_questions" ? (
              <GapQuestionsStage
                answers={gapAnswers}
                isSubmitting={answerQuestions.isPending || generateStrategy.isPending}
                key="gap_questions"
                onChange={(questionId, answer) =>
                  setGapAnswers((current) => ({ ...current, [questionId]: answer }))
                }
                onSubmit={() => {
                  if (!applicationId) return;
                  answerQuestions.mutate({
                    applicationId,
                    answers: unansweredQuestions.map((question) => ({
                      gapQuestionId: question.id,
                      answerText:
                        (gapAnswers[question.id]?.answerText.trim().length ?? 0) >=
                        60
                          ? gapAnswers[question.id]?.answerText.trim()
                          : null,
                      skipped:
                        (gapAnswers[question.id]?.answerText.trim().length ?? 0) <
                        60,
                    })),
                  });
                }}
                questions={unansweredQuestions}
              />
            ) : null}

            {stage === "cv_generating" ? (
              <CvGeneratingStage
                cv={structuredCv}
                key="cv_generating"
                presentation={cvPresentation}
              />
            ) : null}

            {stage === "cv_editor" && state ? (
              <CvEditorStage
                chatMessages={chatMessages}
                cv={structuredCv}
                editText={editText}
                exportError={exportError}
                isBusy={pending}
                key="cv_editor"
                onCopy={() => {
                  void ensureAccountThen(async () => {
                    await navigator.clipboard.writeText(state.cvDraft?.cvText ?? "");
                    setExportError("Copied and saved to your Application Hub.");
                  });
                }}
                onDocx={() => {
                  if (!structuredCv) return;
                  setExportError(null);
                  void ensureAccountThen(() =>
                    exportCvDocx(structuredCv, cvPresentation).catch(() =>
                      setExportError("DOCX export failed. Try again after the CV finishes loading.")
                    )
                  );
                }}
                onEditText={setEditText}
                onPdf={() => {
                  if (!structuredCv) return;
                  setExportError(null);
                  void ensureAccountThen(() =>
                    exportCvPdf(structuredCv, cvPresentation).catch(() =>
                      setExportError("PDF export failed. Try again after the CV finishes loading.")
                    )
                  );
                }}
                presentation={cvPresentation}
                onRegenerate={startCvGeneration}
                onSave={() => {
                  void ensureAccountThen(() => {
                    setExportError("Saved to your Application Hub.");
                  });
                }}
                onRewrite={() => {
                  if (!applicationId || !state.cvDraft) return;
                  setChatMessages((messages) => [
                    ...messages,
                    { role: "user", text: rewriteInstruction },
                  ]);
                  rewriteSection.mutate({
                    applicationId,
                    cvDraftId: state.cvDraft.id,
                    sectionId: selectedSection,
                    instruction: rewriteInstruction,
                  });
                }}
                onRewriteInstruction={setRewriteInstruction}
                onSaveSection={() => {
                  if (!applicationId || !state.cvDraft) return;
                  updateSection.mutate({
                    applicationId,
                    cvDraftId: state.cvDraft.id,
                    sectionId: selectedSection,
                    content: editText,
                  });
                }}
                onSelectSection={setSelectedSection}
                rewriteInstruction={rewriteInstruction}
                selectedSection={selectedSection}
                state={state}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AccountGateModal
        claimUrl={claimUrl()}
        onClose={() => setIsAccountGateOpen(false)}
        open={isAccountGateOpen}
      />

      {showReset ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <GlassPanel className="w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">Start a new CV?</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  This clears the current in-progress flow and returns to the dream-role stage.
                </p>
              </div>
              <button
                className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={() => setShowReset(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton onClick={() => setShowReset(false)} type="button">
                Cancel
              </SecondaryButton>
              <PrimaryButton
                disabled={!applicationId || resetApplication.isPending}
                onClick={() => {
                  if (!applicationId) return;
                  resetApplication.mutate({ applicationId });
                }}
                type="button"
              >
                {resetApplication.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Start over
              </PrimaryButton>
            </div>
          </GlassPanel>
        </div>
      ) : null}
    </main>
  );
}
