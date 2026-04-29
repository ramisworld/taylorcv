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
            Vector retrieval plus evidence scoring.
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
          {props.matches.map((match) => (
            <div className="rounded-md border border-zinc-200 p-3" key={match.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-zinc-950">
                  {match.jobRequirement.label}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  {match.confidence}
                </span>
                {typeof match.similarityScore === "number" ? (
                  <span className="text-xs text-zinc-500">
                    {match.similarityScore.toFixed(2)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-700">{match.reason}</p>
              {match.candidateChunk ? (
                <p className="mt-2 text-sm text-zinc-600">
                  {match.candidateChunk.content}
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
