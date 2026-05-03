"use client";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

export function AgentProgress(props: {
  application: ApplicationState["application"] | null | undefined;
  agentRuns: ApplicationState["agentRuns"];
}) {
  return (
    <details className="mt-8 rounded-md border border-zinc-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-zinc-800">
        Activity details
      </summary>
      <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
        <p className="text-sm text-zinc-600">
          Recent Taylor activity for this CV.
        </p>
        {props.agentRuns.length > 0 ? (
          <ol className="space-y-2 text-sm">
            {props.agentRuns.slice(0, 8).map((run, index) => (
              <li
                className="flex items-center justify-between gap-3"
                key={run.id}
              >
                <span className="text-zinc-800">Activity {index + 1}</span>
                <span
                  className={
                    run.status === "success"
                      ? "text-xs text-emerald-700"
                      : "text-xs text-red-700"
                  }
                >
                  {run.status === "success" ? "Completed" : "Needs another try"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-600">No activity yet.</p>
        )}
      </div>
    </details>
  );
}
