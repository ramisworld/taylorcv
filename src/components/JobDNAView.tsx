"use client";

import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

export function JobDNAView(props: {
  job: ApplicationState["job"];
  requirements: ApplicationState["jobRequirements"];
}) {
  if (!props.job) return null;

  return (
    <section className="space-y-3 border-b border-zinc-200 py-6">
      <h2 className="text-lg font-semibold text-zinc-950">Job DNA</h2>
      <div className="space-y-1 text-sm text-zinc-700">
        <p className="font-medium text-zinc-950">{props.job.title}</p>
        <p>{props.job.company ?? "Company not specified"}</p>
        <p>{props.job.summary}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-600">
            <tr>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Requirement</th>
              <th className="py-2 pr-3">Importance</th>
              <th className="py-2 pr-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {props.requirements.map((requirement) => (
              <tr className="border-b border-zinc-100" key={requirement.id}>
                <td className="py-2 pr-3 text-zinc-600">{requirement.type}</td>
                <td className="py-2 pr-3 font-medium text-zinc-950">
                  {requirement.label}
                </td>
                <td className="py-2 pr-3 text-zinc-700">
                  {requirement.importance}
                </td>
                <td className="py-2 pr-3 text-zinc-700">
                  {requirement.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
