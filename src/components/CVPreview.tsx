"use client";

export function CVPreview(props: {
  value: string;
  onChange: (value: string) => void;
  onGenerateStrategy: () => void;
  onGenerateCv: () => void;
  onCopy: () => void;
  isGeneratingStrategy: boolean;
  isGeneratingCv: boolean;
  hasStrategy: boolean;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3 py-6">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={props.disabled || props.isGeneratingStrategy}
          onClick={props.onGenerateStrategy}
          type="button"
        >
          {props.isGeneratingStrategy ? "Planning..." : "Generate strategy"}
        </button>
        <button
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={
            props.disabled ||
            props.isGeneratingCv ||
            props.isGeneratingStrategy ||
            !props.hasStrategy
          }
          onClick={props.onGenerateCv}
          type="button"
        >
          {props.isGeneratingCv ? "Writing..." : "Generate CV"}
        </button>
        <button
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400"
          disabled={!props.value}
          onClick={props.onCopy}
          type="button"
        >
          Copy CV
        </button>
      </div>
      <textarea
        className="min-h-96 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-950 outline-none focus:border-zinc-900"
        onChange={(event) => props.onChange(event.target.value)}
        value={props.value}
      />
    </section>
  );
}
