"use client";

import Image from "next/image";

const logoSrc = "/assets/taylor-cv-logo-mark-transparent.png";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function TaylorLogoMark(props: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block h-9 w-9 shrink-0 overflow-hidden",
        props.className,
      )}
    >
      <Image
        alt=""
        className="object-contain"
        fill
        priority
        sizes="48px"
        src={logoSrc}
      />
    </span>
  );
}

export function TaylorBrand(props: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <div
      aria-label="Taylor CV"
      className={cn("flex min-w-0 items-center gap-2.5", props.className)}
    >
      <TaylorLogoMark className={props.markClassName} />
      <span
        className={cn(
          "truncate text-[21px] font-semibold tracking-[-0.035em] text-white",
          props.textClassName,
        )}
      >
        Taylor CV
      </span>
    </div>
  );
}
