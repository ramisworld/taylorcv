import { cn } from "~/lib/utils";

export function FlowArrow(props: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none z-10 h-8 w-9 text-[#2450f4]",
        props.className
      )}
      fill="none"
      viewBox="0 0 42 32"
    >
      <path
        d="M5.5 16h28.8m-6.9-7.3L34.8 16l-7.4 7.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
