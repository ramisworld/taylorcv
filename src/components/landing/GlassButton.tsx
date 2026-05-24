"use client";

import { FileCheck2 } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "~/lib/utils";

import styles from "./landing-glass.module.css";

type GlassButtonProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  trailingArrow?: boolean;
};

function ThinArrow() {
  return (
    <svg
      aria-hidden="true"
      className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
      fill="none"
      viewBox="0 0 18 18"
    >
      <path
        d="M3.4 9h10.2m-4.1-4.2L13.7 9l-4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PrimaryButton(props: GlassButtonProps) {
  return (
    <motion.button
      className={cn(
        styles.tcLiquidButton,
        "group inline-flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] border border-[#4269ff]/30 bg-[linear-gradient(180deg,#3768ff_0%,#2250f4_54%,#1743df_100%)] px-7 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(32,71,240,0.28),0_4px_12px_rgba(12,43,156,0.14)] transition-[transform,box-shadow,opacity] duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_18px_38px_rgba(32,71,240,0.34),0_5px_14px_rgba(12,43,156,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/22 disabled:cursor-not-allowed disabled:opacity-65",
        props.className
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
      whileTap={props.disabled ? undefined : { scale: 0.985 }}
    >
      <span className="relative z-10">{props.children}</span>
      {props.trailingArrow ? <ThinArrow /> : null}
    </motion.button>
  );
}

export function SecondaryButton(props: Omit<GlassButtonProps, "disabled" | "trailingArrow">) {
  return (
    <motion.button
      className={cn(
        styles.tcSecondaryGlassButton,
        "group inline-flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border border-[#d8e0ee]/90 px-6 text-[15px] font-semibold text-[#314066] transition-[transform,opacity,border-color,background-color] duration-200 ease-out hover:scale-[1.02] hover:border-[#c6d2e6] hover:bg-[#f1f4fc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14",
        props.className
      )}
      onClick={props.onClick}
      type="button"
      whileTap={{ scale: 0.985 }}
    >
      <span className="relative z-10">{props.children}</span>
      <FileCheck2 className="relative z-10 h-4 w-4" strokeWidth={1.75} />
    </motion.button>
  );
}
