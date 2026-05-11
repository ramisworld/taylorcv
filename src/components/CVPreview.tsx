"use client";

import type { ReactNode } from "react";
import { ExternalLink, GitBranch, Link, Mail, MapPin, Phone } from "lucide-react";

import {
  claimText,
  contactItems,
  joinPresent,
  normalizeCvSections,
  parseStructuredCv,
  type CvContactKind,
  type CvExperienceItem,
  type CvProjectItem,
  type StructuredCv,
} from "~/lib/cvDocument";
import type { RouterOutputs } from "~/trpc/react";

type ApplicationState = NonNullable<
  RouterOutputs["application"]["getApplicationState"]
>;

function SectionHeading(props: { children: ReactNode }) {
  return (
    <h2 className="border-b border-zinc-200 pb-1.5 text-[12.5px] font-bold uppercase tracking-normal text-blue-700">
      {props.children}
    </h2>
  );
}

function BulletList(props: { bullets: string[] }) {
  return (
    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] leading-[1.45] text-zinc-800">
      {props.bullets.map((bullet, index) => (
        <li key={`${bullet}-${index}`}>{bullet}</li>
      ))}
    </ul>
  );
}

function contactIcon(kind: CvContactKind) {
  const className = "h-3.5 w-3.5 shrink-0 text-zinc-400";
  if (kind === "location") return <MapPin className={className} />;
  if (kind === "phone") return <Phone className={className} />;
  if (kind === "email") return <Mail className={className} />;
  if (kind === "linkedin") return <Link className={className} />;
  if (kind === "github") return <GitBranch className={className} />;
  if (kind === "portfolio") return <ExternalLink className={className} />;
  return <Link className={className} />;
}

function ExperienceBlock(props: { item: CvExperienceItem; index: number }) {
  const title = joinPresent([props.item.role, props.item.company], " - ");
  const meta = joinPresent([props.item.dates, props.item.location], " | ");

  return (
    <div key={`${title}-${props.index}`} data-cv-experience-item>
      {title || meta ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          {title ? (
            <p className="text-[13px] font-semibold leading-snug">{title}</p>
          ) : null}
          {meta ? (
            <p className="text-[12px] leading-snug text-zinc-600">{meta}</p>
          ) : null}
        </div>
      ) : null}
      <BulletList bullets={props.item.bullets.map(claimText)} />
    </div>
  );
}

function ProjectBlock(props: { item: CvProjectItem; index: number }) {
  const title = joinPresent([props.item.name, props.item.descriptor], " - ");

  return (
    <div key={`${title}-${props.index}`}>
      {title || props.item.dates ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          {title ? (
            <p className="text-[13px] font-semibold leading-snug">{title}</p>
          ) : null}
          {props.item.dates ? (
            <p className="text-[12px] leading-snug text-zinc-600">
              {props.item.dates}
            </p>
          ) : null}
        </div>
      ) : null}
      <BulletList bullets={props.item.bullets.map(claimText)} />
    </div>
  );
}

function StructuredCvPaper(props: { cv: StructuredCv }) {
  const headerMeta = contactItems(props.cv.header);
  const sections = normalizeCvSections(props.cv);

  function renderSection(section: ReturnType<typeof normalizeCvSections>[number]) {
    if (section.type === "summary" || section.type === "inline") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <div className="mt-2 space-y-1.5">
            {section.paragraphs.map((paragraph, index) => (
              <p
                className="text-[12.5px] leading-[1.5] text-zinc-800"
                key={`${section.id}-${index}`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      );
    }

    if (section.type === "bullets" || section.type === "certifications") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <BulletList bullets={section.bullets.map(claimText)} />
        </section>
      );
    }

    if (section.type === "projects") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <div className="mt-2 space-y-3">
            {section.items.map((item, index) => (
              <ProjectBlock item={item} index={index} key={`${item.name}-${index}`} />
            ))}
          </div>
        </section>
      );
    }

    if (section.type === "experience") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <div className="mt-2 space-y-3">
            {section.items.map((item, index) => (
              <ExperienceBlock item={item} index={index} key={`${item.role}-${index}`} />
            ))}
          </div>
        </section>
      );
    }

    if (section.type === "skills") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <dl className="mt-2 space-y-1.5 text-[12.5px] leading-[1.45]">
            {section.groups.map((group) => (
              <div
                className="grid gap-1 sm:grid-cols-[130px_1fr]"
                key={group.group}
              >
                <dt className="font-semibold text-zinc-950">{group.group}:</dt>
                <dd className="text-zinc-800">{group.skills.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    }

    if (section.type === "education") {
      return (
        <section key={section.id}>
          <SectionHeading>{section.label}</SectionHeading>
          <div className="mt-2 space-y-2">
            {section.items.map((item, index) => {
              const title = joinPresent([item.degree, item.institution], " - ");
              return (
                <div key={`${title}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    {title ? (
                      <p className="text-[13px] font-semibold leading-snug">
                        {title}
                      </p>
                    ) : null}
                    {item.dates ? (
                      <p className="text-[12px] leading-snug text-zinc-600">
                        {item.dates}
                      </p>
                    ) : null}
                  </div>
                  {item.details.length > 0 ? (
                    <p className="mt-1 text-[12.5px] leading-[1.45] text-zinc-700">
                      {item.details.join(", ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <article
      className="mx-auto min-h-[1123px] max-w-[794px] border border-zinc-200 bg-white px-8 py-7 text-zinc-950 shadow-sm sm:px-12 sm:py-10"
      data-cv-document
    >
      {props.cv.header.name || props.cv.header.targetTitle || headerMeta.length > 0 ? (
        <header>
          {props.cv.header.name ? (
            <h1 className="text-[32px] font-bold leading-[1.05] tracking-normal text-zinc-950">
              {props.cv.header.name}
            </h1>
          ) : null}
          {props.cv.header.targetTitle ? (
            <p className="mt-1 text-[13.5px] font-semibold leading-5 text-blue-700">
              {props.cv.header.targetTitle}
            </p>
          ) : null}
          {headerMeta.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-5 text-zinc-600">
              {headerMeta.map((item) => (
                <span className="inline-flex items-center gap-1" key={`${item.kind}-${item.value}`}>
                  {contactIcon(item.kind)}
                  <span>{item.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </header>
      ) : null}

      <div className="mt-5 space-y-4">
        {sections.map(renderSection)}
      </div>
    </article>
  );
}

function FallbackPaper(props: { text: string }) {
  return (
    <article className="mx-auto max-w-[820px] border border-zinc-200 bg-white px-8 py-7 shadow-sm sm:px-10 sm:py-9">
      <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-6 text-zinc-800">{props.text}</pre>
    </article>
  );
}

export function CVPreview(props: {
  value: string;
  cvDraft: ApplicationState["cvDraft"] | null;
  onChange: (value: string) => void;
  onGenerateCv: () => void;
  onCopy: () => void;
  isGeneratingCv: boolean;
  isPrimary?: boolean;
  disabled?: boolean;
}) {
  const cvJson = props.cvDraft?.cvJson;
  const structuredCv = parseStructuredCv(cvJson);
  const cvText = props.cvDraft?.cvText ?? props.value;
  const buttonClass = props.isPrimary
    ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    : "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400";

  return (
    <section className="space-y-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Final CV</h2>
          <p className="text-sm text-zinc-600">
            Generate a polished document from your strongest role-specific evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClass}
            disabled={props.disabled || props.isGeneratingCv}
            onClick={props.onGenerateCv}
            type="button"
          >
            {props.isGeneratingCv
              ? "Writing CV..."
              : props.cvDraft
                ? "Regenerate final CV"
                : "Generate final CV"}
          </button>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={!cvText}
            onClick={props.onCopy}
            type="button"
          >
            Copy CV
          </button>
        </div>
      </div>

      {structuredCv ? (
        <StructuredCvPaper cv={structuredCv} />
      ) : cvText ? (
        <FallbackPaper text={cvText} />
      ) : (
        <div className="mx-auto max-w-[820px] border border-dashed border-zinc-300 bg-white px-8 py-12 text-center text-sm text-zinc-600">
          Your final CV will appear here as a clean document preview.
        </div>
      )}

      <details className="rounded-md border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-800">
          Plain text fallback
        </summary>
        <textarea
          className="mt-3 min-h-72 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-950 outline-none focus:border-zinc-900"
          onChange={(event) => {
            props.onChange(event.target.value);
          }}
          value={cvText}
        />
      </details>
    </section>
  );
}
