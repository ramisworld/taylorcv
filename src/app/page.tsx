"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleDot,
  Clock3,
  Cloud,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  GitBranch,
  Lock,
  Loader2,
  Network,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  ShieldCheck,
  Target,
  Upload,
  Users,
  Zap,
  Link,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  UserRound,
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

function friendlyAnalysisErrorMessage(message: string) {
  if (/Unexpected token|<!DOCTYPE|not valid JSON|JSON\.parse|html/i.test(message)) {
    return "Taylor could not reach the analysis service cleanly. Check that the app server is running, then try again.";
  }
  if (/OpenAI Responses API failed/i.test(message)) {
    return "Taylor could not complete the AI analysis. Review your API configuration or try again shortly.";
  }
  return message;
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-white/10 transition hover:scale-[1.02] hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:scale-[1.02] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50",
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

const workflowSteps = [
  "JOB DESCRIPTION",
  "REQUIREMENTS",
  "ROLE MATCH",
  "YOUR CV PLAN",
] as const;

type WorkflowStepIndex = 0 | 1 | 2 | 3;

function WorkflowStepper(props: {
  currentStep: WorkflowStepIndex;
  completedThrough?: number;
  transitionFrom?: WorkflowStepIndex;
  transitionProgress?: number;
}) {
  const completedThrough = props.completedThrough ?? props.currentStep - 1;

  return (
    <nav aria-label="Taylor CV progress" className="mx-auto w-full max-w-[820px]">
      <ol className="grid grid-cols-4 items-start gap-0">
        {workflowSteps.map((step, index) => {
          const isComplete = index <= completedThrough;
          const isActive = index === props.currentStep;
          const isFuture = !isComplete && !isActive;
          const lineComplete = index <= completedThrough && index < workflowSteps.length - 1;
          const lineProgress =
            props.transitionFrom === index
              ? Math.max(0, Math.min(100, props.transitionProgress ?? 0))
              : lineComplete
                ? 100
                : 0;
          const lineInProgress =
            props.transitionFrom === index && lineProgress > 0 && lineProgress < 100;

          return (
            <li className="relative flex flex-col items-center" key={step}>
              {index < workflowSteps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%+29px)] right-[calc(-50%+29px)] top-[19px] h-[2px] bg-[#263248]/80"
                >
                  <span
                    className={cn(
                      "block h-full rounded-full transition-all ease-linear",
                      lineInProgress
                        ? "bg-[#009dff] shadow-[0_0_4px_rgba(0,157,255,0.82),0_0_9px_rgba(0,157,255,0.32)]"
                        : lineComplete
                        ? "bg-emerald-300 shadow-[0_0_4px_rgba(52,211,153,0.72),0_0_9px_rgba(52,211,153,0.30)]"
                        : "bg-[#009dff] shadow-[0_0_4px_rgba(0,157,255,0.82),0_0_9px_rgba(0,157,255,0.32)]"
                    )}
                    style={{
                      width: `${lineProgress}%`,
                      transitionDuration: lineInProgress ? "700ms" : "260ms",
                    }}
                  />
                </span>
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 bg-[#050b18] text-[16px] font-medium transition",
                  isComplete &&
                    "border-emerald-300 text-emerald-300 shadow-[0_0_4px_rgba(52,211,153,0.70),0_0_9px_rgba(52,211,153,0.22),inset_0_0_8px_rgba(16,185,129,0.07)]",
                  isActive &&
                    "border-[#00aaff] text-[#00aaff] shadow-[0_0_4px_rgba(0,170,255,0.82),0_0_10px_rgba(0,170,255,0.28),inset_0_0_8px_rgba(0,170,255,0.08)]",
                  isFuture &&
                    "border-[#344057] text-slate-400/78 shadow-[inset_0_0_10px_rgba(15,23,42,0.95)]"
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "mt-4 text-center text-[11px] font-semibold uppercase tracking-[-0.01em] transition sm:text-[12px]",
                  isComplete && "text-emerald-300 drop-shadow-[0_0_4px_rgba(52,211,153,0.38)]",
                  isActive && "text-[#00aaff] drop-shadow-[0_0_4px_rgba(0,170,255,0.42)]",
                  isFuture && "text-slate-400/78"
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WorkflowShell(props: {
  children: React.ReactNode;
  currentStep: WorkflowStepIndex;
  completedThrough?: number;
  transitionFrom?: WorkflowStepIndex;
  transitionProgress?: number;
  contentClassName?: string;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-h-0 flex-col overflow-y-auto px-5 pt-5 pb-5 sm:px-8 lg:px-10"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24 }}
    >
      <header className="relative z-20 flex justify-center">
        <TaylorBrand
          className="gap-3"
          markClassName="h-[42px] w-[42px]"
          textClassName="text-[28px] font-semibold tracking-[-0.045em]"
        />
      </header>
      <div className="mt-7">
        <WorkflowStepper
          completedThrough={props.completedThrough}
          currentStep={props.currentStep}
          transitionFrom={props.transitionFrom}
          transitionProgress={props.transitionProgress}
        />
      </div>
      <div className={cn("mx-auto w-full flex-1", props.contentClassName)}>
        {props.children}
      </div>
    </motion.section>
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
      <div className="relative h-full">{props.children}</div>
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

function confidenceLabel(confidence: string | null | undefined) {
  if (confidence === "high") return "Strong";
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

type DisplayChip = {
  id: string;
  displayLabel: string;
};

const leakedMockSoftwareLabels = [
  "rag",
  "retrieval",
  "agentic",
  "llm",
  "openai",
  "typescript",
  "next.js",
  "postgresql",
  "pgvector",
  "api",
  "apis",
  "evaluation",
  "structured outputs",
  "backend",
  "deployment",
];

const displayLabelRules: Array<{
  label: string;
  patterns: RegExp[];
}> = [
  { label: "Mathematics", patterns: [/\bmath(?:ematics)?\b/i, /\balgebra\b/i, /\bcalculus\b/i] },
  { label: "Teaching", patterns: [/\bteacher\b/i, /\bteaching\b/i, /\beducator\b/i, /\btutor\b/i] },
  { label: "Lesson Planning", patterns: [/\blesson\s+plan/i, /\bcurriculum\b/i, /\bunit\s+plan/i] },
  { label: "Classroom Management", patterns: [/\bclassroom\s+management\b/i, /\bbehaviou?r\s+management\b/i] },
  { label: "Assessment", patterns: [/\bassessment\b/i, /\bgrading\b/i, /\bmarking\b/i, /\bexam/i] },
  { label: "Student Support", patterns: [/\bstudent\s+support\b/i, /\blearning\s+support\b/i, /\bdifferentiation\b/i] },
  { label: "Music", patterns: [/\bmusic\b/i, /\binstrument/i, /\bchoir\b/i, /\bperformance\b/i] },
  { label: "Patient Care", patterns: [/\bpatient\s+care\b/i, /\bnurs(?:e|ing)\b/i, /\bclinical\b/i] },
  { label: "Healthcare", patterns: [/\bhealthcare\b/i, /\bmedical\b/i, /\bdoctor\b/i, /\bmedicine\b/i] },
  { label: "Accounting", patterns: [/\baccount(?:ant|ing)\b/i, /\breconciliation\b/i, /\btax\b/i] },
  { label: "Financial Analysis", patterns: [/\bfinance\b/i, /\bfinancial\s+analysis\b/i, /\bforecast/i] },
  { label: "Quantitative Analysis", patterns: [/\bquant\b/i, /\bstatistical\b/i, /\bmodelling\b/i, /\bmodeling\b/i] },
  { label: "Business Analysis", patterns: [/\bbusiness\s+analyst\b/i, /\brequirements\s+gathering\b/i, /\bprocess\s+mapping\b/i] },
  { label: "Stakeholder Management", patterns: [/\bstakeholder/i, /\bcross[-\s]?functional\b/i] },
  { label: "Plumbing", patterns: [/\bplumb(?:er|ing)\b/i, /\bpipe(?:work)?\b/i] },
  { label: "Safety Compliance", patterns: [/\bsafety\b/i, /\bcompliance\b/i, /\bcode\b/i] },
  { label: "Diagnostics", patterns: [/\bdiagnos(?:e|is|tic)\b/i, /\btroubleshoot/i] },
  { label: "Software Engineering", patterns: [/\bsoftware\b/i, /\bdeveloper\b/i, /\bengineer\b/i] },
  { label: "APIs", patterns: [/\bapi\b|\bapis\b/i] },
  { label: "TypeScript", patterns: [/\btypescript\b/i] },
  { label: "RAG", patterns: [/\brag\b|retrieval[-\s]?augmented/i] },
  { label: "Evaluation", patterns: [/\bevaluat(?:e|ion|ing)\b|\bevals?\b/i] },
  { label: "Communication", patterns: [/\bcommunication\b|\bcommunicat/i] },
  { label: "Research", patterns: [/\bresearch\b/i] },
  { label: "Leadership", patterns: [/\bleadership\b|\blead\b|\bmentor/i] },
  { label: "Collaboration", patterns: [/\bcollaboration\b|\bteamwork\b|\bteam\b/i] },
];

function hasSoftwareMockLeak(labels: string[], sourceText: string) {
  if (labels.length === 0) return false;
  const normalizedLabels = labels.join(" ").toLowerCase();
  const normalizedSource = sourceText.toLowerCase();
  const leakedCount = leakedMockSoftwareLabels.filter((label) =>
    normalizedLabels.includes(label)
  ).length;
  const sourceSupportsLeak = leakedMockSoftwareLabels.some((label) =>
    normalizedSource.includes(label)
  );
  return leakedCount >= Math.min(3, labels.length) && !sourceSupportsLeak;
}

function displayChipsFromText(sourceText: string, maxCount: number): DisplayChip[] {
  const text = sourceText.trim();
  if (!text) return [];
  const chips: DisplayChip[] = [];
  const seen = new Set<string>();

  for (const rule of displayLabelRules) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    const key = rule.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ id: `derived-${key.replace(/[^a-z0-9]+/g, "-")}`, displayLabel: rule.label });
    if (chips.length >= maxCount) return chips;
  }

  const tokens = text
    .replace(/[/_]+/g, " ")
    .split(/[^a-zA-Z0-9.+#-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3)
    .filter((token) => !displayStopWords.has(token.toLowerCase()));

  for (const token of tokens) {
    const label = titleCaseToken(token);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ id: `derived-${key.replace(/[^a-z0-9]+/g, "-")}`, displayLabel: label });
    if (chips.length >= maxCount) return chips;
  }

  return chips;
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

function confidenceDotClass(confidence: MatchConfidence) {
  if (confidence === "high") return "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.52)]";
  if (confidence === "medium") return "bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.42)]";
  if (confidence === "low") return "bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.36)]";
  return "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.28)]";
}

function EvidenceBreakdown(props: {
  counts: Record<MatchConfidence, number>;
}) {
  const items: MatchConfidence[] = ["high", "medium", "low", "missing"];

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="w-full max-w-[188px] rounded-lg border border-white/15 bg-[#07152a]/68 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      initial={{ opacity: 0, x: 14 }}
      transition={{ delay: 0.12, duration: 0.34 }}
    >
      {items.map((confidence) => (
        <div
          className="flex items-center justify-between border-b border-white/10 py-2 first:pt-1 last:border-b-0 last:pb-1"
          key={confidence}
        >
          <span className="flex items-center gap-2.5 text-[12px] font-normal text-white">
            <span className={cn("h-2 w-2 rounded-full", confidenceDotClass(confidence))} />
            {evidenceBreakdownLabel(confidence)}
          </span>
          <span className="text-[12px] font-medium text-white">{props.counts[confidence]}</span>
        </div>
      ))}
    </motion.div>
  );
}

function BackgroundAnalysisStage(props: {
  state: ApplicationState | null;
  rawCandidateText: string;
  rawJobText: string;
  resultsReady: boolean;
  onComplete: () => void;
}) {
  const timersRef = useRef({
    row1: randomBetween(4_000, 6_000),
    row2: randomBetween(5_000, 7_000),
  });
  const [row1Done, setRow1Done] = useState(false);
  const [row2Done, setRow2Done] = useState(false);
  const [progress, setProgress] = useState(0);
  const completionStartedRef = useRef(false);
  const onCompleteRef = useRef(props.onComplete);
  const chipRows = useMemo(() => {
    const profile = props.state?.candidateProfile;
    const profileLabels = [
      ...stringArray(profile?.skillsJson),
      ...stringArray(profile?.toolsJson),
    ];
    const uniqueLabels = [...new Set(profileLabels.map((label) => label.trim()).filter(Boolean))];
    const derivedText = `${props.rawCandidateText}\n${props.rawJobText}`;
    if (hasSoftwareMockLeak(uniqueLabels, derivedText)) {
      return displayChipsFromText(derivedText, 5);
    }
    return uniqueLabels.slice(0, 5).map((label) => ({
      id: `candidate-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      displayLabel: label,
    }));
  }, [props.rawCandidateText, props.rawJobText, props.state?.candidateProfile]);

  useEffect(() => {
    onCompleteRef.current = props.onComplete;
  }, [props.onComplete]);

  useEffect(() => {
    const timers = timersRef.current;
    const row1Timer = window.setTimeout(() => setRow1Done(true), timers.row1);
    const row2Timer = window.setTimeout(
      () => setRow2Done(true),
      timers.row1 + timers.row2
    );
    return () => {
      window.clearTimeout(row1Timer);
      window.clearTimeout(row2Timer);
    };
  }, []);

  useEffect(() => {
    if (completionStartedRef.current) return;
    const startedAt = performance.now();
    const cap = 85;
    const rampDurationMs = 18_000;
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const next = Math.min(cap, (elapsed / rampDurationMs) * cap);
      setProgress((current) => Math.max(current, next));
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!props.resultsReady || !row2Done || completionStartedRef.current) return;
    completionStartedRef.current = true;
    setProgress(100);
    const timer = window.setTimeout(() => onCompleteRef.current(), 700);
    return () => window.clearTimeout(timer);
  }, [props.resultsReady, row2Done]);

  const row3Done = props.resultsReady && row2Done;
  const rows = [
    {
      label: "Reading your CV",
      complete: row1Done,
      active: !row1Done,
      icon: <BookOpen className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-sky-400 border-sky-400 bg-sky-500/10",
    },
    {
      label: "Extracting skills, tools, and achievements",
      complete: row2Done,
      active: row1Done && !row2Done,
      icon: <Search className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-violet-400 border-violet-400 bg-violet-500/10",
    },
    {
      label: "Matching your background to the role",
      complete: row3Done,
      active: row2Done && !row3Done,
      icon: <Network className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-violet-400 border-violet-400 bg-violet-500/10",
    },
  ];

  return (
    <WorkflowShell
      completedThrough={1}
      contentClassName="flex max-w-[1060px] flex-col items-center pt-8 pb-4"
      currentStep={2}
      transitionFrom={1}
      transitionProgress={progress}
    >
      <JobGlassCard className="taylor-reference-card w-full rounded-[20px] p-7 sm:p-9">
        <div className="grid gap-6 sm:grid-cols-[92px_1fr]">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-blue-400/24 bg-blue-500/10 text-indigo-300 shadow-[0_0_24px_rgba(37,99,235,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Sparkles className="h-8 w-8" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[34px]">
              Analyzing your background
            </h1>
            <p className="mt-2 text-[18px] leading-6 text-slate-200">
              Extracting your experience and matching it to the role requirements.
            </p>
          </div>
        </div>

        <div className="mt-6 h-px bg-slate-500/28" />

        <ol className="mt-4">
          {rows.map((row) => (
            <li
              className="grid grid-cols-[62px_1fr_42px] items-center border-b border-slate-500/28 py-4"
              key={row.label}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_0_14px_rgba(37,99,235,0.13)]",
                  row.iconClass
                )}
              >
                {row.icon}
              </span>
              <span className="text-[20px] font-semibold tracking-[-0.025em] text-white">
                {row.label}
              </span>
              <span className="flex justify-end">
                <AnalysisRowMarker active={row.active} complete={row.complete} />
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5">
          {row1Done && chipRows.length > 0 ? (
            <>
            <p className="text-[16px] text-slate-300">Found so far</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {chipRows.map((requirement, index) => (
                <span
                  className="inline-flex h-9 items-center gap-3 rounded-[9px] border border-blue-400/32 bg-[#061429]/88 px-4 text-[16px] text-white shadow-[0_0_12px_rgba(37,99,235,0.06),inset_0_1px_0_rgba(255,255,255,0.05)]"
                  key={`${requirement.id}-${requirement.displayLabel}`}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index % 2 === 0
                        ? "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]"
                        : "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.65)]"
                    )}
                  />
                  {requirement.displayLabel}
                </span>
              ))}
            </div>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-slate-400">
              Taylor is extracting skills and achievements from your background.
            </p>
          )}
        </div>
      </JobGlassCard>
      <p className="mt-6 flex items-center justify-center gap-3 text-center text-[18px] text-slate-300/78">
        <Clock3 className="h-6 w-6 text-sky-400" strokeWidth={1.9} />
        Preparing your role match...
      </p>
    </WorkflowShell>
  );
}

function RoleMatchScoreRing(props: { score: number | null }) {
  if (props.score === null) {
    return (
      <div className="flex h-[190px] w-[190px] flex-col items-center justify-center rounded-full border border-slate-600/70 bg-[#050b18] text-center">
        <p className="text-[20px] font-semibold text-slate-300">Pending</p>
        <p className="mt-1 max-w-[120px] text-[12px] leading-4 text-slate-500">
          Match score unavailable
        </p>
      </div>
    );
  }

  const size = 224;
  const center = size / 2;
  const radius = 88;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - props.score / 100);

  return (
    <div className="relative flex h-[224px] w-[224px] shrink-0 items-center justify-center">
      <svg
        aria-label={`Current match ${props.score}%`}
        className="absolute inset-0 overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient id="role-match-score-gradient" x1="48" x2="184" y1="18" y2="202">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="24%" stopColor="#22d3ee" />
            <stop offset="57%" stopColor="#0ea5e9" />
            <stop offset="82%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#6d5dfc" />
          </linearGradient>
          <filter id="role-match-score-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" floodColor="#0ea5e9" floodOpacity="0.32" stdDeviation="2.2" />
          </filter>
        </defs>
        <circle cx={center} cy={center} fill="rgba(2,8,22,0.76)" r={radius + 17} />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="rgba(23,37,63,0.92)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          filter="url(#role-match-score-glow)"
          r={radius}
          stroke="url(#role-match-score-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-126 ${center} ${center})`}
        />
      </svg>
      <div className="relative z-10 text-center">
        <p className="text-[46px] font-light leading-none tracking-[-0.04em] text-white">
          {props.score}%
        </p>
        <p className="mt-3 text-[15px] font-medium text-cyan-300">Current match</p>
        <p className="mt-1 max-w-[132px] text-[11px] font-normal leading-4 text-slate-300/90">
          Overall evidence match score
        </p>
      </div>
    </div>
  );
}

function RoleMatchReadyStage(props: {
  state: ApplicationState | null;
  onAnswer?: () => void;
  onSkip?: () => void;
  isGenerating?: boolean;
}) {
  const rawScore =
    props.state?.originalEvidenceMatchScore ?? props.state?.evidenceMatchScore.score;
  const score = boundedScore(rawScore);
  const rows = topRequirementRows(props.state).slice(0, 4);
  const questions =
    props.state?.gapQuestions.filter((question) => question.status === "unanswered") ?? [];
  const breakdownCounts =
    props.state?.requirementFitScores.reduce(
      (counts, fit) => {
        counts[fitConfidence(fit)] += 1;
        return counts;
      },
      { high: 0, medium: 0, low: 0, missing: 0 } satisfies Record<MatchConfidence, number>
    ) ?? { high: 0, medium: 0, low: 0, missing: 0 };
  const hasRows = rows.length > 0;

  return (
    <WorkflowShell
      completedThrough={1}
      contentClassName="flex max-w-[1120px] flex-col items-center pt-4 pb-2"
      currentStep={2}
    >
      <JobGlassCard className="taylor-reference-card w-full rounded-[20px] p-5 sm:p-6">
        <div className="grid items-center gap-4 lg:grid-cols-[1fr_500px]">
          <div className="min-w-0">
            <span className="inline-flex h-7 items-center gap-2 rounded-lg border border-emerald-300/22 bg-emerald-300/10 px-3 text-[12px] font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.58)]" />
              Background scan complete
            </span>
            <h1 className="mt-4 text-balance text-[31px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[38px]">
              Your role match is ready
            </h1>
            <p className="mt-2 max-w-[540px] text-[15px] font-normal leading-6 text-slate-200">
              We reviewed your background and matched it to the role requirements.
              You can answer a few gap questions to strengthen your CV plan.
            </p>
          </div>

          <div className="flex items-center justify-center gap-5">
            <RoleMatchScoreRing score={score} />
            <EvidenceBreakdown counts={breakdownCounts} />
          </div>
        </div>

        <div className="mt-3.5">
          <h2 className="flex items-center gap-2 text-[16px] font-medium text-white">
            <Eye className="h-5 w-5 text-sky-400" />
            Taylor’s view
          </h2>
          <div className="mt-2.5 overflow-hidden rounded-[12px] border border-white/12 bg-[#061326]/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
            <div className="grid grid-cols-[1.05fr_1.65fr_112px] border-b border-white/10 px-4 py-2 text-[12px] font-normal text-slate-300">
              <span>Requirement</span>
              <span>Taylor’s view</span>
              <span className="text-center">Confidence</span>
            </div>
            {hasRows ? (
              rows.map((row, index) => (
                <div
                  className="grid grid-cols-[1.05fr_1.65fr_112px] items-center gap-3 border-b border-white/8 px-4 py-2.5 last:border-b-0"
                  key={row.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RequirementIcon index={index} />
                    <p className="min-w-0 truncate text-[14px] font-medium text-white">{row.label}</p>
                  </div>
                  <p className="line-clamp-1 text-[13px] font-normal leading-5 text-slate-300">{row.view}</p>
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "inline-flex h-7 min-w-[84px] items-center justify-center rounded-full border px-3 text-[13px] font-medium",
                        confidenceBadgeClass(row.confidence)
                      )}
                    >
                      {confidenceLabel(row.confidence)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-[15px] text-slate-400">
                Taylor’s requirement-level view is not available yet.
              </p>
            )}
          </div>
        </div>

        {props.onAnswer && props.onSkip ? (
          <div className="mt-3.5 flex items-center gap-4 rounded-[12px] border border-white/12 bg-[#061326]/72 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-400/25 bg-sky-500/10 text-sky-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-medium text-white">
                {questions.length} short gap {questions.length === 1 ? "question" : "questions"}
              </p>
              <p className="mt-0.5 text-[14px] font-normal text-slate-300">
                could improve your final CV plan.
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                className="inline-flex h-12 min-w-[270px] cursor-pointer items-center justify-center gap-3 rounded-[10px] bg-gradient-to-r from-sky-500 via-blue-500 to-violet-600 px-5 text-[15px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={props.isGenerating}
                onClick={props.onAnswer}
                type="button"
              >
                <Sparkles className="h-5 w-5" />
                Answer gap questions
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                className="inline-flex h-12 min-w-[188px] cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-blue-200/34 bg-[#08172b]/86 px-5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:scale-[1.02] hover:border-blue-200/50 hover:bg-[#0b1c34] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={props.isGenerating || !props.state}
                onClick={props.onSkip}
                type="button"
              >
                {props.isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Skip to CV plan
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : null}
      </JobGlassCard>
    </WorkflowShell>
  );
}

function ScanningMatchStage(props: {
  state: ApplicationState | null;
  rawCandidateText: string;
  rawJobText: string;
  onAnswer?: () => void;
  onScanComplete: () => void;
  onSkip?: () => void;
  isGenerating?: boolean;
  resultsReady: boolean;
  holdForAnimation: boolean;
}) {
  if (props.holdForAnimation) {
    return (
      <BackgroundAnalysisStage
        onComplete={props.onScanComplete}
        rawCandidateText={props.rawCandidateText}
        rawJobText={props.rawJobText}
        resultsReady={props.resultsReady}
        state={props.state}
      />
    );
  }

  return (
    <RoleMatchReadyStage
      isGenerating={props.isGenerating}
      onAnswer={props.onAnswer}
      onSkip={props.onSkip}
      state={props.state}
    />
  );
}

function JobInputStage(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const characterCount = props.value.length;
  const maxCharacters = 15_000;
  const benefits = [
    {
      title: "Private & secure",
      copy: "Your data stays yours",
      icon: ShieldCheck,
      tone: "text-cyan-300 bg-cyan-500/15 border-cyan-300/18",
    },
    {
      title: "Role-focused analysis",
      copy: "Tailored to this job",
      icon: Target,
      tone: "text-violet-300 bg-violet-500/15 border-violet-300/18",
    },
    {
      title: "Fast & actionable",
      copy: "Results in seconds",
      icon: Zap,
      tone: "text-blue-300 bg-blue-500/15 border-blue-300/18",
    },
  ];

  async function pasteFromClipboard() {
    textareaRef.current?.focus();
    try {
      const text = await navigator.clipboard?.readText();
      if (text) props.onChange(text.slice(0, maxCharacters));
    } catch {
      // Browser permissions may block clipboard access; focusing keeps manual paste ready.
    }
  }

  return (
    <WorkflowShell
      completedThrough={-1}
      contentClassName="max-w-[980px] pt-5 pb-3"
      currentStep={0}
    >
      <div className="text-center">
        <h1 className="relative inline-block text-balance text-[38px] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[48px] lg:text-[54px]">
          Paste the job description
          <Sparkles className="absolute -right-7 top-1 h-5 w-5 text-cyan-300 drop-shadow-[0_0_9px_rgba(34,211,238,0.68)] sm:-right-8 sm:h-5 sm:w-5" strokeWidth={2.1} />
        </h1>
        <p className="mt-3 text-[17px] leading-6 text-slate-200 sm:text-[18px]">
          We’ll analyze the role and give you a{" "}
          <span className="font-semibold text-sky-400">tailored CV strategy.</span>
        </p>
      </div>

      <JobGlassCard className="taylor-reference-card mt-4 rounded-[20px] p-5 sm:p-6">
        <div className="relative">
          <textarea
            className="h-[130px] w-full resize-none rounded-[14px] border border-blue-300/18 bg-[#050d1c]/88 px-5 py-5 pr-13 text-[16px] leading-6 text-slate-100 outline-none shadow-[inset_0_0_0_1px_rgba(15,23,42,0.74),inset_0_18px_38px_rgba(0,0,0,0.22)] placeholder:text-slate-300/70 focus:border-sky-400/70 focus:shadow-[0_0_0_1px_rgba(56,189,248,0.30),0_0_22px_rgba(14,165,233,0.12),inset_0_18px_38px_rgba(0,0,0,0.22)] sm:h-[142px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/70 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
            maxLength={maxCharacters}
            onChange={(event) => props.onChange(event.target.value)}
            placeholder="Paste the full job description here..."
            ref={textareaRef}
            value={props.value}
          />
          <button
            aria-label="Paste job description"
            className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-sky-400 transition hover:scale-110 hover:bg-sky-400/10 hover:text-sky-300"
            onClick={() => void pasteFromClipboard()}
            type="button"
          >
            <FileText className="h-5 w-5" strokeWidth={1.9} />
          </button>
          <p className="pointer-events-none absolute bottom-3 right-5 text-[13px] text-slate-300/78">
            {characterCount.toLocaleString()} / {maxCharacters.toLocaleString()}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                className="relative flex min-h-[68px] items-center gap-4 rounded-[10px] border border-white/7 bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] after:absolute after:right-[-7px] after:top-1/2 after:hidden after:h-5 after:w-px after:-translate-y-1/2 after:bg-blue-200/16 md:not-last:after:block"
                key={benefit.title}
              >
                <span
                  className={cn(
                    "flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border shadow-[0_0_18px_rgba(37,99,235,0.14)]",
                    benefit.tone
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={2.15} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold tracking-[-0.02em] text-white">
                    {benefit.title}
                  </span>
                  <span className="mt-1 block text-[14px] text-slate-300">
                    {benefit.copy}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <button
          className="group relative mt-4 inline-flex h-[58px] w-full items-center justify-center gap-4 rounded-[10px] bg-gradient-to-r from-sky-500 via-blue-500 to-violet-600 px-6 text-[21px] font-semibold tracking-[-0.025em] text-white shadow-[0_16px_42px_rgba(37,99,235,0.32),0_0_24px_rgba(124,58,237,0.14),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-100"
          disabled={props.isLoading || !props.value.trim()}
          onClick={props.onSubmit}
          type="button"
        >
          {props.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-6 w-6" strokeWidth={2.1} />
          )}
          Analyze this role
          <span className="absolute right-8 flex h-9 w-9 items-center justify-center rounded-full bg-white text-violet-600 transition group-hover:translate-x-1">
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>

        <p className="mt-3 flex items-center justify-center gap-2 text-center text-[14px] text-slate-300/78">
          <Lock className="h-3.5 w-3.5" />
          Secure analysis · Your data is never stored or shared
        </p>
      </JobGlassCard>

      <JobGlassCard className="mx-auto mt-4 max-w-[860px] rounded-[14px] border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.055)]">
        <div className="flex items-center gap-6">
          <span className="hidden h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-sky-400/25 bg-sky-500/10 text-sky-300 shadow-[0_0_24px_rgba(14,165,233,0.16)] sm:flex">
            <FileCheck2 className="h-[26px] w-[26px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-semibold text-white">How it works</span>
            <span className="mt-1 block max-w-[680px] text-[16px] leading-6 text-slate-300">
              Paste the job description and our AI will extract key requirements,
              match your experience, and build a CV strategy that gets results.
            </span>
          </span>
          <ArrowRight className="hidden h-6 w-6 shrink-0 text-blue-500 sm:block" />
        </div>
      </JobGlassCard>
    </WorkflowShell>
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

function AnalysisRowMarker(props: {
  complete: boolean;
  active: boolean;
}) {
  if (props.complete) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400 bg-[#041225] text-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.30)]">
        <Check className="h-4 w-4" strokeWidth={2.2} />
      </span>
    );
  }

  if (props.active) {
    return <span className="taylor-dotted-spinner" aria-label="Loading" />;
  }

  return null;
}

function JobAnalysisStage(props: {
  state: ApplicationState | null;
  mutationData?: SubmitJobResult;
  rawJobText: string;
  isLoading: boolean;
  error?: string | null;
  onEdit: () => void;
  onRetry: () => void;
  onAutoAdvance: () => void;
}) {
  const timersRef = useRef({
    row1: randomBetween(500, 1500),
    row2: randomBetween(1000, 3000),
    handoff: randomBetween(500, 800),
  });
  const timers = timersRef.current;
  const [row1Done, setRow1Done] = useState(false);
  const [row2Done, setRow2Done] = useState(false);
  const [row3Done, setRow3Done] = useState(false);
  const [handoffReady, setHandoffReady] = useState(false);
  const [lineProgress, setLineProgress] = useState(0);
  const autoAdvanceStartedRef = useRef(false);
  const failed = !!props.error;

  const job = props.state?.job ?? props.mutationData?.job ?? null;
  const requirements: AnalysisRequirement[] =
    props.state?.jobRequirements ?? props.mutationData?.jobRequirements ?? [];
  const displayRequirements = useMemo(
    () => {
      const requirementChips = topDisplayRequirements(requirements).slice(0, 5);
      if (
        hasSoftwareMockLeak(
          requirementChips.map((requirement) => requirement.displayLabel),
          props.rawJobText
        )
      ) {
        return displayChipsFromText(props.rawJobText, 5);
      }
      return requirementChips;
    },
    [props.rawJobText, requirements]
  );
  const backendReady = !!job && !props.isLoading && !failed;

  useEffect(() => {
    if (failed) return;
    const row1Timer = window.setTimeout(() => setRow1Done(true), timers.row1);
    const row2Timer = window.setTimeout(() => setRow2Done(true), timers.row1 + timers.row2);
    return () => {
      window.clearTimeout(row1Timer);
      window.clearTimeout(row2Timer);
    };
  }, [failed, timers.row1, timers.row2]);

  useEffect(() => {
    if (failed || row3Done) return;
    const startedAt = performance.now();
    const cap = 92;
    const rampDurationMs = 14_000;
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const nextProgress = Math.min(cap, (elapsed / rampDurationMs) * cap);
      setLineProgress((current) => Math.max(current, nextProgress));
    }, 120);
    return () => window.clearInterval(interval);
  }, [failed, row3Done]);

  useEffect(() => {
    if (!backendReady || !row2Done || row3Done) return;
    setRow3Done(true);
    setLineProgress(100);
    setHandoffReady(true);
  }, [backendReady, row2Done, row3Done]);

  useEffect(() => {
    if (!handoffReady || autoAdvanceStartedRef.current) return;
    autoAdvanceStartedRef.current = true;
    const timer = window.setTimeout(props.onAutoAdvance, timers.handoff);
    return () => window.clearTimeout(timer);
  }, [handoffReady, props.onAutoAdvance, timers.handoff]);

  const rows = [
    {
      label: "Reading the job description",
      complete: row1Done,
      active: !row1Done && !failed,
      icon: <BookOpen className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-sky-400 border-sky-400 bg-sky-500/10",
    },
    {
      label: "Finding key requirements",
      complete: row2Done,
      active: row1Done && !row2Done && !failed,
      icon: <Search className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-violet-400 border-violet-400 bg-violet-500/10",
    },
    {
      label: "Building your role map",
      complete: row3Done,
      active: row2Done && !row3Done && !failed,
      icon: <Network className="h-5 w-5" strokeWidth={2} />,
      iconClass: "text-violet-400 border-violet-400 bg-violet-500/10",
    },
  ];

  return (
    <WorkflowShell
      completedThrough={handoffReady ? 0 : -1}
      contentClassName="flex max-w-[820px] flex-col items-center pt-5 pb-3"
      currentStep={handoffReady ? 1 : 0}
      transitionFrom={0}
      transitionProgress={failed ? 0 : lineProgress}
    >
      <JobGlassCard className="taylor-reference-card w-full rounded-[20px] p-6 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-[72px_1fr]">
          <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full border border-blue-400/24 bg-blue-500/10 text-indigo-300 shadow-[0_0_24px_rgba(37,99,235,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Sparkles className="h-7 w-7" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[29px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
              Analyzing the role
            </h1>
            <p className="mt-1.5 text-[17px] leading-6 text-slate-200">
              Extracting the requirements and priorities for this job.
            </p>
          </div>
        </div>

        <div className="mt-5 h-px bg-slate-500/28" />

        <ol className="mt-3">
          {rows.map((row, index) => (
            <li
              className="grid grid-cols-[54px_1fr_38px] items-center border-b border-slate-500/28 py-3.5"
              key={row.label}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_0_14px_rgba(37,99,235,0.13)]",
                  row.iconClass
                )}
              >
                {row.icon}
              </span>
              <span className="text-[18px] font-semibold tracking-[-0.025em] text-white">
                {row.label}
              </span>
              <span className="flex justify-end">
                <AnalysisRowMarker
                  active={row.active}
                  complete={row.complete}
                />
              </span>
            </li>
          ))}
        </ol>

        {!failed ? (
          <div className="mt-4">
            <p className="text-[14px] text-slate-300">Found so far</p>
            {!row2Done ? (
              <p className="mt-2.5 text-[13px] text-slate-400">Finding requirements...</p>
            ) : displayRequirements.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {displayRequirements.map((requirement, index) => (
                  <span
                    className="inline-flex h-8 items-center gap-2.5 rounded-[9px] border border-blue-400/32 bg-[#061429]/88 px-3.5 text-[14px] text-white shadow-[0_0_12px_rgba(37,99,235,0.06),inset_0_1px_0_rgba(255,255,255,0.05)]"
                    key={`${requirement.id}-${requirement.displayLabel}`}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        index % 2 === 0
                          ? "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]"
                          : "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.65)]"
                      )}
                    />
                    {requirement.displayLabel}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 text-[13px] text-slate-400">Finding requirements...</p>
            )}
          </div>
        ) : null}

        {failed ? (
          <div className="mt-7 rounded-[16px] border border-red-300/20 bg-red-500/[0.08] p-5">
            <p className="text-[17px] font-semibold text-red-100">
              Taylor could not analyze this job description.
            </p>
            <p className="mt-2 text-[15px] leading-6 text-red-100/75">{props.error}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(37,99,235,0.22)] transition hover:scale-[1.02] hover:bg-blue-500"
                onClick={props.onRetry}
                type="button"
              >
                Retry analysis
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 text-[14px] font-semibold text-white transition hover:scale-[1.02] hover:bg-white/[0.12]"
                onClick={props.onEdit}
                type="button"
              >
                Edit job description
              </button>
            </div>
          </div>
        ) : null}
      </JobGlassCard>
      {!failed ? (
        <p className="mt-5 flex items-center justify-center gap-3 text-center text-[16px] text-slate-300/78">
          <Clock3 className="h-5 w-5 text-sky-400" strokeWidth={1.9} />
          Taking you to step 2 automatically...
        </p>
      ) : null}
    </WorkflowShell>
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
    <WorkflowShell
      completedThrough={0}
      contentClassName="flex max-w-[980px] flex-col items-center pt-4 pb-3"
      currentStep={1}
    >
          <div className="max-w-[720px] text-center">
            <h1 className="text-balance text-[34px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[42px] lg:text-[46px]">
              Let’s build your{" "}
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                standout CV
              </span>
            </h1>
            <p className="mx-auto mt-2.5 max-w-[560px] text-[15px] font-normal leading-6 text-slate-300 sm:text-[16px]">
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
                  className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 text-[14px] font-semibold text-emerald-950 transition hover:scale-[1.02] hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
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

          <JobGlassCard className="mt-4 w-full max-w-[860px] rounded-[20px] border-blue-300/22 bg-[#07162a]/78 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.30),0_0_36px_rgba(37,99,235,0.10),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
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
                      "relative -mb-px flex h-10 cursor-pointer items-center justify-center gap-2 border-b-2 text-[14px] font-semibold transition",
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

            <div className="mt-4">
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
                      "flex min-h-[218px] flex-col items-center justify-center rounded-xl border border-dashed px-5 py-5 text-center transition sm:min-h-[230px] sm:px-8",
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
                    <div className="relative mb-3 flex h-[74px] w-[96px] items-center justify-center">
                      <Sparkles className="absolute left-1 top-4 h-4 w-4 text-blue-400" />
                      <Sparkles className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-300" />
                      <span className="absolute bottom-5 left-3 h-1.5 w-1.5 rounded-full bg-blue-300/70" />
                      <span className="absolute right-1 top-12 h-1.5 w-1.5 rounded-full bg-blue-400/50" />
                      <span className="relative flex h-[66px] w-[56px] items-center justify-center rounded-[14px] border border-blue-200/24 bg-gradient-to-br from-blue-300/34 via-blue-500/26 to-indigo-700/36 shadow-[0_14px_30px_rgba(37,99,235,0.24),inset_0_1px_0_rgba(255,255,255,0.16)]">
                        <FileText className="h-8 w-8 text-blue-100/88" />
                      </span>
                      <span className="absolute bottom-0 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.36),inset_0_1px_0_rgba(255,255,255,0.22)]">
                        <Upload className="h-4.5 w-4.5" />
                      </span>
                    </div>

                    <h2 className="text-[20px] font-semibold tracking-[-0.025em] text-white">
                      Drag and drop your CV here
                    </h2>
                    <p className="mt-1.5 text-[13px] text-slate-400">or</p>

                    <label
                      aria-disabled={props.isReadingFile}
                      className={cn(
                        "mt-2.5 inline-flex h-11 min-w-[190px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-[15px] font-semibold text-white shadow-[0_16px_42px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500",
                        props.isReadingFile && "pointer-events-none opacity-70"
                      )}
                      htmlFor={uploadInputId}
                    >
                      {props.isReadingFile ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-4.5 w-4.5" />
                      )}
                      {props.isReadingFile ? "Reading file..." : "Choose file"}
                    </label>

                    <p className="mt-3 text-[13px] text-slate-400">
                      PDF, DOCX or TXT • Max 10MB
                    </p>

                    {selectedFileLabel ? (
                      <div className="mt-3 flex w-full max-w-[500px] flex-col items-center justify-between gap-3 rounded-lg border border-blue-200/14 bg-black/18 px-4 py-2.5 sm:flex-row">
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
                <div className="flex min-h-[218px] flex-col items-center justify-center rounded-xl border border-blue-300/18 bg-blue-500/[0.045] px-5 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:min-h-[230px] sm:px-10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200/20 bg-blue-600/18 text-blue-200 shadow-[0_16px_38px_rgba(37,99,235,0.18),inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <LinkedInMark className="h-6 w-6 border-blue-100/50 text-[14px] text-blue-100" />
                  </span>
                  <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.025em] text-white">
                    Paste your LinkedIn public URL
                  </h2>
                  <p className="mt-1.5 max-w-[520px] text-[14px] leading-5 text-slate-300">
                    Taylor can use your public profile to understand your
                    background and find role-relevant evidence.
                  </p>
                  <div className="mt-3 w-full max-w-[560px]">
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
                    className="mt-3 inline-flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-[14px] font-semibold text-white shadow-[0_16px_42px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
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

              <p className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-slate-400">
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

          <div className="mt-3 grid w-full max-w-[860px] gap-3 sm:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  className={cn(
                    "flex items-center gap-4 text-left",
                    index > 0 &&
                    "sm:border-l sm:border-white/10 sm:pl-4"
                  )}
                  key={benefit.title}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200/14 bg-blue-500/18 text-blue-100 shadow-[0_12px_28px_rgba(37,99,235,0.18)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-white">
                      {benefit.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-4 text-slate-400">
                      {benefit.copy}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
    </WorkflowShell>
  );
}

type GapChatMessage = {
  id: string;
  role: "taylor" | "user";
  text: string;
  thinking?: boolean;
};

type GapChatEvaluationResult = {
  boostPercent: number;
  totalBoostPercent: number;
  nextGapQuestionId: string | null;
  allQuestionsComplete: boolean;
};

function TaylorThinking() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-2" aria-label="Taylor is thinking">
      {[0, 1, 2].map((dot) => (
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-300/90"
          key={dot}
          style={{ animationDelay: `${dot * 120}ms` }}
        />
      ))}
    </span>
  );
}

function GapQuestionsStage(props: {
  applicationId: string;
  questions: ApplicationState["gapQuestions"];
  onBack: () => void;
  onComplete: () => void;
  onRefresh: () => Promise<void>;
  onSkip: (gapQuestionId: string) => Promise<ApplicationState["gapQuestions"]>;
  isGenerating: boolean;
}) {
  const initialQuestion = props.questions.find((question) => question.status === "unanswered");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    initialQuestion?.id ?? null
  );
  const [messages, setMessages] = useState<GapChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [totalBoost, setTotalBoost] = useState(0);
  const [acceptedBoostCount, setAcceptedBoostCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const displayedBoostTotalRef = useRef(0);
  const streamedQuestionIdsRef = useRef(new Set<string>());
  const activeQuestion =
    props.questions.find((question) => question.id === activeQuestionId) ??
    props.questions.find((question) => question.status === "unanswered") ??
    null;
  const completedCount = props.questions.filter(
    (question) => question.status !== "unanswered"
  ).length;
  const unansweredCount = props.questions.filter(
    (question) => question.status === "unanswered"
  ).length;
  const progressIndex = Math.min(
    Math.max(1, props.questions.length),
    Math.max(1, completedCount + (activeQuestion ? 1 : 0))
  );
  const isFinalQuestion = !!activeQuestion && unansweredCount <= 1;

  function appendMessage(message: GapChatMessage) {
    setMessages((current) => [...current, message]);
  }

  function appendText(id: string, delta: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, text: `${message.text}${delta}`, thinking: false }
          : message
      )
    );
  }

  function showAcceptedBoost(total: number) {
    if (total <= displayedBoostTotalRef.current) return;
    displayedBoostTotalRef.current = total;
    setTotalBoost(total);
    setAcceptedBoostCount((count) => count + 1);
  }

  async function streamQuestion(question: ApplicationState["gapQuestions"][number]) {
    if (streamedQuestionIdsRef.current.has(question.id)) return;
    streamedQuestionIdsRef.current.add(question.id);
    setIsBusy(true);
    const id = `question-${question.id}-${Date.now()}`;
    appendMessage({ id, role: "taylor", text: "", thinking: true });
    await new Promise((resolve) => setTimeout(resolve, 320));
    for (const delta of question.question.match(/\S+\s*|\s+/g) ?? [question.question]) {
      appendText(id, delta);
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    setIsBusy(false);
  }

  useEffect(() => {
    if (!activeQuestion || messages.length > 0) return;
    void streamQuestion(activeQuestion);
  }, [activeQuestion, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function readEvaluationStream(userMessage: string) {
    if (!activeQuestion) throw new Error("No gap question is ready.");
    const response = await fetch("/api/gap-answer-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: props.applicationId,
        gapQuestionId: activeQuestion.id,
        userMessage,
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error("Taylor could not evaluate that answer.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantId: string | null = null;
    let nextQuestionMessageId: string | null = null;
    const resultRef: { current: GapChatEvaluationResult | null } = { current: null };
    const handleEvent = (block: string) => {
      const eventName = block
        .split(/\r?\n/)
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim();
      const dataLine = block
        .split(/\r?\n/)
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!eventName || !dataLine) return;
      const data = JSON.parse(dataLine) as Record<string, unknown>;
      if (eventName === "thinking" && !assistantId) {
        assistantId = `reply-${Date.now()}`;
        appendMessage({ id: assistantId, role: "taylor", text: "", thinking: true });
      }
      if (eventName === "assistant_delta" && typeof data.delta === "string") {
        assistantId ??= `reply-${Date.now()}`;
        appendText(assistantId, data.delta);
      }
      if (eventName === "next_question_thinking") {
        nextQuestionMessageId = `next-${String(data.gapQuestionId)}-${Date.now()}`;
        appendMessage({
          id: nextQuestionMessageId,
          role: "taylor",
          text: "",
          thinking: true,
        });
      }
      if (
        eventName === "next_question_delta" &&
        nextQuestionMessageId &&
        typeof data.delta === "string"
      ) {
        appendText(nextQuestionMessageId, data.delta);
      }
      if (eventName === "result") {
        resultRef.current = data as unknown as GapChatEvaluationResult;
      }
      if (eventName === "boost" && typeof data.totalBoostPercent === "number") {
        showAcceptedBoost(data.totalBoostPercent);
      }
      if (eventName === "error") {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Taylor could not evaluate that answer."
        );
      }
    };
    while (true) {
      const next = await reader.read();
      buffer += decoder.decode(next.value, { stream: !next.done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      blocks.forEach(handleEvent);
      if (next.done) break;
    }
    const result = resultRef.current;
    if (!result) throw new Error("Taylor did not finish evaluating that answer.");
    return result;
  }

  async function sendAnswer() {
    const userMessage = draft.trim();
    if (!activeQuestion || !userMessage || isBusy || props.isGenerating) return;
    setDraft("");
    setIsBusy(true);
    appendMessage({ id: `user-${Date.now()}`, role: "user", text: userMessage });
    try {
      const result = await readEvaluationStream(userMessage);
      if (result.boostPercent > 0) {
        showAcceptedBoost(result.totalBoostPercent);
      }
      setActiveQuestionId(result.nextGapQuestionId);
      await props.onRefresh();
      if (result.allQuestionsComplete) props.onComplete();
    } catch (streamError) {
      appendMessage({
        id: `error-${Date.now()}`,
        role: "taylor",
        text:
          streamError instanceof Error
            ? streamError.message
            : "Taylor could not evaluate that answer.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function skipCurrent() {
    if (!activeQuestion || isBusy || props.isGenerating) return;
    setIsBusy(true);
    appendMessage({ id: `skip-${Date.now()}`, role: "user", text: "Skip this question." });
    try {
      const questions = await props.onSkip(activeQuestion.id);
      const next = questions.find((question) => question.status === "unanswered");
      setActiveQuestionId(next?.id ?? null);
      if (next) {
        await streamQuestion(next);
      } else {
        props.onComplete();
      }
    } catch (skipError) {
      appendMessage({
        id: `skip-error-${Date.now()}`,
        role: "taylor",
        text:
          skipError instanceof Error
            ? skipError.message
            : "Taylor could not skip that question.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <WorkflowShell
      completedThrough={1}
      contentClassName="flex max-w-[1080px] items-start justify-center pt-7 pb-2"
      currentStep={2}
    >
      <JobGlassCard className="gap-chat-card flex h-[min(748px,calc(100dvh-216px))] min-h-[600px] w-full max-w-[1030px] flex-col rounded-[20px] px-6 py-6 sm:px-8">
        <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border border-blue-500/35 bg-[#071632] text-violet-400 shadow-[inset_0_0_24px_rgba(14,165,233,0.10)]">
              <Sparkles className="h-8 w-8" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[27px] font-medium leading-tight text-white sm:text-[31px]">
                Answer a few quick gap questions
              </h1>
              <p className="mt-2 text-[15px] font-normal leading-6 text-slate-300">
                Taylor is filling the missing evidence before building your CV plan.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <span className="inline-flex h-[66px] items-center gap-3 rounded-[13px] border border-white/12 bg-[#07162b]/78 px-5 text-[16px] font-normal text-white">
              <MessageSquare className="h-5 w-5 text-sky-400" />
              {progressIndex} of {Math.max(1, props.questions.length)}
            </span>
            {totalBoost > 0 ? (
              <span className="inline-flex min-h-[66px] min-w-[188px] flex-col justify-center rounded-[13px] border border-white/12 bg-[#07162b]/78 px-5 text-[13px] font-normal text-slate-300">
                <span>Match boost</span>
                <span className="text-[20px] font-normal text-emerald-300">
                  +{totalBoost}%{acceptedBoostCount > 1 ? " total" : ""}
                </span>
              </span>
            ) : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-6">
          {messages.map((message) => (
            <div
              className={cn(
                "flex items-end gap-3",
                message.role === "user" && "justify-end"
              )}
              key={message.id}
            >
              {message.role === "taylor" ? (
                <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-fuchsia-500/75 bg-[#06152b] shadow-[0_0_20px_rgba(168,85,247,0.12)]">
                  <TaylorLogoMark className="h-8 w-8" />
                </span>
              ) : null}
              <div className={cn("max-w-[min(650px,78%)]", message.role === "user" && "text-right")}>
                <div
                  className={cn(
                    "rounded-[14px] px-5 py-3.5 text-left text-[16px] font-normal leading-7",
                    message.role === "taylor" &&
                      "border border-slate-500/30 bg-[#081a35]/82 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    message.role === "user" &&
                      "border border-transparent bg-[linear-gradient(#061833,#061833)_padding-box,linear-gradient(112deg,#00f0d2,#15cfff_36%,#8b32ff)_border-box] text-white shadow-[0_0_16px_rgba(37,99,235,0.10)]"
                  )}
                >
                  {message.thinking ? <TaylorThinking /> : message.text}
                </div>
              </div>
              {message.role === "user" ? (
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-slate-400/45 bg-[#061326] text-slate-200">
                  <UserRound className="h-7 w-7" />
                </span>
              ) : null}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t border-white/10 pt-4">
          <label className="flex min-h-[74px] items-center gap-3 rounded-[13px] border border-sky-500/80 bg-[#031125]/78 px-5 shadow-[inset_0_0_26px_rgba(14,165,233,0.05)] focus-within:border-cyan-300">
            <textarea
              className="max-h-28 min-h-[30px] flex-1 resize-none bg-transparent py-2 text-[16px] font-normal leading-6 text-white outline-none placeholder:text-slate-400"
              disabled={!activeQuestion || isBusy || props.isGenerating}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendAnswer();
                }
              }}
              placeholder="Type your answer here..."
              rows={1}
              value={draft}
            />
            <button
              aria-label="Send answer"
              className="text-white transition hover:text-cyan-200 disabled:opacity-40"
              disabled={!draft.trim() || !activeQuestion || isBusy || props.isGenerating}
              onClick={() => void sendAnswer()}
              type="button"
            >
              <Send className="h-6 w-6" />
            </button>
          </label>
          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <SecondaryButton disabled={isBusy || props.isGenerating} onClick={props.onBack} type="button">
              <ArrowLeft className="h-5 w-5" />
              Back
            </SecondaryButton>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto sm:flex-nowrap">
              <SecondaryButton disabled={!activeQuestion || isBusy || props.isGenerating} onClick={() => void skipCurrent()} type="button">
                Skip
              </SecondaryButton>
              <button
                className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-[11px] bg-gradient-to-r from-sky-500 via-blue-500 to-violet-600 px-5 text-[16px] font-normal text-white shadow-[0_14px_34px_rgba(37,99,235,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[236px]"
                disabled={!draft.trim() || !activeQuestion || isBusy || props.isGenerating}
                onClick={() => void sendAnswer()}
                type="button"
              >
                {isBusy ? "Taylor is thinking" : isFinalQuestion ? "Generate CV" : "Send answer"}
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </JobGlassCard>
    </WorkflowShell>
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
    <WorkflowShell
      completedThrough={2}
      contentClassName="max-w-7xl pt-10"
      currentStep={3}
    >
      <div className="mb-7 max-w-3xl">
        <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
          Building your tailored CV.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
          Taylor is using your strongest evidence, then composing a one-page export-ready CV.
        </p>
      </div>
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
    </WorkflowShell>
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
    if (stage !== "job_analysis") {
      setStage(deriveStage(state));
    }
    setJobText((current) => state.job?.rawText ?? current);
    setCandidateText((current) => state.candidateProfile?.rawCvText ?? current);
    setLinkedinUrl((current) => state.candidateProfile?.sourceUrl ?? current);
  }, [applicationId, resumedApplicationId, stage, state]);

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
      setError(friendlyAnalysisErrorMessage(mutationError.message));
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
      setStage("candidate_scanning");
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
      setStage("candidate_scanning");
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

  const skipGapQuestionMutation = api.application.skipGapQuestion.useMutation();

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

  const isJobInputStage = stage === "job_input";
  const isJobAnalysisStage = stage === "job_analysis";
  const isBackgroundStage = stage === "candidate_source";
  const isScanStage = stage === "candidate_scanning" || stage === "match_overview";
  const isPlanStage = stage === "gap_questions" || stage === "cv_generating";
  const scanResultsReady = stage === "match_overview" || isBackgroundMatchReady(state);
  const isFocusedFlowStage =
    isJobInputStage || isJobAnalysisStage || isBackgroundStage || isScanStage || isPlanStage;

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
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,#02050d_0%,#030713_48%,#030b19_72%,#02040a_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_42%,rgba(0,132,255,0.055),transparent_36%),radial-gradient(ellipse_at_75%_48%,rgba(124,58,237,0.035),transparent_34%),radial-gradient(ellipse_at_25%_50%,rgba(14,165,233,0.035),transparent_36%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,13,0)_0%,rgba(2,5,13,0.10)_72%,#02050d_100%)]" />
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
                onAutoAdvance={() => {
                  setError(null);
                  setStage("candidate_source");
                }}
                onEdit={() => {
                  setError(null);
                  setStage("job_input");
                }}
                onRetry={() => {
                  if (!applicationId || !jobText.trim()) return;
                  setError(null);
                  submitJob.mutate({ applicationId, rawJobText: jobText });
                }}
                rawJobText={jobText}
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
                holdForAnimation={stage === "candidate_scanning"}
                isGenerating={generateCv.isPending}
                key="candidate_scan_flow"
                onAnswer={() => setStage("gap_questions")}
                onScanComplete={() => {
                  setError(null);
                  setStage("match_overview");
                }}
                onSkip={startCvGeneration}
                rawCandidateText={candidateText}
                rawJobText={jobText}
                resultsReady={scanResultsReady}
                state={state}
              />
            ) : null}
            {stage === "gap_questions" ? (
              <GapQuestionsStage
                applicationId={applicationId ?? ""}
                isGenerating={generateCv.isPending || skipGapQuestionMutation.isPending}
                key="gap_questions"
                onBack={() => setStage("match_overview")}
                onComplete={startCvGeneration}
                onRefresh={async () => {
                  if (!applicationId) return;
                  await utils.application.getApplicationState.invalidate({ applicationId });
                }}
                onSkip={async (gapQuestionId) => {
                  if (!applicationId) return [];
                  const data = await skipGapQuestionMutation.mutateAsync({
                    applicationId,
                    gapQuestionId,
                  });
                  await utils.application.getApplicationState.invalidate({ applicationId });
                  return data.gapQuestions;
                }}
                questions={state?.gapQuestions ?? []}
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
