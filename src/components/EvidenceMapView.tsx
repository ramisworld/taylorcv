"use client";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

export function EvidenceMapView(props: {
  matches: ApplicationState["evidenceMatches"];
  onRun: () => void;
  isLoading: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Evidence matching
          </h2>
          <p className="text-sm text-zinc-600">
            Requirement-level fit from retrieval and evidence scoring.
          </p>
        </div>
        <button
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={props.disabled || props.isLoading}
          onClick={props.onRun}
          type="button"
        >
          {props.isLoading ? "Matching..." : "Run evidence matching"}
        </button>
      </div>
      {props.matches.length > 0 ? (
        <div className="space-y-2">
          {props.matches.map((row) => (
            <div
              className="rounded-md border border-zinc-200 bg-white p-3"
              key={row.requirementId}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-zinc-950">
                  {row.requirementLabel}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  {row.overallConfidence}
                </span>
                <span className="rounded bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">
                  {row.requirementImportance}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-700">{row.reason}</p>
              {row.bestEvidence.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {row.bestEvidence.map((evidence) => (
                    <div
                      className="rounded border border-zinc-100 bg-zinc-50 p-2"
                      key={evidence.chunkId}
                    >
                      <div className="mb-1 text-xs font-medium text-zinc-600">
                        {evidence.confidence} evidence
                      </div>
                      <p className="text-sm text-zinc-700">
                        {evidence.contentPreview}
                      </p>
                    </div>
                  ))}
                </div>
              ) : row.weakEvidence.length > 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Weak backup evidence found, but no strong proof for this
                  requirement.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No evidence matches yet.</p>
      )}
    </section>
  );
}
