"use client";

const steps = ["Job", "Profile", "Fit", "Questions", "CV"] as const;

export type ProgressStep = (typeof steps)[number];

export function ProgressStepper(props: { currentStep: ProgressStep }) {
  const currentIndex = steps.indexOf(props.currentStep);

  return (
    <nav className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur">
      <ol className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto text-sm">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li className="flex items-center gap-2" key={step}>
              <span
                className={
                  isCurrent
                    ? "rounded-full bg-zinc-950 px-3 py-1 font-medium text-white"
                    : isDone
                      ? "rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800"
                      : "rounded-full bg-zinc-100 px-3 py-1 text-zinc-600"
                }
              >
                {step}
              </span>
              {index < steps.length - 1 ? (
                <span className="h-px w-6 bg-zinc-200" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
