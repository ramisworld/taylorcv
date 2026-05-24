"use client";

import { motion } from "motion/react";

import { cn } from "~/lib/utils";
import type { PlanKey } from "~/lib/plans";

import { PrimaryButton } from "./GlassButton";
import styles from "./landing-glass.module.css";

type GlassHeaderProps = {
  error?: string | null;
  isLoading: boolean;
  isSignedIn?: boolean;
  onGetStarted: () => void;
  onDashboard?: () => void;
  onPlanSelected?: (planKey: PlanKey) => void;
  isCheckoutLoading?: boolean;
};

const entrance = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function TaylorLogoIcon(props: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={cn("shrink-0 object-contain", props.className ?? "h-9 w-9")}
      src="/assets/taylorcv-logo-transparent.png"
    />
  );
}

function TaylorWordmark() {
  return (
    <div aria-label="TaylorCV" className="flex min-w-0 items-center gap-2.5">
      <TaylorLogoIcon className="h-[34px] w-[34px]" />
      <span className="truncate text-[25px] font-bold tracking-[-0.04em] text-[#080d22]">
        TaylorCV
      </span>
    </div>
  );
}

export function GlassHeader(props: GlassHeaderProps) {
  return (
    <motion.header
      animate="visible"
      className="relative z-30 mx-auto w-full px-4 pt-[14px]"
      initial="hidden"
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      variants={entrance}
    >
      <div
        className={cn(
          styles.tcGlassSurface,
          "mx-auto flex h-[80px] w-full max-w-[1540px] items-center justify-between gap-5 rounded-[22px] px-11 max-md:h-[68px] max-md:px-4"
        )}
      >
        <div className={styles.tcGlassBackdrop} />
        <div className={styles.tcGlassSheen} />
        <div className={styles.tcGlassEdge} />
        <a
          className="relative z-10 shrink-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/18"
          href="#"
        >
          <TaylorWordmark />
        </a>
        <nav className="absolute left-1/2 z-10 hidden -translate-x-1/2 items-center gap-[42px] text-[16px] font-semibold text-[#080d22] lg:flex">
          <a className="rounded-md transition hover:text-[#2047f0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14" href="#how-it-works">
            How it works
          </a>
          <a className="rounded-md transition hover:text-[#2047f0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14" href="#pricing">
            Pricing
          </a>
          <a className="rounded-md transition hover:text-[#2047f0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14" href="#faq">
            FAQ
          </a>
        </nav>
        <div className="relative z-10 ml-auto flex items-center gap-[18px]">
          <button
            className="hidden rounded-md text-[16px] font-semibold text-[#080d22] transition hover:text-[#2047f0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/18 sm:inline-flex"
            onClick={() => {
              if (props.isSignedIn) props.onDashboard?.();
              else window.location.href = "/auth/sign-in";
            }}
            type="button"
          >
            {props.isSignedIn ? "Dashboard" : "Sign in"}
          </button>
          <PrimaryButton
            className="h-[52px] rounded-[13px] px-6 max-sm:h-11 max-sm:px-4"
            disabled={props.isLoading}
            onClick={props.onGetStarted}
            trailingArrow
          >
            {props.isLoading ? "Starting..." : "Build my tailored CV"}
          </PrimaryButton>
        </div>
      </div>
    </motion.header>
  );
}
