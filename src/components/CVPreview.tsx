"use client";

import { useState } from "react";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

const sections = [
  { id: "header", label: "Header" },
  { id: "summary", label: "Summary" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
] as const;

const suggestions = [
  "Make it more concise",
  "Make it more technical",
  "Make it less AI-sounding",
  "Emphasize RAG more",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sectionValue(cvJson: unknown, sectionId: string) {
  if (!isRecord(cvJson)) return "";
  return cvJson[sectionId] ?? "";
}

function renderValue(value: unknown, sectionId: string) {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string");
    if (items.length === 0) return <p className="text-sm text-zinc-500">Empty</p>;

    if (sectionId === "skills") {
      return (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      );
    }

    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "string" && value.trim()) {
    return <p className="whitespace-pre-wrap text-sm text-zinc-700">{value}</p>;
  }

  return <p className="text-sm text-zinc-500">Empty</p>;
}

function textValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return typeof value === "string" ? value : "";
}

export function CVPreview(props: {
  value: string;
  cvDraft: ApplicationState["cvDraft"] | null;
  onChange: (value: string) => void;
  onGenerateStrategy: () => void;
  onGenerateCv: () => void;
  onRewriteSection: (sectionId: string, instruction: string) => void;
  onCopy: () => void;
  isGeneratingStrategy: boolean;
  isGeneratingCv: boolean;
  isRewritingSection: boolean;
  isPlanPrimary?: boolean;
  isCvPrimary?: boolean;
  hasStrategy: boolean;
  disabled?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [lastRewrite, setLastRewrite] = useState<{
    sectionId: string;
    previousInstruction: string;
    previousText: string;
  } | null>(null);
  const cvText = props.value || props.cvDraft?.cvText || "";
  const cvJson = props.cvDraft?.cvJson;
  const planButtonClass = props.isPlanPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";
  const cvButtonClass = props.isCvPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";

  return (
    <section className="space-y-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Your Tailored CV
          </h2>
          <p className="text-sm text-zinc-600">
            Generate a focused CV, then refine individual sections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={planButtonClass}
            disabled={props.disabled || props.isGeneratingStrategy}
            onClick={props.onGenerateStrategy}
            type="button"
          >
            {props.isGeneratingStrategy ? "Planning..." : "Create CV plan"}
          </button>
          <button
            className={cvButtonClass}
            disabled={
              props.disabled ||
              props.isGeneratingCv ||
              props.isGeneratingStrategy ||
              !props.hasStrategy
            }
            onClick={props.onGenerateCv}
            type="button"
          >
            {props.isGeneratingCv ? "Writing..." : "Write tailored CV"}
          </button>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={!cvText}
            onClick={props.onCopy}
            type="button"
          >
            Copy CV
          </button>
        </div>
      </div>

      {isRecord(cvJson) ? (
        <div className="space-y-3">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <div
                className="rounded-md border border-zinc-200 bg-white p-4"
                key={section.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-950">
                    {section.label}
                  </h3>
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
                    disabled={props.isRewritingSection}
                    onClick={() =>
                      setActiveSection(isActive ? null : section.id)
                    }
                    type="button"
                  >
                    Edit with AI
                  </button>
                </div>
                <div className="mt-3">
                  {renderValue(sectionValue(cvJson, section.id), section.id)}
                </div>
                {isActive ? (
                  <div className="mt-4 space-y-3 border-t border-zinc-100 pt-3">
                    <p className="text-sm font-medium text-zinc-950">
                      What do you want to change in this section?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700"
                          key={suggestion}
                          onClick={() => setInstruction(suggestion)}
                          type="button"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="min-h-20 w-full resize-y rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-zinc-900"
                      onChange={(event) => setInstruction(event.target.value)}
                      placeholder="For example: make this more concise or emphasize RAG more."
                      value={instruction}
                    />
                    <button
                      className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                      disabled={
                        props.isRewritingSection || !instruction.trim()
                      }
                      onClick={() => {
                        setLastRewrite({
                          sectionId: section.id,
                          previousInstruction: instruction.trim(),
                          previousText: textValue(sectionValue(cvJson, section.id)),
                        });
                        props.onRewriteSection(section.id, instruction.trim());
                        setInstruction("");
                        setActiveSection(null);
                      }}
                      type="button"
                    >
                      {props.isRewritingSection ? "Applying..." : "Apply"}
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800"
                      onClick={() => {
                        setInstruction("");
                        setActiveSection(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                {lastRewrite?.sectionId === section.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <span>Section updated.</span>
                    <button
                      className="font-medium underline-offset-4 hover:underline"
                      onClick={() => setLastRewrite(null)}
                      type="button"
                    >
                      Keep
                    </button>
                    <button
                      className="font-medium underline-offset-4 hover:underline"
                      onClick={() => {
                        props.onRewriteSection(
                          section.id,
                          `Restore this section exactly to the previous version:\n${lastRewrite.previousText}`
                        );
                        setLastRewrite(null);
                      }}
                      type="button"
                    >
                      Undo
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          Your CV will appear here after you create a CV plan and write the
          tailored CV.
        </p>
      )}

      <details className="rounded-md border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-800">
          Plain text fallback
        </summary>
        <textarea
          className="mt-3 min-h-72 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-950 outline-none focus:border-zinc-900"
          onChange={(event) => props.onChange(event.target.value)}
          value={cvText}
        />
      </details>
    </section>
  );
}
