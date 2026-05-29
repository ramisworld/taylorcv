"use client";

import { ArrowRight, HelpCircle, Loader2, PenLine, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GlassCard, WorkflowPanel } from "~/components/cv-flow/JobDescriptionStep";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<RouterOutputs["application"]["getApplicationState"]>;
type GapQuestion = ApplicationState["gapQuestions"][number];

function questionMeta(question: GapQuestion) {
  const json =
    question.questionJson && typeof question.questionJson === "object" && !Array.isArray(question.questionJson)
      ? (question.questionJson as Record<string, unknown>)
      : {};
  return {
    why:
      typeof json.whyThisMatters === "string"
        ? json.whyThisMatters
        : question.whyItMatters ?? "This gives Taylor a stronger proof point for the final CV.",
    hint:
      typeof json.howYourAnswerHelps === "string"
        ? json.howYourAnswerHelps
        : question.answerGuidance ?? "A short, honest example is enough.",
  };
}

export function GapQuestionsStep(props: {
  questions: GapQuestion[];
  error?: string | null;
  isLoading: boolean;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: (answers: Array<{ gapQuestionId: string; answerText: string | null; skipped: boolean }>) => void;
}) {
  const answerable = useMemo(
    () => props.questions.filter((question) => question.status === "unanswered" && question.question.trim()),
    [props.questions]
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers((current) => {
      const next = { ...current };
      for (const question of answerable) {
        next[question.id] ??= "";
      }
      return next;
    });
  }, [answerable]);

  if (answerable.length === 0) {
    return (
      <WorkflowPanel
        eyebrow="Step 3 of 4"
        subtitle="Taylor already has enough useful evidence to write the first CV."
        title="No extra questions needed."
      >
        <GlassCard className="max-w-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#2450f4] text-white shadow-[0_16px_30px_rgba(36,80,244,0.24)]">
              <Sparkles className="h-5 w-5" />
            </span>
          <div>
            <p className="text-[18px] font-semibold text-[#080d22]">Taylor can move straight to writing.</p>
            <p className="mt-2 text-[14px] leading-6 text-[#5f6c84]">
              Your CV already gives enough role-relevant proof for this pass.
            </p>
          </div>
        </div>
        {props.error ? (
          <p className="mt-4 rounded-[12px] border border-amber-300/45 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {props.error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button className="h-11 rounded-[11px] border border-[#d8e0ee] bg-white/70 px-5 text-[14px] font-semibold text-[#314066]" onClick={props.onBack} type="button">
              Back
            </button>
            <button className="inline-flex h-[52px] items-center justify-center gap-3 rounded-[12px] bg-[#2450f4] px-6 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(32,71,240,0.28)]" onClick={props.onSkip} type="button">
              Generate my CV
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </GlassCard>
      </WorkflowPanel>
    );
  }

  return (
    <WorkflowPanel
      eyebrow="Step 3 of 4"
      subtitle="Answer what you can. These are optional, but each one can unlock stronger proof for the final CV."
      title="A few useful details before Taylor writes."
    >
      <div className="grid gap-4">
        {answerable.map((question, index) => {
          const meta = questionMeta(question);
          return (
            <GlassCard className="p-5" key={question.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#080d22] text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[17px] font-semibold leading-6 text-[#080d22]">
                      {question.question}
                    </p>
                    <p className="mt-3 flex gap-2 text-[13.5px] leading-5 text-[#5f6c84]">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2450f4]" />
                      {meta.why}
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#66728b]">
                    <PenLine className="h-3.5 w-3.5" />
                    Your answer
                  </span>
                  <textarea
                    className="h-32 w-full resize-none rounded-[14px] border border-[#cad8f2]/70 bg-white/74 px-4 py-3 text-[14px] leading-6 text-[#111827] outline-none transition placeholder:text-[#7a8599] focus:border-[#2450f4]/55 focus:bg-white focus:shadow-[0_0_0_4px_rgba(36,80,244,0.12)]"
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    placeholder={meta.hint}
                    value={answers[question.id] ?? ""}
                  />
                </label>
              </div>
            </GlassCard>
          );
        })}
      </div>
      {props.error ? (
        <p className="mt-4 rounded-[12px] border border-amber-300/45 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {props.error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="h-11 rounded-[11px] border border-[#d8e0ee] bg-white/70 px-5 text-[14px] font-semibold text-[#314066] transition hover:bg-white"
          disabled={props.isLoading}
          onClick={props.onBack}
          type="button"
        >
          Back
        </button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="h-11 rounded-[11px] border border-[#d8e0ee] bg-white/70 px-5 text-[14px] font-semibold text-[#314066] transition hover:bg-white disabled:opacity-55"
            disabled={props.isLoading}
            onClick={props.onSkip}
            type="button"
          >
            Skip questions
          </button>
          <button
            className={cn(
              "inline-flex h-[52px] items-center justify-center gap-3 rounded-[12px] bg-[#2450f4] px-6 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(32,71,240,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            )}
            disabled={props.isLoading}
            onClick={() =>
              props.onSubmit(
                answerable.map((question) => {
                  const answerText = answers[question.id]?.trim() ?? "";
                  return {
                    gapQuestionId: question.id,
                    answerText: answerText || null,
                    skipped: !answerText,
                  };
                })
              )
            }
            type="button"
          >
            {props.isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Sparkles className="h-4.5 w-4.5" />}
            Use these answers
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </WorkflowPanel>
  );
}
