"use client";

import type { Ref } from "react";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function CVPlanView(props: {
  strategy: unknown;
  sectionRef?: Ref<HTMLElement>;
}) {
  if (!props.strategy || typeof props.strategy !== "object") return null;
  const strategy = props.strategy as {
    emphasisJson?: unknown;
    warningsJson?: unknown;
    targetPositioning?: unknown;
  };

  const emphasis = stringArray(strategy.emphasisJson).slice(0, 3);
  const warnings = stringArray(strategy.warningsJson).slice(0, 2);
  const targetPositioning =
    typeof strategy.targetPositioning === "string"
      ? strategy.targetPositioning
      : "Taylor positioned the CV around the strongest verified evidence.";

  return (
    <section className="border-b border-zinc-200 py-4" ref={props.sectionRef}>
      <details className="rounded-md border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-800">
          How we positioned your CV
        </summary>
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="text-sm font-medium text-zinc-950">Positioning</p>
          <p className="mt-1 text-sm text-zinc-700">
            {targetPositioning}
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
      </details>
    </section>
  );
}
