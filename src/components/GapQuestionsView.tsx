"use client";

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
  isGenerating: boolean;
  isSubmitting: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Gap questions
          </h2>
          <p className="text-sm text-zinc-600">
            Answer weak or missing important requirements.
          </p>
        </div>
        <button
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={props.disabled || props.isGenerating}
          onClick={props.onGenerate}
          type="button"
        >
          {props.isGenerating ? "Generating..." : "Generate gap questions"}
        </button>
      </div>
      {props.questions.length > 0 ? (
        <div className="space-y-3">
          {props.questions.map((question) => {
            const draft = props.answers[question.id] ?? {};
            const needsElaboration =
              draft.buttonAnswer === "yes" || draft.buttonAnswer === "kind_of";
            return (
              <div
                className="space-y-3 rounded-md border border-zinc-200 p-3"
                key={question.id}
              >
                <div>
                  <p className="font-medium text-zinc-950">
                    {question.question}
                  </p>
                  <p className="text-sm text-zinc-600">{question.reason}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {answerOptions.map((option) => (
                    <button
                      className={
                        draft.buttonAnswer === option.value
                          ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm text-white"
                          : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800"
                      }
                      key={option.value}
                      onClick={() =>
                        props.onChange(question.id, {
                          ...draft,
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
                      props.onChange(question.id, {
                        ...draft,
                        elaboration: event.target.value,
                      })
                    }
                    placeholder="Briefly explain what you did, what tools you used, and what the outcome was."
                    value={draft.elaboration ?? ""}
                  />
                ) : null}
              </div>
            );
          })}
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={props.isSubmitting}
            onClick={props.onSubmit}
            type="button"
          >
            {props.isSubmitting ? "Saving..." : "Submit answers"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No gap questions yet.</p>
      )}
    </section>
  );
}
