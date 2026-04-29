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
    <aside className="space-y-3 border-b border-zinc-200 py-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Agent progress</h2>
        <p className="text-sm text-zinc-600">
          Current step: {props.application?.currentStep ?? "starting"}
        </p>
      </div>
      {props.agentRuns.length > 0 ? (
        <ol className="space-y-2 text-sm">
          {props.agentRuns.slice(0, 8).map((run) => (
            <li className="flex items-center justify-between gap-3" key={run.id}>
              <span className="text-zinc-800">{run.agentName}</span>
              <span
                className={
                  run.status === "success"
                    ? "text-xs text-emerald-700"
                    : "text-xs text-red-700"
                }
              >
                {run.status}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-zinc-600">No agent runs yet.</p>
      )}
    </aside>
  );
}
