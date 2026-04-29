"use client";

export function SummaryCard(props: {
  title: string;
  heading: string;
  description?: string | null;
  meta?: string | null;
  onEdit: () => void;
}) {
  return (
    <section className="border-b border-zinc-200 py-6">
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">{props.title}</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">
              {props.heading}
            </h2>
            {props.meta ? (
              <p className="mt-1 text-sm text-zinc-500">{props.meta}</p>
            ) : null}
          </div>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800"
            onClick={props.onEdit}
            type="button"
          >
            Edit
          </button>
        </div>
        {props.description ? (
          <p className="mt-3 text-sm text-zinc-700">{props.description}</p>
        ) : null}
      </div>
    </section>
  );
}
