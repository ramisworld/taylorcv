"use client";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

function fitLabel(confidence: string) {
  if (confidence === "high") return "Strong";
  if (confidence === "medium") return "Partial";
  return "Needs clarification";
}

function groupMatches(matches: ApplicationState["evidenceMatches"]) {
  return {
    strong: matches.filter((match) => match.overallConfidence === "high"),
    partial: matches.filter((match) => match.overallConfidence === "medium"),
    gaps: matches.filter(
      (match) =>
        match.overallConfidence === "weak" ||
        match.overallConfidence === "missing"
    ),
  };
}

function MatchGroup(props: {
  title: string;
  rows: ApplicationState["evidenceMatches"];
  empty: string;
  limit?: number;
}) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-zinc-500">{props.empty}</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-950">{props.title}</h3>
      {props.rows.slice(0, props.limit).map((row) => (
        <details
          className="rounded-md border border-zinc-200 bg-white p-3"
          key={row.requirementId}
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-950">
                {row.requirementLabel}
              </span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                {fitLabel(row.overallConfidence)}
              </span>
            </div>
          </summary>
          <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                Why this matches
              </p>
              <p className="mt-1 text-sm text-zinc-700">{row.reason}</p>
            </div>
            {row.bestEvidence.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
                  Evidence from your background
                </p>
                <div className="mt-2 space-y-2">
                  {row.bestEvidence.map((evidence) => (
                    <p
                      className="rounded border border-zinc-100 bg-zinc-50 p-2 text-sm text-zinc-700"
                      key={evidence.chunkId}
                    >
                      {evidence.contentPreview}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">
                Needs clarification before this can become a strong CV claim.
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

export function EvidenceMapView(props: {
  matches: ApplicationState["evidenceMatches"];
  onRun: () => void;
  isLoading: boolean;
  isPrimary?: boolean;
  disabled?: boolean;
}) {
  const grouped = groupMatches(props.matches);
  const buttonClass = props.isPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Job Fit</h2>
          <p className="text-sm text-zinc-600">
            See where your background already matches and what needs
            clarification.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={props.disabled || props.isLoading}
          onClick={props.onRun}
          type="button"
        >
          {props.isLoading ? "Checking fit..." : "Check job fit"}
        </button>
      </div>
      {props.matches.length > 0 ? (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-semibold text-zinc-950">
                {grouped.strong.length}
              </p>
              <p className="text-sm text-zinc-600">Strong matches</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-semibold text-zinc-950">
                {grouped.partial.length}
              </p>
              <p className="text-sm text-zinc-600">Partial matches</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-2xl font-semibold text-zinc-950">
                {grouped.gaps.length}
              </p>
              <p className="text-sm text-zinc-600">Gaps to clarify</p>
            </div>
          </div>

          <MatchGroup
            empty="No strong matches yet."
            limit={3}
            rows={grouped.strong}
            title="Top strong matches"
          />
          <MatchGroup
            empty="No gaps to clarify."
            rows={grouped.gaps}
            title="Gaps to clarify"
          />
          <details className="rounded-md border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-800">
              Show all matches
            </summary>
            <div className="mt-4 space-y-5 border-t border-zinc-100 pt-4">
              <MatchGroup
                empty="No additional strong matches."
                rows={grouped.strong.slice(3)}
                title="More strong matches"
              />
              <MatchGroup
                empty="No partial matches."
                rows={grouped.partial}
                title="Partial matches"
              />
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          Check job fit after adding your background.
        </p>
      )}
    </section>
  );
}
