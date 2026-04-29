"use client";

import { useState } from "react";

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

export function GapQuestionsView(props: {
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
  const activeQuestion = props.questions[activeIndex] ?? null;
  const buttonClass = props.isPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";
  const quietButtonClass =
    "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Questions to improve your CV
          </h2>
          <p className="text-sm text-zinc-600">
            Answer these only if you have relevant experience. Your answers help
            strengthen weak areas in the CV.
          </p>
        </div>
        <button
          className={activeQuestion ? quietButtonClass : buttonClass}
          disabled={props.disabled || props.isGenerating}
          onClick={props.onGenerate}
          type="button"
        >
          {props.isGenerating ? "Finding questions..." : "Find questions"}
        </button>
      </div>
      {activeQuestion ? (
        <div className="space-y-3">
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-500">
                Question {activeIndex + 1} of {props.questions.length}
              </p>
              <button
                className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
                disabled={props.isSubmitting}
                onClick={props.onSkipAll}
                type="button"
              >
                Skip all for now
              </button>
            </div>
            <QuestionCard
              answer={props.answers[activeQuestion.id] ?? {}}
              onChange={(answer) => props.onChange(activeQuestion.id, answer)}
              question={activeQuestion}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
                disabled={activeIndex === props.questions.length - 1}
                onClick={() =>
                  setActiveIndex((current) =>
                    Math.min(props.questions.length - 1, current + 1)
                  )
                }
                type="button"
              >
                Next
              </button>
            </div>
            <button
              className={props.isPrimary ? buttonClass : "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"}
              disabled={props.isSubmitting}
              onClick={props.onSubmit}
              type="button"
            >
              {props.isSubmitting ? "Saving..." : "Save answers"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          No questions yet. Check job fit first, then find questions.
        </p>
      )}
    </section>
  );
}

function QuestionCard(props: {
  question: ApplicationState["gapQuestions"][number];
  answer: GapAnswerDraft;
  onChange: (answer: GapAnswerDraft) => void;
}) {
  const needsElaboration =
    props.answer.buttonAnswer === "yes" ||
    props.answer.buttonAnswer === "kind_of";

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="font-medium text-zinc-950">{props.question.question}</p>
        <p className="mt-1 text-sm text-zinc-600">
          {props.question.reason} A concrete example here can help make this CV
          more relevant to the role.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {answerOptions.map((option) => (
          <button
            className={
              props.answer.buttonAnswer === option.value
                ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm text-white"
                : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800"
            }
            key={option.value}
            onClick={() =>
              props.onChange({
                ...props.answer,
                buttonAnswer: option.value,
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
            props.onChange({
              ...props.answer,
              elaboration: event.target.value,
            })
          }
          placeholder="Briefly explain what you did, tools used, and outcome."
          value={props.answer.elaboration ?? ""}
        />
      ) : null}
    </div>
  );
}
