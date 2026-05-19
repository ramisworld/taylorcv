"use client";

import { useEffect, useMemo, useState } from "react";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

export type GapAnswerDraft = {
  buttonAnswer?: "yes" | "kind_of" | "no" | "skip";
  elaboration?: string;
};

const answerOptions: Array<{
  value: "yes" | "kind_of" | "no" | "skip";
  label: string;
}> = [
  { value: "yes", label: "Yes" },
  { value: "kind_of", label: "Kind of" },
  { value: "no", label: "No" },
  { value: "skip", label: "Skip" },
];

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function textFromRecord(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return typeof item === "string" && item.trim() ? item : null;
}

function CoachBubble(props: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl rounded-lg bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-800">
      {props.children}
    </div>
  );
}

function UserBubble(props: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-2xl rounded-lg bg-zinc-950 px-4 py-3 text-sm leading-6 text-white">
      {props.children}
    </div>
  );
}

export function GapCoachChat(props: {
  coachInsight: ApplicationState["gapCoachInsight"] | null;
  questions: ApplicationState["gapQuestions"];
  answers: Record<string, GapAnswerDraft>;
  onChange: (questionId: string, answer: GapAnswerDraft) => void;
  onGenerate: () => void;
  onSubmit: () => void;
  onSkipAll: () => void;
  isGenerating: boolean;
  isSubmitting: boolean;
  isPrimary?: boolean;
  disabled?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleIntroCount, setVisibleIntroCount] = useState(0);
  const activeQuestion = props.questions[activeIndex] ?? null;
  const activeAnswer = activeQuestion
    ? (props.answers[activeQuestion.id] ?? {})
    : {};
  const needsElaboration =
    activeAnswer.buttonAnswer === "yes" ||
    activeAnswer.buttonAnswer === "kind_of";
  const canAdvance =
    !!activeAnswer.buttonAnswer &&
    (!needsElaboration || !!activeAnswer.elaboration?.trim());
  const buttonClass = props.isPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";
  const introMessages = useMemo(() => {
    if (!props.coachInsight) return [];

    const strengths = stringArray(props.coachInsight.candidateStrengthsJson);
    const concerns = stringArray(props.coachInsight.candidateConcernsJson);
    const messages = [
      props.coachInsight.openingMessage,
      props.coachInsight.jobWants,
    ];

    if (strengths.length > 0) {
      messages.push(`Where you look strong: ${strengths.join(" ")}`);
    }

    if (concerns.length > 0) {
      messages.push(
        `Where we can make this sharper: ${concerns.join(" ")}`
      );
    }

    return messages.filter(Boolean);
  }, [props.coachInsight]);
  const activeMeta = isRecord(activeQuestion?.questionJson)
    ? activeQuestion.questionJson
    : {};
  const exampleAnswer = textFromRecord(activeMeta, "exampleAnswer");

  useEffect(() => {
    setVisibleIntroCount(0);
  }, [props.coachInsight?.id]);

  useEffect(() => {
    if (visibleIntroCount >= introMessages.length) return;

    const timeout = window.setTimeout(
      () => setVisibleIntroCount((current) => current + 1),
      visibleIntroCount === 0 ? 150 : 450
    );
    return () => window.clearTimeout(timeout);
  }, [introMessages.length, visibleIntroCount]);

  function updateActiveAnswer(answer: GapAnswerDraft) {
    if (!activeQuestion) return;
    props.onChange(activeQuestion.id, answer);
  }

  function handleNext() {
    if (!activeQuestion || !canAdvance) return;
    if (activeIndex < props.questions.length - 1) {
      setActiveIndex((current) => current + 1);
      return;
    }
    props.onSubmit();
  }

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Evidence coach
          </h2>
          <p className="text-sm text-zinc-600">
            A quick chat to uncover real examples that make your CV sharper for
            this role.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={props.disabled || props.isGenerating}
          onClick={props.onGenerate}
          type="button"
        >
          {props.isGenerating
            ? "Reading the fit..."
            : props.questions.length > 0
              ? "Refresh coach"
              : "Start coach"}
        </button>
      </div>

      {props.questions.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="space-y-3 border-b border-zinc-100 p-4">
            {introMessages.slice(0, visibleIntroCount).map((message) => (
              <CoachBubble key={message}>{message}</CoachBubble>
            ))}
            {visibleIntroCount < introMessages.length ? (
              <CoachBubble>
                <span className="text-zinc-500">Thinking through the fit...</span>
              </CoachBubble>
            ) : null}
            {activeQuestion && visibleIntroCount >= introMessages.length ? (
              <CoachBubble>
                <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                  Question {activeIndex + 1} of {props.questions.length}
                </p>
                <p className="mt-1 font-medium text-zinc-950">
                  {activeQuestion.question}
                </p>
                <p className="mt-2 text-zinc-700">
                  {activeQuestion.whyItMatters ??
                    "This could help the CV line up better with what the role is asking for."}
                </p>
                {activeQuestion.answerGuidance ? (
                  <p className="mt-2 text-zinc-700">
                    {activeQuestion.answerGuidance}
                  </p>
                ) : null}
                {exampleAnswer ? (
                  <div className="mt-3 rounded bg-white px-3 py-2 text-zinc-700">
                    <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                      Example answer
                    </p>
                    <p className="mt-1">{exampleAnswer}</p>
                  </div>
                ) : null}
                {stringArray(activeQuestion.exampleAnglesJson).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stringArray(activeQuestion.exampleAnglesJson).map((angle) => (
                      <span
                        className="rounded bg-white px-2 py-1 text-xs text-zinc-700"
                        key={angle}
                      >
                        {angle}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CoachBubble>
            ) : null}

            {activeAnswer.buttonAnswer ? (
              <UserBubble>
                <p>{activeAnswer.buttonAnswer.replace("_", " ")}</p>
                {activeAnswer.elaboration ? (
                  <p className="mt-2 text-white/80">{activeAnswer.elaboration}</p>
                ) : null}
              </UserBubble>
            ) : null}
          </div>

          {activeQuestion ? (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                {answerOptions.map((option) => (
                  <button
                    className={
                      activeAnswer.buttonAnswer === option.value
                        ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm text-white"
                        : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800"
                    }
                    disabled={props.isSubmitting}
                    key={option.value}
                    onClick={() =>
                      updateActiveAnswer({
                        ...activeAnswer,
                        buttonAnswer: option.value,
                        elaboration:
                          option.value === "yes" || option.value === "kind_of"
                            ? activeAnswer.elaboration
                            : "",
                      })
                    }
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {needsElaboration ? (
                <textarea
                  className="min-h-24 w-full resize-y rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-zinc-900"
                  onChange={(event) =>
                    updateActiveAnswer({
                      ...activeAnswer,
                      elaboration: event.target.value,
                    })
                  }
                  placeholder="Just say it naturally. What did you do, what was the context, and what changed?"
                  value={activeAnswer.elaboration ?? ""}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
                  disabled={props.isSubmitting}
                  onClick={props.onSkipAll}
                  type="button"
                >
                  Skip all for now
                </button>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
                    disabled={activeIndex === 0 || props.isSubmitting}
                    onClick={() =>
                      setActiveIndex((current) => Math.max(0, current - 1))
                    }
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                    disabled={!canAdvance || props.isSubmitting}
                    onClick={handleNext}
                    type="button"
                  >
                    {props.isSubmitting
                      ? "Saving..."
                      : activeIndex === props.questions.length - 1
                        ? "Save answers"
                        : "Next"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          Start the coach after checking job fit. It will explain the role and
          ask only for examples that could materially strengthen the CV.
        </p>
      )}
    </section>
  );
}
