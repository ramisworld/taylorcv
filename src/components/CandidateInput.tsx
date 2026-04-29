"use client";

export function CandidateInput(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isPrimary?: boolean;
  disabled?: boolean;
}) {
  const buttonClass = props.isPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">
          Your Background
        </h2>
        <p className="text-sm text-zinc-600">
          Paste your CV, project notes, achievements, or other relevant
          background.
        </p>
      </div>
      <textarea
        className="min-h-52 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-950 outline-none focus:border-zinc-900"
        value={props.value}
        maxLength={30_000}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <button
        className={buttonClass}
        disabled={props.disabled || props.isLoading || !props.value.trim()}
        onClick={props.onSubmit}
        type="button"
      >
        {props.isLoading ? "Building profile..." : "Build profile"}
      </button>
    </section>
  );
}
