"use client";

import type { Ref } from "react";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function CVPlanView(props: {
  strategy: ApplicationState["cvStrategy"] | null;
  sectionRef?: Ref<HTMLElement>;
}) {
  if (!props.strategy) return null;

  const emphasis = stringArray(props.strategy.emphasisJson).slice(0, 3);
  const warnings = stringArray(props.strategy.warningsJson).slice(0, 2);

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6" ref={props.sectionRef}>
      <h2 className="text-lg font-semibold text-zinc-950">CV Plan</h2>
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-950">Positioning</p>
        <p className="mt-1 text-sm text-zinc-700">
          {props.strategy.targetPositioning}
        </p>

        {emphasis.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-950">Lead with</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {emphasis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-950">
              Be careful with
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
