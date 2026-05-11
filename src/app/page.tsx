"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Link,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LandingPage } from "~/components/landing/LandingPage";
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
import { friendlyGenerationErrorMessage } from "~/lib/workflowStatus";
import { api, type RouterOutputs } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";
const staleApplicationErrorFragments = [
  "does not belong to this anonymous session",
  "does not belong to this session",
] as const;

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;
type AppStage =
  | "job_input"
  | "job_analysis"
  | "candidate_source"
  | "candidate_scanning"
  | "match_overview"
  | "gap_questions"
  | "cv_generating"
  | "final_export"
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
  console.info("taylor_timing", {
    step,
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
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
          <Sparkles className="h-4 w-4" />
        </div>
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

function JobInputStage(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <Shell
      eyebrow="Paste job"
      title="Paste the role. Taylor will find the hiring signals."
      subtitle="Use the full job description when you have it. If you only know the target role, paste that instead."
    >
      <Panel className="grid max-h-[72vh] grid-cols-1 overflow-hidden lg:grid-cols-[0.4fr_0.6fr]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-200/10 text-cyan-100">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-white">Job description</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Taylor caps and merges requirements so the rest of the pipeline stays fast.
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-cyan-100">Taylor extracts</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-300">
              {[
                "Role and company summary",
                "Top requirements and importance",
                "Role domain and CV archetype",
                "Language to reuse in the final CV",
              ].map((item) => (
                <li className="flex gap-2" key={item}>
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex min-h-0 flex-col p-4">
          <textarea
            className="min-h-[360px] flex-1 resize-none rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
            maxLength={20_000}
            onChange={(event) => props.onChange(event.target.value)}
            placeholder="Paste the job description here."
            value={props.value}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {props.value.length.toLocaleString()} / 20,000
            </p>
            <PrimaryButton
              disabled={props.isLoading || !props.value.trim()}
              onClick={props.onSubmit}
              type="button"
            >
              {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Analyse role
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </div>
      </Panel>
    </Shell>
  );
}

function JobAnalysisStage(props: {
  state: ApplicationState | null;
  isLoading: boolean;
  onContinue: () => void;
}) {
  if (props.isLoading || !props.state?.job) {
    return (
      <Shell title="Analysing the role." subtitle="Taylor is turning the job into a compact role profile.">
        <Panel className="max-w-3xl p-6">
          <ProgressChecklist
            items={[
              "Reading the job description",
              "Merging overlapping requirements",
              "Ranking hiring signals",
              "Preparing the role profile",
            ]}
          />
        </Panel>
      </Shell>
    );
  }
  const profile = props.state.jobProfileSummary;
  return (
    <Shell
      eyebrow="Role analysis"
      title={`Taylor found ${props.state.jobRequirements.length} key requirements.`}
      subtitle="This is the compact role profile the CV will be tailored around."
    >
      <Panel className="max-w-4xl p-6">
        <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
          <div>
            <p className="text-sm text-zinc-400">Role</p>
            <p className="mt-1 text-2xl font-semibold text-white">{profile?.role}</p>
            {profile?.company ? <p className="mt-1 text-zinc-300">{profile.company}</p> : null}
            <p className="mt-5 text-sm leading-6 text-zinc-300">{profile?.summary}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-100">Top requirements</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {props.state.jobRequirements.slice(0, 14).map((requirement) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-zinc-200"
                  key={requirement.id}
                >
                  {requirement.label}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Taylor’s role read</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {props.state.hiddenHiringSignal ?? "Lead with the most role-specific evidence."}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <PrimaryButton onClick={props.onContinue} type="button">
            Add my background
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </Panel>
    </Shell>
  );
}

function CandidateSourceStage(props: {
  candidateText: string;
  candidateFileName: string | null;
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
}) {
  return (
    <Shell
      eyebrow="Add background"
      title="Add your background so Taylor can find real evidence."
      subtitle="For MVP, Taylor uses either your current CV or a public LinkedIn URL. CV upload is the reliable path."
    >
      <div className="grid max-h-[74vh] min-h-0 gap-4 overflow-hidden lg:grid-cols-[0.34fr_0.66fr]">
        <div className="space-y-3">
          {[
            { id: "upload" as const, title: "Upload CV", copy: "PDF, DOCX, TXT, or pasted CV text.", icon: Upload },
            { id: "linkedin" as const, title: "LinkedIn public URL", copy: "Taylor will try to read the public profile automatically.", icon: FileText },
          ].map((option) => {
            const Icon = option.icon;
            const active = props.mode === option.id;
            return (
              <button
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition",
                  active
                    ? "border-cyan-200/50 bg-cyan-200/12"
                    : "border-white/10 bg-white/[0.05] hover:bg-white/[0.08]"
                )}
                key={option.id}
                onClick={() => props.onMode(option.id)}
                type="button"
              >
                <span className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-cyan-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{option.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-zinc-400">{option.copy}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <Panel className="min-h-0 overflow-y-auto p-5">
          {props.mode === "upload" ? (
            <div>
              <h2 className="text-xl font-semibold text-white">Upload current CV</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Taylor extracts facts, builds evidence chunks, retrieves matches, and plans the CV angle in one scan.
              </p>
              <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-200/30 bg-cyan-200/10 px-4 py-5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-200/15">
                {props.isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {props.isReadingFile ? "Reading file..." : props.candidateFileName ?? "Choose PDF, DOCX, TXT, or MD"}
                <input
                  accept=".txt,.md,.pdf,.docx"
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
                placeholder="Or paste your CV text here."
                value={props.candidateText}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-zinc-500">{props.candidateText.length.toLocaleString()} / 30,000</p>
                <PrimaryButton
                  disabled={props.isLoading || props.isReadingFile || !props.candidateText.trim()}
                  onClick={props.onUploadSubmit}
                  type="button"
                >
                  {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Scan background
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-white">LinkedIn public URL</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                If Taylor cannot read it automatically, you’ll be sent back to CV upload.
              </p>
              <input
                className="mt-5 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-200/60"
                onChange={(event) => props.onLinkedInUrl(event.target.value)}
                placeholder="https://www.linkedin.com/in/..."
                value={props.linkedinUrl}
              />
              <div className="mt-4 flex justify-end">
                <PrimaryButton
                  disabled={props.isLoading || !props.linkedinUrl.trim()}
                  onClick={props.onLinkedInSubmit}
                  type="button"
                >
                  {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Try LinkedIn import
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </div>
          )}
          {props.error ? (
            <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              {props.error}
            </p>
          ) : null}
        </Panel>
      </div>
    </Shell>
  );
}

function MatchOverviewStage(props: {
  state: ApplicationState;
  onAnswer: () => void;
  onSkip: () => void;
  isGenerating: boolean;
}) {
  const score = props.state.originalEvidenceMatchScore ?? props.state.updatedEvidenceMatchScore ?? props.state.evidenceMatchScore.score;
  const questions = props.state.gapQuestions.filter((question) => question.status === "unanswered");
  const cards = evidenceCards(props.state).slice(0, 4);
  return (
    <Shell
      eyebrow="Match overview"
      title={`${score}% CV Match Strength`}
      subtitle={props.state.matchLabel ?? "Taylor found the strongest current proof and the weak spots worth sharpening."}
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
              <p className="mb-3 text-sm font-semibold text-amber-100">Weak spots</p>
              <div className="space-y-3">
                {weakSpots(props.state).length > 0 ? (
                  weakSpots(props.state).map((spot) => (
                    <div className="rounded-lg border border-amber-200/15 bg-amber-200/10 p-3" key={spot}>
                      <p className="text-sm font-medium text-white">{spot}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                    No major weak spots found.
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
    { enabled: !!applicationId, retry: false }
  );
  const state = stateQuery.data ?? null;
  const cv = useMemo(
    () => parseStructuredCv(state?.cvDraft?.cvJson ?? null),
    [state?.cvDraft?.cvJson]
  );

  useEffect(() => {
    if (!applicationId || !state || resumedApplicationId === applicationId) return;
    setResumedApplicationId(applicationId);
    setStage(deriveStage(state));
    setJobText((current) => state.job?.rawText ?? current);
    setCandidateText((current) => state.candidateProfile?.rawCvText ?? current);
    setLinkedinUrl((current) => state.candidateProfile?.sourceUrl ?? current);
  }, [applicationId, resumedApplicationId, state]);

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
      setStage("job_input");
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

  function startCvGeneration() {
    if (!applicationId) return;
    setStage("cv_generating");
    generateCv.mutate({ applicationId });
  }

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
        isLoading={createApplication.isPending}
        onGetStarted={enterWorkspace}
      />
    );
  }

  const unansweredQuestions =
    state?.gapQuestions.filter((question) => question.status === "unanswered").slice(0, 4) ?? [];

  return (
    <main className="relative h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(250,204,21,0.12),transparent_25%),linear-gradient(135deg,#09090b_0%,#111827_45%,#052e2b_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="relative z-10 flex h-full flex-col">
        <TopRail
          onReset={() => {
            if (applicationId) resetApplication.mutate({ applicationId });
          }}
          resetDisabled={!applicationId || resetApplication.isPending}
        />
        {error && stage !== "error" ? (
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
                isLoading={submitJob.isPending || stateQuery.isFetching}
                key="job_analysis"
                onContinue={() => setStage("candidate_source")}
                state={state}
              />
            ) : null}
            {stage === "candidate_source" ? (
              <CandidateSourceStage
                candidateFileName={candidateFileName}
                candidateText={candidateText}
                error={error}
                isLoading={submitCandidate.isPending}
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
            {stage === "candidate_scanning" ? (
              <Shell
                key="candidate_scanning"
                title="Scanning your background."
                subtitle="Taylor is profiling facts, building evidence chunks, embedding in batch, retrieving matches, and planning gaps."
              >
                <Panel className="max-w-3xl p-6">
                  <ProgressChecklist
                    items={[
                      "Extracting profile facts",
                      "Building deterministic evidence chunks",
                      "Embedding evidence in batch",
                      "Retrieving role evidence",
                      "Planning the match overview",
                    ]}
                  />
                </Panel>
              </Shell>
            ) : null}
            {stage === "match_overview" && state ? (
              <MatchOverviewStage
                isGenerating={generateCv.isPending}
                key="match_overview"
                onAnswer={() => setStage("gap_questions")}
                onSkip={startCvGeneration}
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
