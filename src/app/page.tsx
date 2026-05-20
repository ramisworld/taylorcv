"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleDot,
  Clock3,
  Cloud,
  Clipboard,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  GitBranch,
  Lightbulb,
  Lock,
  Loader2,
  MessageCircle,
  RotateCcw,
  Rocket,
  Search,
  Sparkles,
  ShieldCheck,
  Wand2,
  Upload,
  Users,
  WandSparkles,
  Link,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TaylorBrand, TaylorLogoMark } from "~/components/TaylorBrand";
import { LandingPage } from "~/components/landing/LandingPage";
import { useSession } from "~/lib/auth-client";
import {
  claimText,
  contactItems,
  joinPresent,
  normalizeCvSections,
  parseStructuredCv,
  type CvContactKind,
  type CvExperienceItem,
  type CvProjectItem,
  type StructuredCv,
} from "~/lib/cvDocument";
import { exportCvDocx, exportCvPdf } from "~/lib/cvExport";
import { selectBalancedMatchPreviewFits } from "~/lib/matchSnapshotSelection";
import { friendlyGenerationErrorMessage } from "~/lib/workflowStatus";
import type { PlanKey } from "~/lib/plans";
import { api, type RouterOutputs } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";
const staleApplicationErrorFragments = [
  "does not belong to this anonymous session",
  "does not belong to this session",
] as const;

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;
type SubmitJobResult = RouterOutputs["application"]["submitJob"];
type AppStage =
  | "job_input"
  | "job_analysis"
  | "candidate_source"
  | "candidate_scanning"
  | "match_overview"
  | "gap_questions"
  | "cv_generating"
  | "final_export"
  | "auth_gate"
  | "paywall"
  | "error";
type GapAnswerDraft = {
  selectedOption?: string | null;
  followUpText?: string | null;
  skipped?: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function firstString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function textFromRecord(value: unknown, key: string) {
  return isRecord(value) ? firstString(value[key]) : null;
}

function logClientTiming(step: string, durationMs: number, meta: Record<string, unknown> = {}) {
  console.info("TAYLOR_TIMING", {
    stage: step,
    durationMs: Math.round(durationMs),
    status: "success",
    source: "frontend",
    ...meta,
  });
}

function isStaleApplicationError(message: string) {
  const normalized = message.toLowerCase();
  return staleApplicationErrorFragments.some((fragment) => normalized.includes(fragment));
}

function clientErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Taylor could not start a new CV.";
}

function matchAnalysis(state: ApplicationState | null) {
  return isRecord(state?.matchAnalysis) ? state.matchAnalysis : {};
}

function evidenceCards(state: ApplicationState | null) {
  const cards = matchAnalysis(state).evidenceCards;
  return Array.isArray(cards) ? cards.filter(isRecord) : [];
}

function topStrengths(state: ApplicationState | null) {
  return stringArray(matchAnalysis(state).topStrengths).slice(0, 4);
}

function weakSpots(state: ApplicationState | null) {
  return stringArray(matchAnalysis(state).weakSpots).slice(0, 4);
}

function gapMeta(question: ApplicationState["gapQuestions"][number]) {
  const meta = isRecord(question.questionJson) ? question.questionJson : {};
  return {
    shortQuestion: textFromRecord(meta, "shortQuestion") ?? question.question,
    whyThisMatters:
      textFromRecord(meta, "whyThisMatters") ??
      question.whyItMatters ??
      question.reason,
    howYourAnswerHelps:
      textFromRecord(meta, "howYourAnswerHelps") ??
      question.answerGuidance ??
      "A short answer gives Taylor more truthful evidence to use.",
    quickOptions:
      stringArray(meta.quickOptions).length > 0
        ? stringArray(meta.quickOptions).slice(0, 4)
        : ["Yes", "Somewhat", "Not yet", "Skip"],
    followUpPrompt:
      textFromRecord(meta, "followUpPrompt") ??
      "One line: what did you do, where did it happen, and what changed?",
    dynamicGuidance:
      textFromRecord(meta, "dynamicGuidance") ??
      "Use a real example only. Rough scope is fine if exact numbers are unknown.",
    exampleAnswer: textFromRecord(meta, "exampleAnswer"),
  };
}

function deriveStage(state: ApplicationState | null): AppStage {
  if (!state?.job) return "job_input";
  if (!state.candidateProfile) return "candidate_source";
  if (state.cvDraft) return "final_export";
  if (state.requirementFitScores.length > 0) return "match_overview";
  return "candidate_source";
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

function Panel(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/25 backdrop-blur-2xl",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function Shell(props: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-5 py-6",
        props.className
      )}
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <div className="mb-7 max-w-3xl">
        {props.eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
            {props.eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
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

function TopRail(props: { onReset: () => void; resetDisabled?: boolean }) {
  return (
    <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <TaylorLogoMark className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold text-white">Taylor CV</p>
          <p className="text-xs text-zinc-400">Fast tailored CV builder</p>
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {["Paste job", "Add background", "Match", "Questions", "Export"].map(
          (label) => (
            <span
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300"
              key={label}
            >
              {label}
            </span>
          )
        )}
      </div>
      <SecondaryButton
        className="px-3 py-2 text-xs"
        disabled={props.resetDisabled}
        onClick={props.onReset}
        type="button"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        New CV
      </SecondaryButton>
    </header>
  );
}

function AuthGateStage(props: { applicationId: string | null; reason?: string | null }) {
  const returnTo = props.applicationId
    ? `/auth/claim?applicationId=${encodeURIComponent(props.applicationId)}&next=${encodeURIComponent(`/?applicationId=${props.applicationId}`)}`
    : "/";
  const search = `returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <Shell
      eyebrow="Account required"
      title="Create your free TaylorCV account to generate and save your tailored CV."
      subtitle={
        props.reason === "EMAIL_VERIFICATION_REQUIRED"
          ? "Verify your email before using your free CV generation."
          : "Your match analysis is ready. Final CV generation is protected so your CV and usage are saved to your account."
      }
    >
      <Panel className="max-w-2xl p-6">
        <div className="flex flex-wrap gap-3">
          <a
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-white/10 transition hover:bg-cyan-50"
            href={`/auth/sign-up?${search}`}
          >
            Create account
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.1]"
            href={`/auth/sign-in?${search}`}
          >
            Sign in
          </a>
        </div>
      </Panel>
    </Shell>
  );
}

function PaywallStage(props: { onPricing: () => void }) {
  return (
    <Shell
      eyebrow="Plan limit reached"
      title="You have used the CV generations available on your current plan."
      subtitle="Choose Pro or Premium to keep generating role-tailored CVs."
    >
      <Panel className="max-w-2xl p-6">
        <PrimaryButton onClick={props.onPricing} type="button">
          View plans
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </Panel>
    </Shell>
  );
}

function LinkedInMark(props: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] border border-current text-[10px] font-bold leading-none",
        props.className
      )}
    >
      in
    </span>
  );
}

function JobPasteHeader() {
  return (
    <header className="relative z-20 border-b border-white/[0.075] bg-[#030b18]/72 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center px-5 sm:px-8 lg:px-10">
        <TaylorBrand markClassName="h-8 w-8" />
      </div>
    </header>
  );
}

function JobStepProgress() {
  const steps = ["Paste job", "Match", "Build", "Review"];

  return (
    <nav aria-label="Application progress" className="mx-auto w-full max-w-[620px]">
      <ol className="flex items-center justify-center">
        {steps.map((step, index) => {
          const active = index === 0;
          return (
            <li
              className={cn(
                "flex items-center",
                index < steps.length - 1 ? "flex-1" : "shrink-0"
              )}
              key={step}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
                    active
                      ? "border-blue-300/38 bg-blue-600 text-white shadow-[0_0_22px_rgba(37,99,235,0.34)]"
                      : "border-white/12 bg-white/[0.035] text-slate-500"
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "hidden whitespace-nowrap text-[13px] font-medium md:inline",
                    active ? "text-white" : "text-slate-500/80"
                  )}
                >
                  {step}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <span className="mx-4 h-px flex-1 bg-white/10" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function JobGlassCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[18px] border border-white/11 bg-[#071425]/76 shadow-[0_22px_70px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(145deg,rgba(255,255,255,0.06),transparent_38%,rgba(37,99,235,0.06))]",
        props.className
      )}
    >
      <div className="relative">{props.children}</div>
    </section>
  );
}

function ProgressChecklist(props: { items: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const key = props.items.join("|");

  useEffect(() => {
    setCurrentIndex(0);
    const interval = window.setInterval(() => {
      setCurrentIndex((current) => Math.min(current + 1, props.items.length - 1));
    }, 900);
    return () => window.clearInterval(interval);
  }, [key, props.items.length]);

  return (
    <ol className="space-y-3">
      {props.items.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 transition",
              done
                ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
                : active
                  ? "border-cyan-200/30 bg-cyan-200/10 text-white"
                  : "border-white/10 bg-white/[0.04] text-zinc-500"
            )}
            key={item}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10">
              {done ? (
                <Check className="h-4 w-4" />
              ) : active ? (
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

type MatchConfidence = "high" | "medium" | "low" | "missing";

function boundedScore(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isBackgroundMatchReady(state: ApplicationState | null) {
  if (!state || state.requirementFitScores.length === 0) return false;
  const score = boundedScore(
    state.originalEvidenceMatchScore ?? state.evidenceMatchScore.score
  );
  return score !== null && state.application.currentStep === "match_ready";
}

type ScorePalette = {
  accent: string;
  glow: string;
  gradient: readonly [string, string, string];
  text: string;
};

function scorePalette(score: number | null): ScorePalette {
  if (score === null) {
    return {
      accent: "#60a5fa",
      glow: "rgba(96,165,250,0.18)",
      gradient: ["#60a5fa", "#3b82f6", "#2563eb"],
      text: "text-blue-300",
    };
  }
  if (score <= 24) {
    return {
      accent: "#fb7185",
      glow: "rgba(251,113,133,0.18)",
      gradient: ["#fda4af", "#fb7185", "#e11d48"],
      text: "text-rose-300",
    };
  }
  if (score <= 44) {
    return {
      accent: "#f59e0b",
      glow: "rgba(245,158,11,0.18)",
      gradient: ["#fcd34d", "#f59e0b", "#d97706"],
      text: "text-amber-300",
    };
  }
  if (score <= 69) {
    return {
      accent: "#60a5fa",
      glow: "rgba(96,165,250,0.18)",
      gradient: ["#7dd3fc", "#60a5fa", "#2563eb"],
      text: "text-blue-300",
    };
  }
  if (score <= 84) {
    return {
      accent: "#34d399",
      glow: "rgba(52,211,153,0.18)",
      gradient: ["#86efac", "#34d399", "#16a34a"],
      text: "text-emerald-300",
    };
  }
  return {
    accent: "#6ee7b7",
    glow: "rgba(110,231,183,0.26)",
    gradient: ["#d9f99d", "#6ee7b7", "#10b981"],
    text: "text-emerald-200",
  };
}

function PremiumScoreLoader() {
  return (
    <div
      aria-label="Evidence score loading"
      className="taylor-premium-loader"
      role="status"
    >
      <span className="taylor-premium-loader__halo" />
      <span className="taylor-premium-loader__ring" />
      <span className="taylor-premium-loader__core">
        <span className="taylor-premium-loader__spark" />
      </span>
    </div>
  );
}

function EvidenceScoreRing(props: { score: number | null }) {
  const isLoading = props.score === null;
  if (isLoading) {
    return (
      <div className="flex h-[136px] w-[136px] items-center justify-center">
        <PremiumScoreLoader />
      </div>
    );
  }

  const size = 136;
  const center = size / 2;
  const radius = 51;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const score = props.score;
  const dashOffset = circumference * (1 - (score ?? 0) / 100);
  const palette = scorePalette(score);
  const gradientId = `evidence-score-${score}`;

  return (
    <div className="flex flex-col items-center">
      <svg
        aria-label={`Evidence score ${score}%`}
        className="overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient id={gradientId} x1="20" x2="112" y1="18" y2="116">
            <stop offset="0%" stopColor={palette.gradient[0]} />
            <stop offset="52%" stopColor={palette.gradient[1]} />
            <stop offset="100%" stopColor={palette.gradient[2]} />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" floodColor={palette.accent} floodOpacity="0.42" stdDeviation="3.6" />
          </filter>
        </defs>
        <circle
          cx={center}
          cy={center}
          fill="rgba(4,13,28,0.94)"
          r={radius + stroke}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="rgba(148,163,184,0.17)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          filter={`url(#${gradientId}-glow)`}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={stroke}
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms ease" }}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          dominantBaseline="central"
          fill="white"
          fontSize="28"
          fontWeight="500"
          textAnchor="middle"
          x={center}
          y={center - 6}
        >
          {score}%
        </text>
        <text
          fill="#94a3b8"
          fontSize="10.5"
          fontWeight="500"
          textAnchor="middle"
          x={center}
          y={center + 25}
        >
          Evidence match
        </text>
      </svg>
    </div>
  );
}

function confidenceLabel(confidence: string | null | undefined) {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  if (confidence === "low") return "Low";
  return "Missing";
}

function evidenceBreakdownLabel(confidence: MatchConfidence) {
  if (confidence === "high") return "Strong match";
  if (confidence === "medium") return "Medium match";
  if (confidence === "low") return "Low match";
  return "Missing";
}

function confidenceBadgeClass(confidence: string | null | undefined) {
  if (confidence === "high") {
    return "border-emerald-300/24 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.08)]";
  }
  if (confidence === "medium") {
    return "border-yellow-300/26 bg-yellow-300/10 text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.08)]";
  }
  if (confidence === "low") {
    return "border-orange-300/24 bg-orange-400/10 text-orange-300";
  }
  return "border-slate-300/20 bg-slate-400/8 text-slate-300";
}

function fitConfidence(fit: ApplicationState["requirementFitScores"][number]) {
  return fit.finalConfidence as MatchConfidence;
}

function cleanTaylorView(text: string | null | undefined, confidence: MatchConfidence) {
  const normalized = text?.replace(/\s+/g, " ").trim();
  if (
    normalized &&
    !/rejected invalid|candidate chunk|evidence ref|uuid|persistence|validation/i.test(
      normalized
    )
  ) {
    return normalized.length > 126 ? `${normalized.slice(0, 123).trimEnd()}...` : normalized;
  }
  if (confidence === "missing") {
    return "No clear direct evidence of this requirement yet.";
  }
  return "Some relevant proof exists, but the match is still limited.";
}

function topRequirementRows(state: ApplicationState | null) {
  if (!state) return [];
  const selectedFits = selectBalancedMatchPreviewFits({
    fits: state.requirementFitScores,
    topRequirementIds: state.topRequirements.map((requirement) => requirement.id),
  });
  const reasonByRequirementId = new Map(
    state.evidenceMatches.map((match) => [match.requirementId, match.reason])
  );

  return selectedFits.map((fit) => {
    const confidence = fitConfidence(fit);

    return {
      confidence,
      id: fit.jobRequirementId,
      label: fit.jobRequirement?.label ?? "Role requirement",
      view: cleanTaylorView(
        reasonByRequirementId.get(fit.jobRequirementId) ?? fit.reason,
        confidence
      ),
    };
  });
}

function RequirementIcon(props: { index: number }) {
  const icons = [Search, Cloud, ChartNoAxesColumnIncreasing, Users, FileText];
  const Icon = icons[props.index % icons.length] ?? CircleDot;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-300 shadow-[0_0_14px_rgba(37,99,235,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function ScanHeader() {
  return (
    <header className="relative z-20 mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">
      <TaylorBrand markClassName="h-8 w-8" textClassName="text-[20px]" />
      <p className="hidden items-center gap-2 text-[13px] font-normal text-slate-400 sm:flex">
        <ShieldCheck className="h-4.5 w-4.5 text-slate-500" />
        Your data is private & secure
      </p>
    </header>
  );
}

const scanChecklistItems = [
  {
    title: "Parsed your profile",
    loadingTitle: "Parsing profile",
    detail: "Extracting roles, skills, and experience",
    icon: FileText,
  },
  {
    title: "Mapped to role requirements",
    loadingTitle: "Creating evidence map",
    detail: "Mapping achievements to capabilities",
    icon: GitBranch,
  },
  {
    title: "Analyzed and validated",
    loadingTitle: "Matching requirements",
    detail: "Comparing against role criteria",
    icon: ShieldCheck,
  },
  {
    title: "Generated match results",
    loadingTitle: "Generating questions",
    detail: "Building personalized question set",
    icon: Sparkles,
  },
] as const;

const scanProgressMilestones = [
  { step: "parsing_profile", start: 1, end: 17, checklistIndex: 0 },
  { step: "saving_profile", start: 17, end: 27, checklistIndex: 0 },
  { step: "building_candidate_evidence", start: 27, end: 38, checklistIndex: 0 },
  { step: "creating_evidence_map", start: 38, end: 52, checklistIndex: 1 },
  { step: "matching_requirements", start: 52, end: 72, checklistIndex: 2 },
  { step: "validating_scores", start: 72, end: 82, checklistIndex: 2 },
  { step: "generating_questions", start: 82, end: 92, checklistIndex: 3 },
  { step: "finalizing_match", start: 92, end: 98, checklistIndex: 3 },
] as const;

function scanMilestoneFor(currentStep: string | null | undefined) {
  return (
    scanProgressMilestones.find((milestone) => milestone.step === currentStep) ??
    scanProgressMilestones[0]
  );
}

function scanCurrentStepLabel(currentStep: string | null | undefined) {
  const milestone = scanMilestoneFor(currentStep);
  return scanChecklistItems[milestone.checklistIndex]?.loadingTitle ?? "Analyzing";
}

function useRealScanProgress(args: {
  currentStep: string | null | undefined;
  resultsReady: boolean;
}) {
  const milestone = scanMilestoneFor(args.currentStep);
  const [progress, setProgress] = useState(args.resultsReady ? 100 : milestone.start);

  useEffect(() => {
    if (args.resultsReady) {
      setProgress(100);
      return;
    }

    const cap = Math.max(milestone.start, milestone.end - 1);
    setProgress((current) =>
      Math.min(cap, Math.max(current, milestone.start))
    );
  }, [args.resultsReady, milestone.end, milestone.start, args.currentStep]);

  useEffect(() => {
    if (args.resultsReady) return;
    const cap = Math.max(milestone.start, milestone.end - 1);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= cap) return current;
        const distance = cap - current;
        return Math.min(cap, current + Math.max(0.18, distance * 0.075));
      });
    }, 220);
    return () => window.clearInterval(interval);
  }, [args.resultsReady, milestone.end, milestone.start, args.currentStep]);

  return Math.round(progress);
}

function scoreMatchLabel(score: number | null) {
  return score === null ? "Match pending" : "Current match";
}

function confidenceDotClass(confidence: MatchConfidence) {
  if (confidence === "high") return "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.52)]";
  if (confidence === "medium") return "bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.42)]";
  if (confidence === "low") return "bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.36)]";
  return "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.28)]";
}

function ScanStepList(props: {
  currentStep: string | null | undefined;
  resultsReady: boolean;
}) {
  const activeIndex = props.resultsReady
    ? scanChecklistItems.length
    : scanMilestoneFor(props.currentStep).checklistIndex;

  return (
    <ol className="mt-3.5 overflow-hidden rounded-lg border border-white/10 bg-[#061224]/54 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      {scanChecklistItems.map((item, index) => {
        const Icon = item.icon;
        const complete = props.resultsReady || index < activeIndex;
        const active = !props.resultsReady && index === activeIndex;
        return (
          <li
            className={cn(
              "relative grid grid-cols-[34px_1fr_22px] items-center gap-2.5 border-b border-white/8 px-3 py-2 last:border-b-0",
              active && "bg-blue-500/[0.075]",
              complete && "bg-emerald-300/[0.025]"
            )}
            key={item.title}
          >
            {index < scanChecklistItems.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[29px] top-[39px] h-[19px] w-px",
                  complete
                    ? "bg-gradient-to-b from-emerald-300 to-cyan-300/60"
                    : active
                      ? "bg-gradient-to-b from-cyan-300 to-blue-500/40"
                      : "bg-slate-600/45"
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border transition",
                complete
                  ? "border-emerald-300/42 bg-emerald-300/12 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.18)]"
                  : active
                    ? "border-blue-300/70 bg-blue-500/16 text-blue-200 shadow-[0_0_24px_rgba(37,99,235,0.34)]"
                    : "border-slate-500/45 bg-slate-900/30 text-slate-500"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[13px] font-medium leading-[18px]",
                  complete || active ? "text-white" : "text-slate-500"
                )}
              >
                {props.resultsReady ? item.title : item.loadingTitle}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-[12px] leading-[17px]",
                  complete || active ? "text-slate-300" : "text-slate-500"
                )}
              >
                {props.resultsReady && index === 3
                  ? "Final score and gap analysis ready"
                  : item.detail}
              </span>
            </span>
            <span className="flex justify-end">
              {complete ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/34 bg-emerald-300/10 text-emerald-300">
                  <Check className="h-3 w-3" />
                </span>
              ) : active ? (
                <span className="flex items-center gap-0.5 text-blue-300">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LoadingProgressOrb(props: { progress: number; currentStep: string }) {
  const size = 340;
  const center = size / 2;
  const radius = 121;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - props.progress / 100);

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex h-[340px] w-[340px] max-w-full items-center justify-center"
      exit={{ opacity: 0, scale: 0.985 }}
      initial={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <div aria-hidden="true" className="taylor-scan-orb">
        <span className="taylor-scan-orb__mesh" />
        <span className="taylor-scan-orb__cloud" />
        <span className="taylor-scan-orb__particles" />
      </div>
      <svg
        aria-label={`Analysis ${props.progress}% complete`}
        className="absolute inset-0 overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient id="scan-progress-gradient" x1="66" x2="310" y1="86" y2="316">
            <stop offset="0%" stopColor="#6ee7f9" />
            <stop offset="48%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <filter id="scan-progress-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" floodColor="#38bdf8" floodOpacity="0.55" stdDeviation="4.5" />
          </filter>
        </defs>
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius + 36}
          stroke="rgba(59,130,246,0.18)"
          strokeWidth="1.5"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius + 16}
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="5"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="rgba(59,130,246,0.18)"
          strokeWidth="7"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          filter="url(#scan-progress-glow)"
          r={radius}
          stroke="url(#scan-progress-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="7"
          style={{ transition: "stroke-dashoffset 520ms ease" }}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="relative z-10 text-center">
          <p className="text-[38px] font-medium tracking-[-0.04em] text-white">
          {props.progress}%
        </p>
        <p className="mt-1 text-[14px] font-normal text-blue-200">
          {props.currentStep}...
        </p>
      </div>
    </motion.div>
  );
}

function FinalScoreRing(props: { score: number }) {
  const size = 238;
  const center = size / 2;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - props.score / 100);

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex h-[238px] w-[238px] shrink-0 items-center justify-center"
      exit={{ opacity: 0, scale: 0.985 }}
      initial={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
    >
      <svg
        aria-label={`Overall match score ${props.score}%`}
        className="absolute inset-0 overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient id="scan-score-gradient" x1="54" x2="198" y1="28" y2="220">
            <stop offset="0%" stopColor="#168f9a" />
            <stop offset="34%" stopColor="#19c6d7" />
            <stop offset="68%" stopColor="#1fa6f2" />
            <stop offset="100%" stopColor="#1f6ff2" />
          </linearGradient>
          <filter id="scan-score-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" floodColor="#0ea5e9" floodOpacity="0.13" stdDeviation="3.2" />
          </filter>
        </defs>
        <circle
          cx={center}
          cy={center}
          fill="rgba(2,8,22,0.48)"
          r={radius + 13}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius + 7}
          stroke="rgba(15,23,42,0.62)"
          strokeWidth="1"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="rgba(51,65,85,0.42)"
          strokeWidth="9"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          filter="url(#scan-score-glow)"
          r={radius}
          stroke="url(#scan-score-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="9"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
          transform={`rotate(-126 ${center} ${center})`}
        />
      </svg>
      <div className="relative z-10 text-center">
        <p className="text-[46px] font-light leading-none tracking-[-0.05em] text-white">
          {props.score}%
        </p>
        <p className="mt-2 text-[16px] font-normal text-cyan-300">
          {scoreMatchLabel(props.score)}
        </p>
        <p className="mt-1.5 text-[11.5px] font-normal text-slate-400">Overall match score</p>
      </div>
    </motion.div>
  );
}

function EvidenceBreakdown(props: {
  counts: Record<MatchConfidence, number>;
}) {
  const items: MatchConfidence[] = ["high", "medium", "low", "missing"];

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="w-full max-w-[198px] rounded-lg border border-white/15 bg-[#07152a]/68 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      initial={{ opacity: 0, x: 14 }}
      transition={{ delay: 0.12, duration: 0.34 }}
    >
      {items.map((confidence) => (
        <div
          className="flex items-center justify-between border-b border-white/10 py-2.5 first:pt-1 last:border-b-0 last:pb-1"
          key={confidence}
        >
          <span className="flex items-center gap-2.5 text-[13px] font-normal text-white">
            <span className={cn("h-2 w-2 rounded-full", confidenceDotClass(confidence))} />
            {evidenceBreakdownLabel(confidence)}
          </span>
          <span className="text-[13px] font-medium text-white">{props.counts[confidence]}</span>
        </div>
      ))}
    </motion.div>
  );
}

function ScanningMatchStage(props: {
  state: ApplicationState | null;
  onAnswer?: () => void;
  onSkip?: () => void;
  isGenerating?: boolean;
  resultsReady: boolean;
}) {
  const rawScore =
    props.state?.originalEvidenceMatchScore ??
    props.state?.evidenceMatchScore.score;
  const availableScore = boundedScore(rawScore);
  const hasAvailableScore = availableScore !== null;
  const resultsReady =
    props.resultsReady &&
    !!props.state &&
    hasAvailableScore &&
    props.state.requirementFitScores.length > 0;
  const score = resultsReady ? availableScore : null;
  const rows = topRequirementRows(props.state);
  const questions = props.state?.gapQuestions.filter((question) => question.status === "unanswered") ?? [];
  const hasMatchData = resultsReady && rows.length > 0;
  const currentStep = props.state?.application.currentStep ?? "parsing_profile";
  const progress = useRealScanProgress({ currentStep, resultsReady });
  const breakdownCounts = props.state?.requirementFitScores.reduce(
    (counts, fit) => {
      const confidence = fitConfidence(fit);
      counts[confidence] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0, missing: 0 } satisfies Record<MatchConfidence, number>
  ) ?? { high: 0, medium: 0, low: 0, missing: 0 };
  const finishedScore = score ?? 0;

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="relative mx-auto flex min-h-full w-full max-w-[1400px] flex-col px-5 pb-3 sm:px-8 lg:px-10"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <ScanHeader />
      <div className="relative flex min-h-0 flex-1 items-start justify-center py-2 lg:items-center lg:py-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[780px] max-w-[86vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/14 blur-[96px]"
        />
        <section
          className={cn(
            "relative w-full max-w-[1080px] overflow-hidden rounded-[18px] border border-blue-200/28 bg-[#071426]/78 px-5 py-5 shadow-[0_30px_104px_rgba(0,0,0,0.34),0_0_86px_rgba(37,99,235,0.13),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl sm:px-7 lg:h-[min(790px,calc(100dvh-104px))] lg:min-h-[700px] lg:px-9",
            resultsReady ? "lg:py-7" : "lg:py-8"
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_77%_20%,rgba(37,99,235,0.20),transparent_31%),linear-gradient(145deg,rgba(255,255,255,0.065),transparent_34%,rgba(20,184,166,0.045))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/38 to-transparent" />
          <div className="relative flex h-full min-h-0 flex-col">
            <div className="grid shrink-0 gap-5 lg:grid-cols-[382px_minmax(0,1fr)] lg:gap-7">
              <div>
                <AnimatePresence mode="wait">
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    initial={{ opacity: 0, y: 8 }}
                    key={resultsReady ? "done-copy" : "loading-copy"}
                    transition={{ duration: 0.28 }}
                  >
                    <span className="inline-flex h-7 items-center gap-2 rounded-lg border border-emerald-300/22 bg-emerald-300/10 px-3 text-[12.5px] font-medium text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                      {resultsReady ? "Scan complete" : "Analysis in progress"}
                    </span>
                    <h1 className="mt-4 max-w-[350px] text-balance text-[32px] font-medium leading-[1.13] tracking-[-0.04em] text-white sm:text-[36px]">
                      {resultsReady
                        ? "Your background match is ready"
                        : "Analyzing your background"}
                    </h1>
                    <p className="mt-2.5 max-w-[360px] text-[13px] font-normal leading-[19px] text-slate-300">
                      {resultsReady
                        ? "We've reviewed your experience and matched it to the role requirements using AI."
                        : "Our AI is reviewing your experience and matching it to role requirements. This usually takes 30-60 seconds."}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <ScanStepList currentStep={currentStep} resultsReady={resultsReady} />
              </div>

                  <div className="flex min-w-0 flex-col items-center justify-center pt-1">
                <div
                  className={cn(
                    "flex w-full items-center justify-center",
                    resultsReady ? "gap-4 xl:gap-6" : "flex-col"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {resultsReady ? (
                      <FinalScoreRing key="score-ring" score={finishedScore} />
                    ) : (
                      <LoadingProgressOrb
                        currentStep={scanCurrentStepLabel(currentStep)}
                        key="loading-orb"
                        progress={progress}
                      />
                    )}
                  </AnimatePresence>
                  {resultsReady ? <EvidenceBreakdown counts={breakdownCounts} /> : null}
                </div>

                {resultsReady ? (
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 flex max-w-[486px] items-start gap-2.5 text-[12.5px] font-normal leading-[19px] text-slate-300"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ delay: 0.18, duration: 0.32 }}
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                    Strong matches indicate clear evidence of the required capability.
                    Focus on medium, low, and missing areas to improve.
                  </motion.p>
                ) : (
                  <div className="mt-3 flex max-w-[340px] items-start gap-3 text-left">
                    <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-blue-300" />
                    <p>
                      <span className="block text-[14px] font-medium text-blue-300">
                        Secure. Private. Never shared.
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-[19px] text-blue-100/72">
                        Your data stays on our encrypted servers.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {resultsReady ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 shrink-0"
                  initial={{ opacity: 0, y: 14 }}
                  transition={{ delay: 0.08, duration: 0.34 }}
                >
                  <div className="overflow-hidden rounded-lg border border-white/12 bg-[#061326]/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
                    <div className="hidden grid-cols-[1.05fr_1.55fr_104px] border-b border-white/10 px-4 py-2 text-[11.5px] font-medium text-slate-300/88 md:grid">
                      <span>Requirement</span>
                      <span>Taylor's view</span>
                      <span className="text-center">Confidence</span>
                    </div>
                    {rows.map((row, index) => (
                      <div
                        className="grid gap-2.5 border-b border-white/8 px-4 py-2 last:border-b-0 md:grid-cols-[1.05fr_1.55fr_104px] md:items-center"
                        key={row.id}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <RequirementIcon index={index} />
                          <p className="min-w-0 text-[12.5px] font-medium leading-[18px] text-white">
                            {row.label}
                          </p>
                        </div>
                        <p className="line-clamp-2 min-w-0 text-[12.5px] font-normal leading-[18px] text-slate-300 md:line-clamp-1">
                          {row.view}
                        </p>
                        <div className="flex md:justify-center">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-[76px] items-center justify-center rounded-full border px-2.5 text-[11.5px] font-medium",
                              confidenceBadgeClass(row.confidence)
                            )}
                          >
                            {confidenceLabel(row.confidence)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {props.onAnswer && props.onSkip ? (
                    <div className="mt-5 flex flex-col items-center justify-center gap-4 border-t border-white/8 pt-4 sm:flex-row">
                      <button
                        className="inline-flex h-11 w-full max-w-[250px] items-center justify-center gap-2 rounded-lg border border-blue-300/35 bg-gradient-to-b from-blue-500 to-blue-600 px-5 text-[13px] font-medium text-white shadow-[0_20px_52px_rgba(37,99,235,0.42),0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:from-blue-400 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={questions.length === 0 || props.isGenerating}
                        onClick={props.onAnswer}
                        type="button"
                      >
                        <ArrowRight className="h-4.5 w-4.5" />
                        Improve gaps
                      </button>
                      <button
                        className="inline-flex h-11 w-full max-w-[250px] items-center justify-center gap-2 rounded-lg border border-blue-200/34 bg-[#08172b]/86 px-5 text-[13px] font-medium text-slate-100 shadow-[0_12px_34px_rgba(2,6,23,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-blue-200/50 hover:bg-[#0b1c34] disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={!hasMatchData || props.isGenerating}
                        onClick={props.onSkip}
                        type="button"
                      >
                        {props.isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4.5 w-4.5" />
                        )}
                        Skip and generate CV
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </motion.section>
  );
}

function TimelineGlyph(props: { kind: "read" | "target" | "map" }) {
  if (props.kind === "read") {
    return (
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 32 32"
      >
        <path
          d="M9 5.5h9.3L24 11.2V25a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M18 5.8V11h5.5M11 15h7M11 19h5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle
          cx="22"
          cy="21.5"
          r="3.1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m24.3 23.8 2.4 2.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (props.kind === "target") {
    return (
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 32 32"
      >
        <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="16" r="3.1" stroke="currentColor" strokeWidth="2" />
        <path
          d="M16 3.8v5.1M16 23.1v5.1M3.8 16h5.1M23.1 16h5.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <path
          d="M10.2 10.2 8.3 8.3M21.8 10.2l1.9-1.9M10.2 21.8l-1.9 1.9M21.8 21.8l1.9 1.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeOpacity=".55"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 32 32"
    >
      <path
        d="m5.5 8.5 6.8-3.1 7.4 3.1 6.8-3.1v18.1l-6.8 3.1-7.4-3.1-6.8 3.1V8.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M12.3 5.4v18.1M19.7 8.5v18.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function JobInputStage(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const trimmedValue = props.value.trim();
  const wordCount = trimmedValue ? trimmedValue.split(/\s+/).length : 0;
  const timeline = [
    {
      title: "Read the role",
      copy: "Our AI reads and understands the job description in detail.",
      kind: "read" as const,
      tone:
        "border-blue-300/24 bg-blue-500/18 text-blue-200 shadow-[0_0_46px_rgba(37,99,235,0.34),inset_0_0_24px_rgba(59,130,246,0.20),inset_0_1px_0_rgba(255,255,255,0.14)]",
    },
    {
      title: "Find key requirements",
      copy: "We extract must-haves, skills, experience, and hidden priorities.",
      kind: "target" as const,
      tone:
        "border-violet-300/24 bg-violet-500/18 text-violet-200 shadow-[0_0_46px_rgba(124,58,237,0.32),inset_0_0_24px_rgba(139,92,246,0.20),inset_0_1px_0_rgba(255,255,255,0.14)]",
    },
    {
      title: "Build your role map",
      copy: "We create a tailored role map to align your CV with what matters most.",
      kind: "map" as const,
      tone:
        "border-emerald-300/24 bg-emerald-400/16 text-emerald-200 shadow-[0_0_46px_rgba(16,185,129,0.28),inset_0_0_24px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.14)]",
    },
  ];

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-h-0 flex-col"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <JobPasteHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 lg:h-[calc(100dvh-64px)] lg:overflow-visible lg:px-10">
        <div className="mx-auto flex min-h-full max-w-[1480px] flex-col lg:h-full lg:min-h-0">
          <JobStepProgress />

          <div className="mt-4 grid gap-5 lg:h-[min(620px,calc(100dvh-140px))] lg:min-h-[560px] lg:grid-cols-[280px_minmax(0,1fr)_264px] xl:grid-cols-[286px_minmax(0,1fr)_272px]">
            <JobGlassCard className="order-2 p-5 lg:order-1 lg:h-full lg:min-h-0 xl:p-5">
              <div className="flex h-full flex-col">
                <span className="w-fit rounded-lg bg-white/[0.055] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/84">
                  Step 1 of 4
                </span>

                <h1 className="mt-6 max-w-[240px] text-[27px] font-medium leading-[1.17] tracking-[-0.04em] text-white xl:text-[29px]">
                  Paste the <span className="text-blue-400">job</span> you
                  want to apply for
                </h1>

                <p className="mt-4 max-w-[238px] text-[13.5px] leading-6 text-slate-300/92">
                  Add the full job description for the strongest match. We’ll
                  extract key requirements, skills, and priorities to tailor
                  your CV.
                </p>

                <div className="mt-7 rounded-xl border border-white/8 bg-white/[0.032] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-3.5 w-3.5 text-slate-300" />
                    <p className="text-[13px] font-medium text-white">
                      Your data is private & secure
                    </p>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-5 text-slate-400">
                    We never store or share your job descriptions.
                  </p>
                </div>

                <div className="mt-auto pt-6">
                  <p className="text-[13px] text-slate-400">Need help?</p>
                  <button
                    className="mt-2.5 inline-flex cursor-default items-center gap-2 text-[13px] font-medium text-blue-400"
                    type="button"
                  >
                    Show example
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </JobGlassCard>

            <JobGlassCard className="order-1 p-5 lg:order-2 lg:h-full lg:min-h-0 xl:p-5">
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-white">
                    Job description
                  </h2>
                  <button
                    className="inline-flex cursor-default items-center gap-2 text-[13px] font-medium text-blue-400"
                    type="button"
                  >
                    Paste as text
                    <Clipboard className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative min-h-0 flex-1">
                  <textarea
                    className="h-[340px] min-h-[300px] w-full resize-none rounded-lg border border-blue-300/14 bg-[#050d18]/90 px-4 py-4 pr-5 text-[14px] leading-6 text-slate-100 outline-none shadow-[inset_0_0_0_1px_rgba(15,23,42,0.7),inset_0_16px_40px_rgba(0,0,0,0.24)] placeholder:text-slate-500 focus:border-blue-400/90 focus:shadow-[0_0_0_1px_rgba(59,130,246,0.48),0_0_28px_rgba(37,99,235,0.14),inset_0_16px_40px_rgba(0,0,0,0.24)] lg:h-full [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/60 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
                    maxLength={20_000}
                    onChange={(event) => props.onChange(event.target.value)}
                    placeholder="Paste the full job description here..."
                    value={props.value}
                  />
                  <p className="pointer-events-none absolute bottom-3 right-4 text-[12px] text-slate-500">
                    {wordCount.toLocaleString()} words •{" "}
                    {props.value.length.toLocaleString()} characters
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[13px] text-slate-200">
                    <Check className="h-3.5 w-3.5 text-lime-300" />
                    Full job description gives better results
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[13px] text-slate-200">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-400/18 text-[10px] font-semibold text-blue-300">
                      i
                    </span>
                    No full JD? Use target role instead
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    className="group inline-flex min-h-12 w-full max-w-[360px] items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-[15px] font-semibold text-white shadow-[0_22px_62px_rgba(37,99,235,0.30),inset_0_1px_0_rgba(255,255,255,0.20)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={props.isLoading || !props.value.trim()}
                    onClick={props.onSubmit}
                    type="button"
                  >
                    {props.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-[18px] w-[18px]" />
                    )}
                    Analyse this role
                    <ArrowRight className="ml-auto h-[18px] w-[18px] transition group-hover:translate-x-0.5" />
                  </button>
                  <p className="text-[13px] text-slate-500">Press Enter ↵</p>
                </div>

                <p className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Secure analysis • Your data is never stored or shared
                </p>
              </div>
            </JobGlassCard>

            <JobGlassCard className="order-3 p-5 lg:h-full lg:min-h-0 xl:p-5">
              <div className="flex h-full flex-col">
                <h2 className="text-center text-[16px] font-semibold tracking-[-0.02em] text-white">
                  What Taylor will do next
                </h2>

                <div className="relative mt-8 space-y-7">
                  {timeline.map((item, index) => {
                    return (
                      <div className="relative grid grid-cols-[60px_1fr] gap-4" key={item.title}>
                        <span
                          className={cn(
                            "relative z-10 flex h-[58px] w-[58px] items-center justify-center rounded-2xl border",
                            item.tone
                          )}
                        >
                          <TimelineGlyph kind={item.kind} />
                          {index < timeline.length - 1 ? (
                            <span className="absolute left-1/2 top-[66px] h-[32px] w-px -translate-x-1/2 bg-gradient-to-b from-blue-300/25 to-blue-300/8" />
                          ) : null}
                        </span>
                        <div className="pt-1">
                          <h3 className="text-[14px] font-semibold text-white">
                            {item.title}
                          </h3>
                          <p className="mt-1.5 text-[13px] leading-5 text-slate-400">
                            {item.copy}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto flex justify-center pt-6">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 py-2.5 text-[13px] font-medium text-slate-200">
                    <Lock className="h-3.5 w-3.5" />
                    Takes ~30 seconds
                  </span>
                </div>
              </div>
            </JobGlassCard>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function requirementImportanceRank(importance: unknown) {
  if (importance === "high") return 0;
  if (importance === "medium") return 1;
  if (importance === "low") return 2;
  return 3;
}

type AnalysisRequirement = {
  id: string;
  label: string;
  description?: string | null;
  importance?: string | null;
};

const conciseRequirementPatterns: Array<[RegExp, string]> = [
  [/\bmicrosoft\s+foundry\b/i, "Microsoft Foundry"],
  [/\bazure\s+ai\b|\bazure\b/i, "Azure AI"],
  [/\bcontext\s+engineering\b|\bcontext\s+engineer/i, "Context Engineering"],
  [/\bprompt(?:ing|s|ed)?\b/i, "Prompting"],
  [/\bproduct\s+thinking\b/i, "Product Thinking"],
  [/\bopenai\b/i, "OpenAI"],
  [/\brag\b|retrieval[-\s]?augmented/i, "RAG"],
  [/\bfine[-\s]?tun/i, "Fine-tuning"],
  [/\bevaluat(?:e|ion|ing)\b|\bevals?\b/i, "Evaluation"],
  [/\bfull[-\s]?stack\b|front[-\s]?end.*back[-\s]?end|back[-\s]?end.*front[-\s]?end/i, "Full Stack"],
  [/\bdeployment\b|\bdeploy\b|\bproduction\b|\bshipping\b/i, "Deployment"],
  [/\bcommunication\b|\bcommunicat/i, "Communication"],
  [/\bstakeholder/i, "Stakeholders"],
  [/\bagentic\b|\bagents?\b|\btool calling\b|\bworkflow/i, "Agents"],
  [/\bstructured outputs?\b/i, "Structured Outputs"],
  [/\bllm\b|\bllms\b|large language/i, "LLMs"],
  [/\bapi\b|\bapis\b/i, "APIs"],
  [/\bproduct thinking\b|\bproduct strategy\b|\bproduct\b/i, "Product"],
  [/\banalytics?\b|\bmetrics?\b|\bdata\b/i, "Analytics"],
  [/\bproblem[-\s]?solving\b|\bdebug/i, "Problem Solving"],
  [/\bleadership\b|\blead\b|\bmentor/i, "Leadership"],
  [/\bcollaboration\b|\bcross[-\s]?functional/i, "Collaboration"],
  [/\btypescript\b/i, "TypeScript"],
  [/\bjavascript\b/i, "JavaScript"],
  [/\breact\b|\bnext\.?js\b/i, "React"],
  [/\bpython\b/i, "Python"],
  [/\bsql\b/i, "SQL"],
  [/\bcloud\b/i, "Cloud"],
  [/\bsecurity\b/i, "Security"],
];

function RequirementChipIcon(props: { label: string; className?: string }) {
  const label = props.label.toLowerCase();
  const className = props.className ?? "h-4 w-4";

  if (/agent|workflow|tool/.test(label)) return <Bot className={className} />;
  if (/prompt|context/.test(label)) return <WandSparkles className={className} />;
  if (/evaluation|eval|analytics/.test(label)) {
    return <ChartNoAxesColumnIncreasing className={className} />;
  }
  if (/llm|ai|openai/.test(label)) return <BrainCircuit className={className} />;
  if (/azure|cloud/.test(label)) return <Cloud className={className} />;
  if (/deployment|deploy/.test(label)) return <Rocket className={className} />;
  if (/product|thinking|strategy/.test(label)) return <Lightbulb className={className} />;
  if (/communication/.test(label)) return <MessageCircle className={className} />;
  if (/stakeholder|collaboration|leadership/.test(label)) return <Users className={className} />;
  if (/rag|database|sql|data/.test(label)) return <Database className={className} />;
  if (/search|retrieval/.test(label)) return <Search className={className} />;
  if (/api|structured|typescript|javascript|react|python|full stack/.test(label)) {
    return <Cpu className={className} />;
  }
  return <Sparkles className={className} />;
}

const displayStopWords = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "to",
  "for",
  "with",
  "without",
  "using",
  "use",
  "build",
  "building",
  "create",
  "creating",
  "develop",
  "developing",
  "deliver",
  "delivering",
  "manage",
  "managing",
  "own",
  "owning",
  "experience",
  "skills",
  "skill",
  "knowledge",
  "ability",
  "strong",
  "proven",
  "working",
]);

function titleCaseToken(token: string) {
  const knownUpper = new Set(["ai", "ml", "llm", "llms", "api", "apis", "sql", "rag"]);
  const normalized = token.toLowerCase();
  if (knownUpper.has(normalized)) return normalized.toUpperCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function conciseRequirementLabel(requirement: AnalysisRequirement) {
  const source = `${requirement.label} ${requirement.description ?? ""}`;
  for (const [pattern, label] of conciseRequirementPatterns) {
    if (pattern.test(source)) return label;
  }

  const tokens = requirement.label
    .replace(/[/_]+/g, " ")
    .split(/[^a-zA-Z0-9.+#-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !displayStopWords.has(token.toLowerCase()));

  return tokens.slice(0, 2).map(titleCaseToken).join(" ") || requirement.label;
}

function topDisplayRequirements(requirements: AnalysisRequirement[]) {
  const seen = new Set<string>();
  return [...requirements]
    .sort(
      (a, b) =>
        requirementImportanceRank(a.importance) - requirementImportanceRank(b.importance)
    )
    .map((requirement) => ({
      ...requirement,
      displayLabel: conciseRequirementLabel(requirement),
    }))
    .filter((requirement) => {
      const key = requirement.displayLabel.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 9);
}

function AnalysisProgressMarker(props: {
  complete: boolean;
  active: boolean;
  failed: boolean;
}) {
  if (props.complete) {
    return (
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-100/58 bg-emerald-400 text-[#03140d] shadow-[0_0_12px_rgba(74,222,128,0.48),0_0_22px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.44)]">
        <Check className="h-[18px] w-[18px] stroke-[2.35]" />
      </span>
    );
  }

  if (props.failed) {
    return (
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-300/70 bg-red-500/12 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.24)]">
        <span className="text-sm font-semibold">!</span>
      </span>
    );
  }

  if (props.active) {
    return (
      <motion.span
        animate={{
          boxShadow: [
            "0 0 14px rgba(37,99,235,0.54), 0 0 26px rgba(14,165,233,0.18), inset 0 0 12px rgba(15,23,42,0.95)",
            "0 0 18px rgba(37,99,235,0.74), 0 0 36px rgba(34,211,238,0.26), inset 0 0 13px rgba(15,23,42,0.95)",
            "0 0 14px rgba(37,99,235,0.54), 0 0 26px rgba(14,165,233,0.18), inset 0 0 12px rgba(15,23,42,0.95)",
          ],
        }}
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-300/50 bg-[#020817]"
        transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
      >
        <span className="absolute inset-[2px] rounded-full border border-blue-500/42" />
        <motion.span
          animate={{ rotate: 360 }}
          className="absolute inset-[1px] rounded-full bg-[conic-gradient(from_0deg,rgba(8,47,73,0)_0_62%,rgba(37,99,235,0.18)_68%,rgba(37,99,235,1)_78%,rgba(125,211,252,1)_88%,rgba(8,47,73,0)_99%)]"
          transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
        />
        <span className="absolute inset-[5px] rounded-full bg-[#020817] shadow-[inset_0_0_12px_rgba(0,0,0,0.9)]" />
      </motion.span>
    );
  }

  return (
    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-500/66 bg-[#03101e] shadow-[inset_0_0_10px_rgba(15,23,42,0.9)]" />
  );
}

function JobAnalysisStage(props: {
  state: ApplicationState | null;
  mutationData?: SubmitJobResult;
  isLoading: boolean;
  error?: string | null;
  onContinue: () => void;
  onEdit: () => void;
}) {
  const minimums = useMemo(
    () => [
      randomBetween(1000, 2500),
      randomBetween(1500, 4000),
      randomBetween(1500, 4500),
      randomBetween(2000, 5000),
      randomBetween(3000, 6000),
    ],
    []
  );
  const cumulativeMinimums = useMemo(
    () =>
      minimums.map((_, index) =>
        minimums.slice(0, index + 1).reduce((total, value) => total + value, 0)
      ),
    [minimums]
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const failed = !!props.error;

  useEffect(() => {
    if (failed) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 180);
    return () => window.clearInterval(interval);
  }, [failed]);

  const job = props.state?.job ?? props.mutationData?.job ?? null;
  const profile = props.state?.jobProfileSummary;
  const requirements: AnalysisRequirement[] =
    props.state?.jobRequirements ?? props.mutationData?.jobRequirements ?? [];
  const displayRequirements = useMemo(
    () => topDisplayRequirements(requirements),
    [requirements]
  );
  const role = profile?.role ?? job?.title ?? null;
  const company = profile?.company ?? job?.company ?? null;
  const summary = profile?.summary ?? job?.summary ?? null;
  const metadata = [
    role,
    company,
    job?.seniority,
    job?.roleDomain ? job.roleDomain.replace(/_/g, " ") : null,
  ].filter((item): item is string => !!item);
  const gates = [
    true,
    displayRequirements.length > 0,
    displayRequirements.some((requirement) => !!requirement.importance),
    !!role && !!summary,
    !!role && !!summary && displayRequirements.length > 0 && !props.isLoading,
  ];
  let completedSteps = 0;
  if (!failed) {
    for (let index = 0; index < gates.length; index += 1) {
      if (gates[index] && elapsedMs >= (cumulativeMinimums[index] ?? Number.POSITIVE_INFINITY)) {
        completedSteps += 1;
      } else {
        break;
      }
    }
  }
  const allComplete = completedSteps === 5;
  const activeStep = failed ? Math.min(completedSteps, 4) : allComplete ? -1 : completedSteps;
  const showRequirements = !failed && completedSteps >= 2;
  const showSummary = !failed && allComplete;
  const steps = [
    "Reading the role...",
    "Finding key requirements...",
    "Separating must-haves from nice-to-haves...",
    "Building your role map...",
    "Prioritizing what matters most...",
  ];

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-h-0 flex-col"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <JobPasteHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:overflow-visible lg:px-10">
        <div className="mx-auto grid min-h-[650px] max-w-[1340px] gap-7 lg:h-[min(735px,calc(100dvh-126px))] lg:min-h-[650px] lg:grid-cols-[0.92fr_1.08fr] xl:gap-9 2xl:max-w-[1380px]">
          <div className="flex min-h-0 flex-col">
            <div>
              <p className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.2em] text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Analyzing the role
              </p>
              <h1 className="max-w-[520px] text-[26px] font-medium leading-tight tracking-[-0.028em] text-white xl:text-[29px]">
                Taylor is analyzing the job description
              </h1>
              <p className="mt-3 text-[14px] font-normal text-slate-300">
                This usually takes 20–40 seconds
              </p>
            </div>

            <JobGlassCard className="mt-6 min-h-0 flex-1 border-blue-300/24 bg-[#061427]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34),0_0_46px_rgba(37,99,235,0.11),inset_0_1px_0_rgba(255,255,255,0.075)] xl:p-8">
              <div className="flex h-full min-h-0 flex-col">
                <ol className="relative flex-1 space-y-6 xl:space-y-7">
                  {steps.map((step, index) => {
                    const complete = index < completedSteps;
                    const active = index === activeStep && !failed;
                    const failedStep = failed && index === activeStep;
                    const nextComplete = index + 1 < completedSteps;
                    return (
                      <li className="relative flex min-h-[58px] gap-5" key={step}>
                        {index < steps.length - 1 ? (
                          <span
                            className={cn(
                              "absolute left-4 top-11 h-9 w-px xl:h-10",
                              complete && nextComplete
                                ? "bg-gradient-to-b from-emerald-300 via-emerald-300/88 to-emerald-300/58 shadow-[0_0_7px_rgba(52,211,153,0.28)]"
                                : complete
                                  ? "bg-gradient-to-b from-emerald-300/78 via-cyan-300/38 to-slate-600/24 shadow-[0_0_6px_rgba(74,222,128,0.16)]"
                                  : "bg-slate-600/42"
                            )}
                          />
                        ) : null}
                        <AnalysisProgressMarker
                          active={active}
                          complete={complete}
                          failed={failedStep}
                        />
                        <div className="min-w-0 pt-0.5">
                          <p
                            className={cn(
                              "text-[17px] font-normal leading-snug tracking-[-0.015em] xl:text-[18px]",
                              complete || active ? "text-white" : "text-slate-400"
                            )}
                          >
                            {step}
                          </p>
                          {complete ? (
                            <p className="mt-2 text-[13.5px] font-normal text-slate-300">
                              Complete
                            </p>
                          ) : active ? (
                            <p className="mt-2 animate-pulse text-[13.5px] font-normal text-cyan-300">
                              In progress...
                            </p>
                          ) : failedStep ? (
                            <p className="mt-2 text-[13.5px] text-red-300">Analysis stopped</p>
                          ) : (
                            <p className="mt-2 text-[13.5px] text-slate-500">Pending</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {failed ? (
                  <div className="mt-5 rounded-2xl border border-red-300/18 bg-red-500/[0.075] p-4">
                    <p className="text-[14px] font-medium text-red-100">
                      Taylor could not analyze this job description.
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-red-100/72">
                      {props.error}
                    </p>
                    <button
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200/20 bg-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.1]"
                      onClick={props.onEdit}
                      type="button"
                    >
                      Edit job description
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                <div className="mt-6 flex items-center gap-4 rounded-xl border border-blue-200/14 bg-[#031528]/72 px-4 py-3 text-[12.5px] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex items-center gap-2 font-medium text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.72)]" />
                    Live analysis
                  </span>
                  <span className="h-4 w-px bg-slate-600/70" />
                  <span className="min-w-0 flex-1">
                    AI is extracting and structuring requirements in real time
                  </span>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
                </div>
              </div>
            </JobGlassCard>

            <p className="mt-5 flex items-center gap-2 text-[12.5px] text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Your data is private & secure. We never share your information.
            </p>
          </div>

          <JobGlassCard className="min-h-0 border-blue-300/28 bg-[#07182c]/82 p-5 shadow-[0_24px_82px_rgba(0,0,0,0.34),0_0_54px_rgba(37,99,235,0.14),inset_0_1px_0_rgba(255,255,255,0.085)] xl:p-6">
            <div className="flex h-full flex-col">
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-200/48 bg-blue-500/18 text-blue-100 shadow-[0_0_42px_rgba(37,99,235,0.62),inset_0_0_20px_rgba(59,130,246,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]">
                  <Sparkles className="h-[22px] w-[22px]" />
                </span>
                <div className="min-w-0 flex-1">
                  {showRequirements ? (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.28 }}
                    >
                      <h2 className="whitespace-nowrap text-[22px] font-medium leading-tight tracking-[-0.028em] text-white min-[1400px]:text-[24px] xl:text-[26px]">
                        Taylor found {displayRequirements.length} key requirements
                      </h2>
                      <p className="mt-1.5 text-[13.5px] text-slate-300">
                        Here’s what matters most in this role.
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="h-7 w-72 animate-pulse rounded-full bg-white/10" />
                      <div className="h-4 w-56 animate-pulse rounded-full bg-white/7" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 min-h-[128px]">
                {showRequirements ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
                    initial={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.32 }}
                  >
                    {displayRequirements.map((requirement, index) => (
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200/16 bg-white/[0.047] px-3 py-1.5 text-[13px] font-normal text-slate-200 shadow-[0_0_18px_rgba(37,99,235,0.1),inset_0_1px_0_rgba(255,255,255,0.065)]"
                        initial={{ opacity: 0, y: 8 }}
                        key={`${requirement.id}-${requirement.displayLabel}`}
                        transition={{ delay: index * 0.035, duration: 0.24 }}
                      >
                        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-blue-200/14 bg-blue-400/[0.08] text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          <RequirementChipIcon
                            className="h-3.5 w-3.5"
                            label={requirement.displayLabel}
                          />
                        </span>
                        {requirement.displayLabel}
                      </motion.span>
                    ))}
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        className="h-10 animate-pulse rounded-lg border border-white/7 bg-white/[0.04]"
                        key={index}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-blue-200/18 to-transparent" />

              {failed ? (
                <div className="rounded-2xl border border-red-300/16 bg-red-500/[0.065] p-4">
                  <p className="text-[15px] font-medium text-red-100">Analysis failed</p>
                  <p className="mt-2 text-[13.5px] leading-6 text-red-100/72">
                    Review the job description and try again. Your pasted text is still available.
                  </p>
                  <button
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.26)] transition hover:bg-blue-500"
                    onClick={props.onEdit}
                    type="button"
                  >
                    Edit job description
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : showSummary ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-1 flex-col"
                  initial={{ opacity: 0, y: 14 }}
                  transition={{ duration: 0.32 }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-[15.5px] font-medium text-white">
                      <FileText className="h-[18px] w-[18px] text-blue-300" />
                      Role summary
                    </p>
                    <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-[12.5px] font-medium text-emerald-300">
                      Great match potential
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-6 text-slate-300">{summary}</p>
                  {metadata.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-slate-400">
                      {metadata.map((item) => (
                        <span className="inline-flex items-center gap-2" key={item}>
                          <span className="h-1 w-1 rounded-full bg-slate-500" />
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-auto pt-5">
                    <button
                      className="group relative inline-flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-5 text-[14.5px] font-medium text-white shadow-[0_22px_62px_rgba(37,99,235,0.36),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500"
                      onClick={props.onContinue}
                      type="button"
                    >
                      Add my background
                      <ArrowRight className="absolute right-5 h-5 w-5 transition group-hover:translate-x-0.5" />
                    </button>
                    <button
                      className="mx-auto mt-4 flex items-center gap-2 text-[12.5px] text-slate-400 transition hover:text-slate-200"
                      onClick={props.onEdit}
                      type="button"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Edit job description
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="h-5 w-36 animate-pulse rounded-full bg-white/9" />
                  <div className="space-y-2">
                    <div className="h-4 w-full animate-pulse rounded-full bg-white/7" />
                    <div className="h-4 w-11/12 animate-pulse rounded-full bg-white/7" />
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/7" />
                  </div>
                  <div className="h-12 w-full rounded-lg border border-white/8 bg-white/[0.035]" />
                </div>
              )}
            </div>
          </JobGlassCard>
        </div>
      </div>
    </motion.section>
  );
}

function CandidateSourceStage(props: {
  candidateText: string;
  candidateFileName: string | null;
  candidateMemorySummary?: ApplicationState["candidateMemorySummary"] | null;
  linkedinUrl: string;
  error?: string | null;
  isLoading: boolean;
  isReadingFile: boolean;
  mode: "upload" | "linkedin";
  onMode: (mode: "upload" | "linkedin") => void;
  onCandidateText: (value: string) => void;
  onCandidateFile: (file: File) => void;
  onLinkedInUrl: (value: string) => void;
  onUploadSubmit: () => void;
  onLinkedInSubmit: () => void;
  onUseSavedMemory: () => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [localUploadError, setLocalUploadError] = useState<string | null>(null);
  const uploadInputId = "candidate-cv-upload";
  const hasCandidateText = !!props.candidateText.trim();
  const selectedFileLabel = props.isReadingFile
    ? "Reading file..."
    : props.candidateFileName ?? (hasCandidateText ? "CV content ready" : null);
  const canSubmitUpload =
    hasCandidateText && !props.isReadingFile && !props.isLoading;
  const hasSavedMemory = !!props.candidateMemorySummary?.hasMemory;

  function handleCandidateFile(file: File) {
    const tenMegabytes = 10 * 1024 * 1024;
    const hasAllowedExtension = /\.(pdf|docx|txt)$/i.test(file.name);

    if (!hasAllowedExtension) {
      setLocalUploadError("Choose a PDF, DOCX, or TXT file.");
      return;
    }

    if (file.size > tenMegabytes) {
      setLocalUploadError("Choose a CV under 10MB.");
      return;
    }

    setLocalUploadError(null);
    props.onCandidateFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleCandidateFile(file);
  }

  const benefits = [
    {
      title: "Your data stays private",
      copy: "We use your background only to build your CV.",
      icon: ShieldCheck,
    },
    {
      title: "Takes less than a minute",
      copy: "Upload your CV and Taylor handles the scan.",
      icon: Clock3,
    },
    {
      title: "Stronger CV, better results",
      copy: "We tailor your evidence to the role.",
      icon: Sparkles,
    },
  ];

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-h-0 flex-col"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <JobPasteHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
        <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col items-center justify-center">
          <div className="max-w-[760px] text-center">
            <h1 className="text-balance text-[36px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[46px] lg:text-[52px]">
              Let’s build your{" "}
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                standout CV
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-[580px] text-[16px] font-normal leading-7 text-slate-300 sm:text-[18px]">
              Upload your CV and we’ll tailor it to the role, highlight your
              strengths, and help you achieve more.
            </p>
          </div>

          {hasSavedMemory ? (
            <JobGlassCard className="mt-7 w-full max-w-[860px] border-emerald-300/22 bg-emerald-300/[0.07] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24),0_0_46px_rgba(16,185,129,0.10),inset_0_1px_0_rgba(255,255,255,0.07)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-white">Use your saved profile</p>
                  <p className="mt-1 text-[13.5px] leading-5 text-emerald-50/78">
                    {props.candidateMemorySummary?.chunkCount ?? 0} saved evidence chunks are ready for this job.
                  </p>
                </div>
                <button
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 text-[14px] font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={props.isLoading}
                  onClick={props.onUseSavedMemory}
                  type="button"
                >
                  {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Use saved profile
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </JobGlassCard>
          ) : null}

          <JobGlassCard className="mt-7 w-full max-w-[860px] rounded-[22px] border-blue-300/22 bg-[#07162a]/78 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_0_72px_rgba(37,99,235,0.16),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-7">
            <div className="mx-auto grid w-full max-w-[460px] grid-cols-2 border-b border-white/10">
              {[
                { id: "upload" as const, label: "Upload CV", icon: Upload },
                { id: "linkedin" as const, label: "LinkedIn URL", icon: LinkedInMark },
              ].map((option) => {
                const Icon = option.icon;
                const active = props.mode === option.id;
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "relative -mb-px flex h-12 items-center justify-center gap-2 border-b-2 text-[15px] font-semibold transition",
                      active
                        ? "border-blue-500 text-white"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                    key={option.id}
                    onClick={() => {
                      setLocalUploadError(null);
                      props.onMode(option.id);
                    }}
                    type="button"
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        active ? "text-blue-400" : "text-slate-500"
                      )}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {props.mode === "upload" ? (
                <>
                  <input
                    accept=".pdf,.docx,.txt"
                    className="sr-only"
                    id={uploadInputId}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleCandidateFile(file);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                  <div
                    className={cn(
                      "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition sm:min-h-[320px] sm:px-8",
                      isDragActive
                        ? "border-blue-300 bg-blue-500/[0.13] shadow-[0_0_34px_rgba(37,99,235,0.20)]"
                        : "border-blue-400/70 bg-blue-500/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
                    )}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div className="relative mb-6 flex h-[104px] w-[126px] items-center justify-center">
                      <Sparkles className="absolute left-0 top-5 h-5 w-5 text-blue-400" />
                      <Sparkles className="absolute right-1 top-3 h-4 w-4 text-indigo-300" />
                      <span className="absolute bottom-6 left-2 h-2 w-2 rounded-full bg-blue-300/70" />
                      <span className="absolute right-0 top-16 h-2 w-2 rounded-full bg-blue-400/50" />
                      <span className="relative flex h-[92px] w-[76px] items-center justify-center rounded-[18px] border border-blue-200/24 bg-gradient-to-br from-blue-300/34 via-blue-500/26 to-indigo-700/36 shadow-[0_18px_42px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.16)]">
                        <FileText className="h-10 w-10 text-blue-100/88" />
                      </span>
                      <span className="absolute bottom-1 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_14px_34px_rgba(37,99,235,0.42),inset_0_1px_0_rgba(255,255,255,0.22)]">
                        <Upload className="h-6 w-6" />
                      </span>
                    </div>

                    <h2 className="text-[23px] font-semibold tracking-[-0.025em] text-white">
                      Drag and drop your CV here
                    </h2>
                    <p className="mt-3 text-[14px] text-slate-400">or</p>

                    <label
                      aria-disabled={props.isReadingFile}
                      className={cn(
                        "mt-4 inline-flex h-14 min-w-[230px] cursor-pointer items-center justify-center gap-3 rounded-lg bg-blue-600 px-7 text-[16px] font-semibold text-white shadow-[0_22px_58px_rgba(37,99,235,0.34),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500",
                        props.isReadingFile && "pointer-events-none opacity-70"
                      )}
                      htmlFor={uploadInputId}
                    >
                      {props.isReadingFile ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-5 w-5" />
                      )}
                      {props.isReadingFile ? "Reading file..." : "Choose file"}
                    </label>

                    <p className="mt-5 text-[14px] text-slate-400">
                      PDF, DOCX or TXT • Max 10MB
                    </p>

                    {selectedFileLabel ? (
                      <div className="mt-5 flex w-full max-w-[500px] flex-col items-center justify-between gap-3 rounded-lg border border-blue-200/14 bg-black/18 px-4 py-3 sm:flex-row">
                        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-slate-200">
                          <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                          <span className="truncate">{selectedFileLabel}</span>
                        </span>
                        <button
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-[13.5px] font-semibold text-slate-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          disabled={!canSubmitUpload}
                          onClick={props.onUploadSubmit}
                          type="button"
                        >
                          {props.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-blue-300/18 bg-blue-500/[0.045] px-5 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:min-h-[320px] sm:px-10">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200/20 bg-blue-600/18 text-blue-200 shadow-[0_18px_48px_rgba(37,99,235,0.20),inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <LinkedInMark className="h-7 w-7 border-blue-100/50 text-[15px] text-blue-100" />
                  </span>
                  <h2 className="mt-5 text-[23px] font-semibold tracking-[-0.025em] text-white">
                    Paste your LinkedIn public URL
                  </h2>
                  <p className="mt-2 max-w-[520px] text-[14.5px] leading-6 text-slate-300">
                    Taylor can use your public profile to understand your
                    background and find role-relevant evidence.
                  </p>
                  <div className="mt-5 w-full max-w-[560px]">
                    <input
                      className="h-12 w-full rounded-lg border border-blue-200/18 bg-[#020917]/72 px-4 text-[15px] text-white outline-none shadow-[inset_0_0_0_1px_rgba(15,23,42,0.65)] placeholder:text-slate-500 focus:border-blue-400/80 focus:shadow-[0_0_0_1px_rgba(59,130,246,0.42),0_0_28px_rgba(37,99,235,0.13)]"
                      onChange={(event) => props.onLinkedInUrl(event.target.value)}
                      placeholder="https://www.linkedin.com/in/your-profile"
                      value={props.linkedinUrl}
                    />
                    <p className="mt-2 text-left text-[13px] text-slate-500">
                      Make sure your LinkedIn profile is public.
                    </p>
                  </div>
                  <button
                    className="mt-5 inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-[15px] font-semibold text-white shadow-[0_22px_58px_rgba(37,99,235,0.34),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={props.isLoading || !props.linkedinUrl.trim()}
                    onClick={props.onLinkedInSubmit}
                    type="button"
                  >
                    {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Import LinkedIn
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-[14px] text-slate-400">
                <ShieldCheck className="h-4 w-4 text-slate-300" />
                {props.mode === "upload"
                  ? "Your file is only used to extract your information and is never shared."
                  : "Your profile information is only used to tailor your CV and is never shared."}
              </p>

              {localUploadError || props.error ? (
                <p className="mx-auto mt-4 max-w-[680px] rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-center text-sm text-amber-100">
                  {localUploadError ?? props.error}
                </p>
              ) : null}
            </div>
          </JobGlassCard>

          <div className="mt-6 grid w-full max-w-[860px] gap-4 sm:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  className={cn(
                    "flex items-center gap-4 text-left",
                    index > 0 &&
                      "sm:border-l sm:border-white/10 sm:pl-6"
                  )}
                  key={benefit.title}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-200/14 bg-blue-500/18 text-blue-100 shadow-[0_14px_36px_rgba(37,99,235,0.20)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-white">
                      {benefit.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-slate-400">
                      {benefit.copy}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function MatchOverviewStage(props: {
  state: ApplicationState;
  onAnswer: () => void;
  onSkip: () => void;
  isGenerating: boolean;
}) {
  const score = props.state.originalEvidenceMatchScore ?? props.state.evidenceMatchScore.score;
  const questions = props.state.gapQuestions.filter((question) => question.status === "unanswered");
  const cards = evidenceCards(props.state).slice(0, 4);
  return (
    <Shell
      eyebrow="Match overview"
      title={`${score}% CV Match Strength`}
      subtitle={props.state.matchLabel ?? "Taylor found the strongest current proof and the gaps worth sharpening."}
    >
      <div className="grid h-[70vh] min-h-0 gap-5 overflow-hidden lg:grid-cols-[0.36fr_0.64fr]">
        <Panel className="min-h-0 overflow-y-auto p-6">
          <p className="text-sm font-semibold text-cyan-100">Taylor’s angle</p>
          <p className="mt-3 text-2xl font-semibold leading-tight text-white">
            {props.state.cvAngle ?? "Lead with the strongest verified evidence and keep weaker claims conservative."}
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Quick questions</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {questions.length > 0
                ? `${questions.length} optional question${questions.length === 1 ? "" : "s"} could improve the final CV.`
                : "Taylor can build the CV without extra questions."}
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <PrimaryButton
              className="w-full"
              disabled={questions.length === 0 || props.isGenerating}
              onClick={props.onAnswer}
              type="button"
            >
              Answer quick questions
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <SecondaryButton
              className="w-full"
              disabled={props.isGenerating}
              onClick={props.onSkip}
              type="button"
            >
              {props.isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Skip questions and generate CV
            </SecondaryButton>
          </div>
        </Panel>
        <Panel className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <section>
              <p className="mb-3 text-sm font-semibold text-emerald-100">Strongest evidence found</p>
              <div className="space-y-3">
                {(cards.length ? cards : topStrengths(props.state)).map((item, index) => {
                  const card = isRecord(item) ? item : null;
                  return (
                    <div className="rounded-lg border border-emerald-200/15 bg-emerald-200/10 p-3" key={index}>
                      <p className="font-medium text-white">
                        {card ? textFromRecord(card, "requirementLabel") : "Evidence"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-300">
                        {card ? textFromRecord(card, "content") : String(item)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <p className="mb-3 text-sm font-semibold text-amber-100">Gaps to sharpen</p>
              <div className="space-y-3">
                {weakSpots(props.state).length > 0 ? (
                  weakSpots(props.state).map((spot) => (
                    <div className="rounded-lg border border-amber-200/15 bg-amber-200/10 p-3" key={spot}>
                      <p className="text-sm font-medium text-white">{spot}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                    No major gaps found.
                  </div>
                )}
              </div>
            </section>
          </div>
          <details className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              View full breakdown
            </summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
              {props.state.evidenceMatches.map((match) => (
                <p key={match.requirementId}>
                  <span className="font-medium text-white">{match.requirementLabel}:</span>{" "}
                  {match.reason}
                </p>
              ))}
            </div>
          </details>
        </Panel>
      </div>
    </Shell>
  );
}

function GapQuestionsStage(props: {
  questions: ApplicationState["gapQuestions"];
  answers: Record<string, GapAnswerDraft>;
  onChange: (id: string, answer: GapAnswerDraft) => void;
  onSubmit: (skipRemaining?: boolean) => void;
  isSubmitting: boolean;
}) {
  const [index, setIndex] = useState(0);
  const question = props.questions[index];
  const answer = question ? props.answers[question.id] ?? {} : {};
  const meta = question ? gapMeta(question) : null;
  const selectedTerminal = /^(skip|not yet|none|no)$/i.test(answer.selectedOption ?? "");
  const canContinue =
    !!answer.selectedOption && (selectedTerminal || !!answer.followUpText?.trim());

  if (!question) {
    return (
      <Shell title="No questions left." subtitle="Taylor can generate the CV now.">
        <PrimaryButton onClick={() => props.onSubmit(true)} type="button">
          Build my tailored CV
        </PrimaryButton>
      </Shell>
    );
  }

  return (
    <Shell
      eyebrow="Optional questions"
      title={`Question ${index + 1} of ${props.questions.length}`}
      subtitle="Answer with one short detail. Skip anything that is not true or useful."
    >
      <Panel className="max-w-4xl p-6">
        <div className="grid gap-5 lg:grid-cols-[0.46fr_0.54fr]">
          <div className="space-y-4">
            <p className="text-2xl font-semibold leading-tight text-white">{meta?.shortQuestion}</p>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-cyan-100">Why this matters</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{meta?.whyThisMatters}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-emerald-100">How your answer helps</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{meta?.howYourAnswerHelps}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {meta?.quickOptions.map((option) => {
                const selected = answer.selectedOption === option;
                return (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      selected
                        ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                        : "border-white/10 bg-black/20 text-zinc-100 hover:bg-white/10"
                    )}
                    key={option}
                    onClick={() =>
                      props.onChange(question.id, {
                        ...answer,
                        selectedOption: option,
                        skipped: /^skip$/i.test(option),
                        followUpText: /^(skip|not yet|none|no)$/i.test(option)
                          ? null
                          : answer.followUpText,
                      })
                    }
                    type="button"
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answer.selectedOption && !selectedTerminal ? (
              <textarea
                className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                onChange={(event) =>
                  props.onChange(question.id, {
                    ...answer,
                    followUpText: event.target.value,
                  })
                }
                placeholder={meta?.followUpPrompt}
                value={answer.followUpText ?? ""}
              />
            ) : null}
            <p className="text-xs leading-5 text-zinc-400">{meta?.dynamicGuidance}</p>
            {meta?.exampleAnswer ? (
              <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.08] p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-emerald-200">
                  Example answer
                </p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-300">{meta.exampleAnswer}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <SecondaryButton
            disabled={index === 0 || props.isSubmitting}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </SecondaryButton>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              disabled={props.isSubmitting}
              onClick={() =>
                props.onChange(question.id, {
                  selectedOption: "Skip",
                  skipped: true,
                  followUpText: null,
                })
              }
              type="button"
            >
              Skip current
            </SecondaryButton>
            <SecondaryButton
              disabled={props.isSubmitting}
              onClick={() => props.onSubmit(true)}
              type="button"
            >
              Skip all remaining
            </SecondaryButton>
            <PrimaryButton
              disabled={props.isSubmitting || !canContinue}
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
              {index === props.questions.length - 1 ? "Build my tailored CV" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </div>
      </Panel>
    </Shell>
  );
}

function CvPaper(props: { cv: StructuredCv; compact?: boolean }) {
  const contact = contactItems(props.cv.header);
  const sections = normalizeCvSections(props.cv);

  function contactIcon(kind: CvContactKind) {
    const className = "h-3.5 w-3.5 shrink-0 text-zinc-400";
    if (kind === "location") return <MapPin className={className} />;
    if (kind === "phone") return <Phone className={className} />;
    if (kind === "email") return <Mail className={className} />;
    if (kind === "linkedin") return <Link className={className} />;
    if (kind === "github") return <GitBranch className={className} />;
    if (kind === "portfolio") return <ExternalLink className={className} />;
    return <Link className={className} />;
  }

  function bulletList(bullets: string[]) {
    return (
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] leading-[1.45] text-zinc-800">
        {bullets.map((bullet, index) => (
          <li key={`${bullet}-${index}`}>{bullet}</li>
        ))}
      </ul>
    );
  }

  function experienceBlock(item: CvExperienceItem, index: number) {
    const title = joinPresent([item.role, item.company], " - ");
    const meta = joinPresent([item.dates, item.location], " | ");
    return (
      <div key={`${title}-${index}`} data-cv-experience-item>
        {title || meta ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            {title ? <p className="text-[13px] font-semibold leading-snug">{title}</p> : null}
            {meta ? <p className="text-[12px] leading-snug text-zinc-600">{meta}</p> : null}
          </div>
        ) : null}
        {bulletList(item.bullets.map(claimText))}
      </div>
    );
  }

  function projectBlock(item: CvProjectItem, index: number) {
    const title = joinPresent([item.name, item.descriptor], " - ");
    return (
      <div key={`${title}-${index}`}>
        {title || item.dates ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            {title ? <p className="text-[13px] font-semibold leading-snug">{title}</p> : null}
            {item.dates ? <p className="text-[12px] leading-snug text-zinc-600">{item.dates}</p> : null}
          </div>
        ) : null}
        {bulletList(item.bullets.map(claimText))}
      </div>
    );
  }

  function renderSection(section: ReturnType<typeof normalizeCvSections>[number]) {
    return (
      <section key={section.id}>
        <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase tracking-normal text-blue-700">
          {section.label}
        </h2>
        {section.type === "summary" || section.type === "inline" ? (
          <div className="mt-2 space-y-1 text-[12.5px] leading-[1.5] text-zinc-800">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
        ) : section.type === "bullets" || section.type === "certifications" ? (
          bulletList(section.bullets.map(claimText))
        ) : section.type === "projects" ? (
          <div className="mt-2 space-y-3">{section.items.map(projectBlock)}</div>
        ) : section.type === "experience" ? (
          <div className="mt-2 space-y-3">{section.items.map(experienceBlock)}</div>
        ) : section.type === "skills" ? (
          <dl className="mt-2 space-y-1 text-[12.5px] leading-[1.45]">
            {section.groups.map((group) => (
              <div className="grid gap-1 sm:grid-cols-[130px_1fr]" key={group.group}>
                <dt className="font-semibold text-zinc-950">{group.group}:</dt>
                <dd className="text-zinc-800">{group.skills.join(", ")}</dd>
              </div>
            ))}
          </dl>
        ) : section.type === "education" ? (
          <div className="mt-2 space-y-2">
            {section.items.map((item, index) => {
              const title = joinPresent([item.degree, item.institution], " - ");
              return (
                <div key={`${title}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    {title ? <p className="text-[13px] font-semibold leading-snug">{title}</p> : null}
                    {item.dates ? <p className="text-[12px] leading-snug text-zinc-600">{item.dates}</p> : null}
                  </div>
                  {item.details.length > 0 ? (
                    <p className="mt-1 text-[12.5px] leading-[1.45] text-zinc-700">
                      {item.details.join(", ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[794px] bg-white text-zinc-950 shadow-2xl shadow-black/30",
        props.compact ? "px-8 py-7" : "min-h-[1123px] px-12 py-10"
      )}
      data-cv-document
    >
      <header>
        {props.cv.header.name ? (
          <h1 className="text-[32px] font-bold leading-[1.05] tracking-normal text-zinc-950">
            {props.cv.header.name}
          </h1>
        ) : null}
        {props.cv.header.targetTitle ? (
          <p className="mt-1 text-[14px] font-semibold leading-5 text-blue-700">
            {props.cv.header.targetTitle}
          </p>
        ) : null}
        {contact.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-5 text-zinc-600">
            {contact.map((item) => (
              <span className="inline-flex items-center gap-1" key={`${item.kind}-${item.value}`}>
                {contactIcon(item.kind)}
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <div className="mt-6 space-y-4">
        {sections.map(renderSection)}
      </div>
    </article>
  );
}

function CvGeneratingStage() {
  return (
    <Shell title="Building your tailored CV." subtitle="Taylor is using your strongest evidence, then composing a one-page export-ready CV.">
      <div className="grid h-[72vh] min-h-0 gap-5 lg:grid-cols-[0.34fr_0.66fr]">
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-100" />
            <p className="font-semibold text-white">Taylor is writing</p>
          </div>
          <div className="mt-5">
            <ProgressChecklist
              items={[
                "Building your CV angle",
                "Writing your strongest evidence",
                "Formatting your one-page CV",
                "Checking role alignment",
              ]}
            />
          </div>
        </Panel>
        <div className="min-h-0 overflow-y-auto rounded-lg bg-white/5 p-5">
          <div className="mx-auto min-h-[760px] w-full max-w-[820px] bg-white px-10 py-9 shadow-2xl shadow-black/30">
            <div className="h-8 w-64 rounded bg-zinc-900" />
            <div className="mt-2 h-3 w-80 rounded bg-blue-200" />
            <div className="mt-8 space-y-8">
              {[0, 1, 2, 3].map((section) => (
                <div key={section}>
                  <div className="h-px w-full bg-zinc-200" />
                  <div className="mt-3 h-3 w-40 rounded bg-blue-700/70" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full rounded bg-zinc-200" />
                    <div className="h-3 w-10/12 rounded bg-zinc-200" />
                    <div className="h-3 w-8/12 rounded bg-zinc-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function FinalExportStage(props: {
  state: ApplicationState;
  cv: StructuredCv | null;
  onPdf: () => void;
  onDocx: () => void;
  exportError: string | null;
  isExporting: boolean;
}) {
  const before = props.state.originalEvidenceMatchScore ?? props.state.evidenceMatchScore.score;
  const after = props.state.updatedEvidenceMatchScore ?? before;
  const builder = isRecord(props.state.cvDraft?.builderOutputJson)
    ? props.state.cvDraft?.builderOutputJson
    : {};
  const strongest = stringArray(builder.strongestEvidenceUsed).slice(0, 4);
  const stillLimited = stringArray(builder.stillLimited).slice(0, 3);

  return (
    <Shell className="!max-w-7xl justify-start" title="Your tailored CV is ready.">
      <div className="grid h-[76vh] min-h-0 gap-5 lg:grid-cols-[0.32fr_0.68fr]">
        <Panel className="min-h-0 overflow-y-auto p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            Final result
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-zinc-400">Before</p>
              <p className="mt-1 text-4xl font-semibold text-white">{before}%</p>
            </div>
            <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/10 p-4">
              <p className="text-xs text-emerald-100">After</p>
              <p className="mt-1 text-4xl font-semibold text-white">{after}%</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-300">CV Match Strength</p>
          <section className="mt-6">
            <p className="text-sm font-semibold text-cyan-100">Taylor’s angle</p>
            <p className="mt-2 text-sm leading-6 text-zinc-200">
              {textFromRecord(builder, "cvAngle") ?? props.state.cvAngle ?? "Lead with strongest role-specific evidence."}
            </p>
          </section>
          {strongest.length > 0 ? (
            <section className="mt-6">
              <p className="text-sm font-semibold text-emerald-100">Strongest evidence used</p>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-300">
                {strongest.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {stillLimited.length > 0 ? (
            <section className="mt-6 rounded-lg border border-amber-200/15 bg-amber-200/10 p-4">
              <p className="text-sm font-semibold text-amber-100">Still limited</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{stillLimited.join(", ")}</p>
            </section>
          ) : null}
          <div className="mt-6 grid gap-3">
            <PrimaryButton disabled={!props.cv || props.isExporting} onClick={props.onPdf} type="button">
              {props.isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CV PDF
            </PrimaryButton>
            <SecondaryButton disabled={!props.cv || props.isExporting} onClick={props.onDocx} type="button">
              <Download className="h-4 w-4" />
              Export DOCX
            </SecondaryButton>
          </div>
          {props.exportError ? (
            <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              {props.exportError}
            </p>
          ) : null}
        </Panel>
        <div className="min-h-0 overflow-y-auto rounded-lg">
          {props.cv ? (
            <CvPaper cv={props.cv} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400">
              CV data is loading.
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

export default function Home() {
  const utils = api.useUtils();
  const session = useSession();
  const [showLanding, setShowLanding] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [resumedApplicationId, setResumedApplicationId] = useState<string | null>(null);
  const [stage, setStage] = useState<AppStage>("job_input");
  const [jobText, setJobText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [candidateFileName, setCandidateFileName] = useState<string | null>(null);
  const [isCandidateFileReading, setIsCandidateFileReading] = useState(false);
  const [candidateMode, setCandidateMode] = useState<"upload" | "linkedin">("upload");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [gapAnswers, setGapAnswers] = useState<Record<string, GapAnswerDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const recoveryPromiseRef = useRef<Promise<string | null> | null>(null);
  const checkout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (mutationError) => {
      if (mutationError.message === "ALREADY_HAS_SUBSCRIPTION") {
        window.location.href = "/dashboard";
        return;
      }
      setError(mutationError.message);
    },
  });

  const createApplication = api.application.createApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
      setShowLanding(false);
      setStage("job_input");
      window.history.pushState(null, "", `/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function recoverFromStaleApplication(preserveDraft = true) {
    localStorage.removeItem(currentApplicationStorageKey);
    setApplicationId(null);
    setResumedApplicationId(null);
    setShowLanding(false);
    setStage("job_input");
    setGapAnswers({});
    setError(null);
    window.history.replaceState(null, "", "/");

    if (!preserveDraft) {
      setJobText("");
      setCandidateText("");
      setCandidateFileName(null);
      setLinkedinUrl("");
      setCandidateMode("upload");
    }

    recoveryPromiseRef.current ??= createApplication
      .mutateAsync()
      .then((data) => data.applicationId)
      .catch((recoveryError) => {
        setError(clientErrorMessage(recoveryError));
        return null;
      })
      .finally(() => {
        recoveryPromiseRef.current = null;
      });

    return recoveryPromiseRef.current;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("applicationId");
    if (requested) {
      localStorage.setItem(currentApplicationStorageKey, requested);
      setApplicationId(requested);
      setShowLanding(false);
      return;
    }
    setShowLanding(true);
  }, []);

  const stateQuery = api.application.getApplicationState.useQuery(
    { applicationId: applicationId ?? "" },
    {
      enabled: !!applicationId,
      refetchInterval: stage === "candidate_scanning" ? 750 : false,
      refetchIntervalInBackground: true,
      retry: false,
    }
  );
  const state = stateQuery.data ?? null;
  const cv = useMemo(
    () => parseStructuredCv(state?.cvDraft?.cvJson ?? null),
    [state?.cvDraft?.cvJson]
  );

  useEffect(() => {
    if (!applicationId || !state || resumedApplicationId === applicationId) return;
    setResumedApplicationId(applicationId);
    if (!(stage === "job_analysis" && !state.job)) {
      setStage(deriveStage(state));
    }
    setJobText((current) => state.job?.rawText ?? current);
    setCandidateText((current) => state.candidateProfile?.rawCvText ?? current);
    setLinkedinUrl((current) => state.candidateProfile?.sourceUrl ?? current);
  }, [applicationId, resumedApplicationId, stage, state]);

  useEffect(() => {
    if (stage !== "candidate_scanning" || !isBackgroundMatchReady(state)) return;
    setStage("match_overview");
    setError(null);
  }, [stage, state]);

  useEffect(() => {
    if (!applicationId || !stateQuery.error) return;

    if (isStaleApplicationError(stateQuery.error.message)) {
      void recoverFromStaleApplication(true);
      return;
    }

    setError(stateQuery.error.message);
  }, [applicationId, createApplication, stateQuery.error]);

  const submitJob = api.application.submitJob.useMutation({
    onSuccess: async (_data, variables) => {
      localStorage.setItem(currentApplicationStorageKey, variables.applicationId);
      setApplicationId(variables.applicationId);
      setResumedApplicationId(variables.applicationId);
      setStage("job_analysis");
      window.history.replaceState(null, "", `/?applicationId=${variables.applicationId}`);
      await utils.application.getApplicationState.invalidate({
        applicationId: variables.applicationId,
      });
      setError(null);
    },
    onError: (mutationError, variables) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true).then((freshApplicationId) => {
          if (!freshApplicationId) return;
          setError(null);
          setStage("job_analysis");
          submitJob.mutate({
            applicationId: freshApplicationId,
            rawJobText: variables.rawJobText,
          });
        });
        return;
      }
      setStage("job_analysis");
      setError(mutationError.message);
    },
  });

  const submitCandidate = api.application.submitCandidateProfileSource.useMutation({
    onSuccess: async (data) => {
      if (!applicationId) return;
      if (data.importStatus === "needs_upload") {
        setCandidateMode("upload");
        setStage("candidate_source");
        setError(data.message);
        return;
      }
      await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("match_overview");
      setError(null);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setStage("candidate_source");
      setError(mutationError.message);
    },
  });

  const useSavedMemory = api.application.useSavedCandidateMemory.useMutation({
    onSuccess: async () => {
      if (!applicationId) return;
      await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("match_overview");
      setError(null);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setStage("candidate_source");
      setError(mutationError.message);
    },
  });

  const answerQuestions = api.application.answerGapQuestions.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      startCvGeneration();
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setError(mutationError.message);
    },
  });

  const generateCv = api.application.generateCv.useMutation({
    onSuccess: async () => {
      if (applicationId) await utils.application.getApplicationState.invalidate({ applicationId });
      setStage("final_export");
      setError(null);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      if (
        mutationError.message === "ACCOUNT_REQUIRED" ||
        mutationError.message === "EMAIL_VERIFICATION_REQUIRED"
      ) {
        setStage("auth_gate");
        setError(mutationError.message);
        return;
      }
      if (
        mutationError.message === "QUOTA_EXCEEDED" ||
        mutationError.message === "FREE_CV_LIMIT_REACHED"
      ) {
        setStage("paywall");
        setError(null);
        return;
      }
      setStage("error");
      setError(
        friendlyGenerationErrorMessage(
          mutationError.message,
          "Taylor created the CV strategy, but had trouble writing the final CV. Try again."
        )
      );
    },
  });

  const resetApplication = api.application.resetApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
      setShowLanding(false);
      setStage("job_input");
      setJobText("");
      setCandidateText("");
      setCandidateFileName(null);
      setLinkedinUrl("");
      setCandidateMode("upload");
      setGapAnswers({});
      setError(null);
      window.history.replaceState(null, "", `/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(false);
        return;
      }
      setError(mutationError.message);
    },
  });

  async function readCandidateFile(file: File) {
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
          pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        }
        text = pages.join("\n\n");
      } else if (name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setError("I could not read text from that file. Paste your CV text instead.");
        return;
      }
      setCandidateText(text);
      setError(null);
    } catch {
      setError("I could not read that file. Paste your CV text instead.");
    } finally {
      setIsCandidateFileReading(false);
    }
  }

  function enterWorkspace() {
    setError(null);
    const storedApplicationId = localStorage.getItem(currentApplicationStorageKey);
    if (storedApplicationId) {
      setApplicationId(storedApplicationId);
      setShowLanding(false);
      setStage("job_input");
      window.history.pushState(null, "", `/?applicationId=${storedApplicationId}`);
      return;
    }
    createApplication.mutate();
  }

  function selectPlan(planKey: PlanKey) {
    if (planKey === "free") {
      enterWorkspace();
      return;
    }
    if (!session.data?.user) {
      localStorage.setItem("pendingPlanKey", planKey);
      window.location.href = `/auth/sign-up?returnTo=${encodeURIComponent(`/dashboard?checkoutPlan=${planKey}`)}`;
      return;
    }
    checkout.mutate({ planKey: planKey as Exclude<PlanKey, "free"> });
  }

  function startCvGeneration() {
    if (!applicationId) return;
    if (!session.data?.user) {
      localStorage.setItem("pendingGenerateApplicationId", applicationId);
      setStage("auth_gate");
      return;
    }
    setStage("cv_generating");
    generateCv.mutate({ applicationId });
  }

  useEffect(() => {
    if (!session.data?.user || !applicationId || !state) return;
    const pending = localStorage.getItem("pendingGenerateApplicationId");
    if (pending !== applicationId || state.cvDraft || state.requirementFitScores.length === 0) return;
    localStorage.removeItem("pendingGenerateApplicationId");
    startCvGeneration();
  }, [applicationId, session.data?.user, state]);

  function submitGapAnswers(skipRemaining = false) {
    if (!applicationId || !state) return;
    const questions = state.gapQuestions.filter((question) => question.status === "unanswered");
    answerQuestions.mutate({
      applicationId,
      answers: questions.map((question) => {
        const draft = gapAnswers[question.id];
        const skipped = skipRemaining || draft?.skipped || !draft?.selectedOption;
        return {
          gapQuestionId: question.id,
          selectedOption: skipped ? "Skip" : draft?.selectedOption ?? null,
          followUpText: skipped ? null : draft?.followUpText?.trim() || null,
          answerText: skipped ? null : draft?.followUpText?.trim() || null,
          metricText: null,
          skipped,
        };
      }),
    });
  }

  async function exportWithTiming(kind: "pdf" | "docx") {
    if (!cv) return;
    setExportError(null);
    setIsExporting(true);
    const startedAt = performance.now();
    try {
      if (kind === "pdf") await exportCvPdf(cv, state?.cvDraft?.presentationJson);
      else await exportCvDocx(cv, state?.cvDraft?.presentationJson);
      logClientTiming("export preparation", performance.now() - startedAt, { format: kind });
    } catch {
      setExportError(`${kind.toUpperCase()} export failed. Try again after the CV finishes loading.`);
    } finally {
      setIsExporting(false);
    }
  }

  if (showLanding) {
    return (
      <LandingPage
        error={error}
        isCheckoutLoading={checkout.isPending}
        isLoading={createApplication.isPending}
        isSignedIn={!!session.data?.user}
        onDashboard={() => {
          window.location.href = "/dashboard";
        }}
        onGetStarted={enterWorkspace}
        onPlanSelected={selectPlan}
      />
    );
  }

  const unansweredQuestions =
    state?.gapQuestions.filter((question) => question.status === "unanswered").slice(0, 4) ?? [];
  const isJobInputStage = stage === "job_input";
  const isJobAnalysisStage = stage === "job_analysis";
  const isBackgroundStage = stage === "candidate_source";
  const isScanStage = stage === "candidate_scanning" || stage === "match_overview";
  const scanResultsReady = stage === "match_overview" || isBackgroundMatchReady(state);
  const isFocusedFlowStage =
    isJobInputStage || isJobAnalysisStage || isBackgroundStage || isScanStage;

  return (
    <main
      className={cn(
        "relative h-[100dvh] text-white",
        isScanStage ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden",
        isFocusedFlowStage ? "bg-[#030814]" : "bg-zinc-950"
      )}
    >
      {isFocusedFlowStage ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,#020712_0%,#06111f_44%,#071a2e_70%,#02050b_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_56%_39%,rgba(0,159,255,0.31),transparent_31%),radial-gradient(circle_at_78%_43%,rgba(37,99,235,0.22),transparent_29%),radial-gradient(circle_at_22%_55%,rgba(14,165,233,0.105),transparent_35%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.024] [background-image:linear-gradient(rgba(148,163,184,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:88px_88px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,20,0)_0%,rgba(3,8,20,0.12)_72%,#020611_100%)]" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(250,204,21,0.12),transparent_25%),linear-gradient(135deg,#09090b_0%,#111827_45%,#052e2b_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]" />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col">
        {isFocusedFlowStage ? null : (
          <TopRail
            onReset={() => {
              if (applicationId) resetApplication.mutate({ applicationId });
            }}
            resetDisabled={!applicationId || resetApplication.isPending}
          />
        )}
        {error && stage !== "error" && stage !== "job_analysis" && stage !== "candidate_source" ? (
          <div className="absolute left-1/2 top-20 z-30 w-[min(720px,calc(100%-32px))] -translate-x-1/2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100 backdrop-blur-xl">
            {error}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait">
            {stage === "job_input" ? (
              <JobInputStage
                isLoading={submitJob.isPending}
                key="job_input"
                onChange={setJobText}
                onSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setStage("job_analysis");
                  submitJob.mutate({ applicationId, rawJobText: jobText });
                }}
                value={jobText}
              />
            ) : null}
            {stage === "job_analysis" ? (
              <JobAnalysisStage
                error={error}
                isLoading={submitJob.isPending || stateQuery.isFetching}
                key="job_analysis"
                mutationData={submitJob.data}
                onContinue={() => setStage("candidate_source")}
                onEdit={() => {
                  setError(null);
                  setStage("job_input");
                }}
                state={state}
              />
            ) : null}
            {stage === "candidate_source" ? (
              <CandidateSourceStage
                candidateFileName={candidateFileName}
                candidateMemorySummary={state?.candidateMemorySummary ?? null}
                candidateText={candidateText}
                error={error}
                isLoading={submitCandidate.isPending || useSavedMemory.isPending}
                isReadingFile={isCandidateFileReading}
                key="candidate_source"
                linkedinUrl={linkedinUrl}
                mode={candidateMode}
                onCandidateFile={(file) => void readCandidateFile(file)}
                onCandidateText={setCandidateText}
                onLinkedInSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setStage("candidate_scanning");
                  submitCandidate.mutate({
                    applicationId,
                    source: "linkedin_url",
                    sourceUrl: linkedinUrl,
                    rawCvText: null,
                    rawBackgroundText: null,
                  });
                }}
                onLinkedInUrl={setLinkedinUrl}
                onMode={setCandidateMode}
                onUseSavedMemory={() => {
                  if (!applicationId) return;
                  setError(null);
                  setStage("candidate_scanning");
                  useSavedMemory.mutate({ applicationId });
                }}
                onUploadSubmit={() => {
                  if (!applicationId) return;
                  setError(null);
                  setStage("candidate_scanning");
                  submitCandidate.mutate({
                    applicationId,
                    source: "cv_upload",
                    rawCvText: candidateText,
                    rawBackgroundText: null,
                    sourceUrl: null,
                  });
                }}
              />
            ) : null}
            {isScanStage ? (
              <ScanningMatchStage
                isGenerating={generateCv.isPending}
                key="candidate_scan_flow"
                onAnswer={() => setStage("gap_questions")}
                onSkip={startCvGeneration}
                resultsReady={scanResultsReady}
                state={state}
              />
            ) : null}
            {stage === "gap_questions" ? (
              <GapQuestionsStage
                answers={gapAnswers}
                isSubmitting={answerQuestions.isPending || generateCv.isPending}
                key="gap_questions"
                onChange={(id, answer) =>
                  setGapAnswers((current) => ({ ...current, [id]: answer }))
                }
                onSubmit={submitGapAnswers}
                questions={unansweredQuestions}
              />
            ) : null}
            {stage === "cv_generating" ? <CvGeneratingStage key="cv_generating" /> : null}
            {stage === "auth_gate" ? (
              <AuthGateStage applicationId={applicationId} key="auth_gate" reason={error} />
            ) : null}
            {stage === "paywall" ? (
              <PaywallStage
                key="paywall"
                onPricing={() => {
                  setShowLanding(true);
                  window.history.replaceState(null, "", "/?pricing=1#pricing");
                  setTimeout(() => document.getElementById("pricing")?.scrollIntoView(), 0);
                }}
              />
            ) : null}
            {stage === "final_export" && state ? (
              <FinalExportStage
                cv={cv}
                exportError={exportError}
                isExporting={isExporting}
                key="final_export"
                onDocx={() => void exportWithTiming("docx")}
                onPdf={() => void exportWithTiming("pdf")}
                state={state}
              />
            ) : null}
            {stage === "error" ? (
              <Shell
                key="error"
                title="Taylor hit a problem."
                subtitle={error ?? "Something failed. Your progress is still saved."}
              >
                <Panel className="max-w-2xl p-6">
                  <div className="flex flex-wrap gap-3">
                    <PrimaryButton
                      onClick={() => {
                        setError(null);
                        if (
                          applicationId &&
                          state?.candidateProfile &&
                          state.requirementFitScores.length > 0 &&
                          !state.cvDraft
                        ) {
                          startCvGeneration();
                          return;
                        }
                        setStage(state ? deriveStage(state) : "job_input");
                      }}
                      type="button"
                    >
                      Retry
                      <ArrowRight className="h-4 w-4" />
                    </PrimaryButton>
                    <SecondaryButton onClick={() => setStage("candidate_source")} type="button">
                      Back to background
                    </SecondaryButton>
                  </div>
                </Panel>
              </Shell>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
