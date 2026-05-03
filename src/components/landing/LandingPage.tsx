"use client";

import Lenis from "lenis";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { LandingArtifact } from "./LandingArtifact";
import { LandingBackground } from "./LandingBackground";

type LandingPageProps = {
  isLoading: boolean;
  onGetStarted: () => void;
};

const entrance = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function LandingNav(props: LandingPageProps) {
  return (
    <motion.header
      animate="visible"
      className="fixed left-0 right-0 top-0 z-40 max-w-[100vw] overflow-hidden px-4 pt-4 sm:px-6"
      initial="hidden"
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      variants={entrance}
    >
      <div className="taylor-mobile-frame mx-auto flex h-16 w-[calc(100vw-2rem)] max-w-[1224px] items-center justify-between gap-3 rounded-full border border-white/14 bg-white/[0.075] px-3 shadow-[0_20px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl max-sm:justify-start sm:w-full sm:px-5">
        <a className="flex min-w-0 items-center gap-3" href="/" aria-label="Taylor CV">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-50 shadow-[0_0_40px_rgba(0,240,255,0.16)]">
            <Sparkles className="h-4 w-4" />
            <span className="absolute inset-0 rounded-xl bg-white/10 blur-md" />
          </span>
          <span className="truncate text-sm font-semibold text-white">Taylor CV</span>
        </a>
        <nav className="flex min-w-0 shrink-0 items-center gap-1 text-sm text-zinc-300 sm:gap-2">
          <a
            className="hidden rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            href="#pricing"
          >
            Pricing
          </a>
          <a
            className="hidden rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            href="#how-it-works"
          >
            How it works
          </a>
          <motion.button
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-zinc-950 shadow-[0_0_34px_rgba(0,240,255,0.14)] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-70 sm:px-5"
            disabled={props.isLoading}
            onClick={props.onGetStarted}
            type="button"
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.985 }}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </nav>
      </div>
    </motion.header>
  );
}

function LandingCta(props: LandingPageProps) {
  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
      <motion.button
        className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-zinc-950 shadow-[0_22px_80px_rgba(0,240,255,0.16)] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={props.isLoading}
        onClick={props.onGetStarted}
        type="button"
        whileHover={{ scale: 1.025, y: -2 }}
        whileTap={{ scale: 0.985 }}
      >
        Get started
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </motion.button>
      <p className="text-sm font-medium text-zinc-300">
        First tailored CV free.
      </p>
    </div>
  );
}

function SectionCard(props: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.055] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.26)] backdrop-blur-xl"
      initial={{ opacity: 0, y: 22 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileHover={{ y: -4 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),transparent_36%,rgba(0,240,255,0.07))]" />
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-sm font-semibold text-cyan-50">
          {props.index}
        </div>
        <h3 className="mt-6 text-xl font-semibold text-white">{props.title}</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{props.children}</p>
      </div>
    </motion.div>
  );
}

export function LandingPage(props: LandingPageProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;
    const lenis = new Lenis({
      anchors: { offset: -96 },
      autoRaf: true,
      duration: 1.08,
    });
    return () => lenis.destroy();
  }, [shouldReduceMotion]);

  return (
    <main className="relative min-h-screen max-w-[100vw] overflow-x-hidden bg-[#05070d] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <LandingBackground />
        <LandingNav {...props} />

        <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1224px] min-w-0 items-center gap-12 overflow-hidden px-5 pb-20 pt-32 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:overflow-visible lg:pt-24">
          <motion.div
            animate="visible"
            className="taylor-mobile-copy min-w-0 max-w-[690px]"
            initial="hidden"
            transition={{ staggerChildren: 0.12, delayChildren: 0.08 }}
          >
            <motion.div
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-100/16 bg-cyan-100/[0.07] px-3 py-1.5 text-xs font-medium text-cyan-50 shadow-[0_0_44px_rgba(0,240,255,0.10)] backdrop-blur-xl"
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              variants={entrance}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(0,240,255,0.9)]" />
              AI career agent for high-intent applications
            </motion.div>
            <motion.h1
              className="max-w-full text-balance text-[clamp(3.15rem,8vw,7.7rem)] font-semibold leading-[0.88] text-white"
              transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              variants={entrance}
            >
              Stop sending generic CVs.
            </motion.h1>
            <motion.p
              className="mt-7 max-w-full text-pretty text-lg leading-8 text-zinc-300 sm:max-w-[620px] sm:text-xl"
              transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              variants={entrance}
            >
              Taylor studies your background, reads the role, finds your
              strongest evidence, and builds a tailored CV for the job you
              actually want.
            </motion.p>
            <motion.div
              transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
              variants={entrance}
            >
              <LandingCta {...props} />
            </motion.div>
          </motion.div>

        <div className="taylor-mobile-copy relative lg:translate-x-6">
            <LandingArtifact />
          </div>
        </div>
      </section>

      <section
        className="relative border-t border-white/10 bg-[#05070d] px-5 py-24 sm:px-6"
        id="how-it-works"
      >
        <div className="taylor-landing-section-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[1224px]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase text-cyan-100/70">
              How it works
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              From raw background to role-specific CV.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <SectionCard index="1" title="Add your background">
              Upload or paste your current CV, notes, and proof points.
            </SectionCard>
            <SectionCard index="2" title="Paste the job">
              Taylor reads the role and identifies what matters most.
            </SectionCard>
            <SectionCard index="3" title="Get a tailored CV">
              Your strongest evidence is rewritten into a focused draft.
            </SectionCard>
          </div>
        </div>
      </section>

      <section
        className="relative border-t border-white/10 bg-[#05070d] px-5 py-24 sm:px-6"
        id="pricing"
      >
        <div className="relative mx-auto max-w-[1224px]">
          <motion.div
            className="relative max-w-3xl overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.065] p-8 shadow-[0_32px_110px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:p-10"
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,240,255,0.13),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.10),transparent_42%)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase text-cyan-100/70">
                Pricing
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                First tailored CV free.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-300">
                Upgrade when you want more exports and saved applications.
              </p>
              <motion.button
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={props.isLoading}
                onClick={props.onGetStarted}
                type="button"
                whileHover={{ scale: 1.025 }}
                whileTap={{ scale: 0.985 }}
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
