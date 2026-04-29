"use client";

export function CandidateInput(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">
          Candidate input
        </h2>
        <p className="text-sm text-zinc-600">
          Paste CV content and background notes, up to 30k characters.
        </p>
      </div>
      <textarea
        className="min-h-52 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-950 outline-none focus:border-zinc-900"
        value={props.value}
        maxLength={30_000}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <button
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={props.disabled || props.isLoading || !props.value.trim()}
        onClick={props.onSubmit}
        type="button"
      >
        {props.isLoading ? "Extracting..." : "Submit candidate"}
      </button>
    </section>
  );
}
