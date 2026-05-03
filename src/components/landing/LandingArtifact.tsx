"use client";

import { motion, useReducedMotion } from "motion/react";
import { BriefcaseBusiness, FileCheck2, ScanLine, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

function SignalCard(props: {
  className?: string;
  eyebrow: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  const Icon = props.icon;

  return (
    <motion.div
      className={[
        "group relative overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.075] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl",
        "before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_34%,rgba(0,240,255,0.08))] before:opacity-70",
        props.className,
      ].join(" ")}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-50 shadow-[0_0_32px_rgba(0,240,255,0.14)]">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[10px] font-medium uppercase text-cyan-100/60">
            {props.eyebrow}
          </span>
          <span className="mt-1 block text-sm font-semibold text-white">
            {props.title}
          </span>
          <span className="mt-1 block text-xs text-zinc-400">{props.value}</span>
        </span>
      </div>
    </motion.div>
  );
}

export function LandingArtifact() {
  const shouldReduceMotion = useReducedMotion();
  const floatAnimation = shouldReduceMotion
    ? {}
    : { y: [0, -12, 0], rotateX: [0, 1.4, 0], rotateY: [-2, 1, -2] };

  return (
    <motion.div
      className="relative mx-auto h-[560px] w-full max-w-[620px] max-lg:h-[520px] max-sm:h-[470px]"
      initial="hidden"
      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
      variants={fadeUp}
      viewport={{ once: true }}
      whileInView="visible"
    >
      <motion.div
        animate={floatAnimation}
        className="absolute inset-0 perspective-[1400px]"
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 8.8, ease: "easeInOut", repeat: Infinity }
        }
      >
        <div className="absolute inset-0 rounded-[48px] bg-[radial-gradient(circle_at_54%_50%,rgba(0,240,255,0.22),transparent_38%),radial-gradient(circle_at_72%_28%,rgba(24,93,255,0.22),transparent_30%)] blur-2xl" />

        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible opacity-85"
          viewBox="0 0 620 560"
        >
          <defs>
            <linearGradient id="landingLine" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,240,255,0.08)" />
              <stop offset="45%" stopColor="rgba(0,240,255,0.86)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
            <filter id="landingGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M128 164 C220 140 258 228 320 246 C390 266 430 214 496 236"
            fill="none"
            filter="url(#landingGlow)"
            stroke="url(#landingLine)"
            strokeWidth="1.4"
          />
          <path
            d="M124 340 C214 326 232 430 330 400 C404 376 436 434 508 410"
            fill="none"
            filter="url(#landingGlow)"
            stroke="url(#landingLine)"
            strokeWidth="1.2"
          />
        </svg>

        <motion.div
          className="absolute left-2 top-14 z-20 w-[230px] max-sm:left-0 max-sm:top-20 max-sm:w-[190px]"
          initial={{ opacity: 0, x: -26, y: 16 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
        >
          <SignalCard
            eyebrow="Background"
            icon={FileCheck2}
            title="Background analysed"
            value="62 proof points indexed"
          />
        </motion.div>

        <motion.div
          className="absolute right-0 top-28 z-20 w-[238px] max-sm:hidden"
          initial={{ opacity: 0, x: 30, y: 20 }}
          transition={{ delay: 0.32, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
        >
          <SignalCard
            eyebrow="Role"
            icon={ScanLine}
            title="Role scan in progress"
            value="Hiring signals extracted"
          />
        </motion.div>

        <motion.div
          className="absolute left-[52px] top-[278px] z-30 w-[210px] max-sm:hidden"
          initial={{ opacity: 0, x: -22, y: 26 }}
          transition={{ delay: 0.44, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
        >
          <SignalCard
            eyebrow="Evidence"
            icon={BriefcaseBusiness}
            title="Evidence match"
            value="98.7%"
          />
        </motion.div>

        <motion.div
          className="absolute bottom-8 right-5 z-10 w-[390px] rounded-[28px] border border-white/14 bg-[#06111c]/72 p-4 shadow-[0_44px_130px_rgba(0,0,0,0.48)] backdrop-blur-2xl max-sm:bottom-auto max-sm:right-auto max-sm:top-[178px] max-sm:w-full max-sm:p-3"
          initial={{ opacity: 0, y: 34, rotate: 1.5 }}
          transition={{ delay: 0.52, duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true }}
        >
          <div className="absolute inset-px rounded-[27px] bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_34%,rgba(0,240,255,0.12))]" />
          <div className="relative rounded-[22px] border border-white/10 bg-black/22 p-5 max-sm:p-4">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-lg font-semibold leading-none text-white">
                  Maya Patel
                </p>
                <p className="mt-2 text-sm text-cyan-100/80">
                  Product Operations Lead
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Auckland NZ | maya@email.com
                </p>
              </div>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-[10px] font-semibold uppercase text-emerald-100">
                Tailored
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[0.45fr_0.55fr]">
              <div className="space-y-2">
                <div className="h-2 w-16 rounded-full bg-cyan-100/40" />
                <div className="h-2 w-full rounded-full bg-white/18" />
                <div className="h-2 w-4/5 rounded-full bg-white/12" />
                <div className="h-2 w-2/3 rounded-full bg-white/10" />
              </div>
              <div className="rounded-[18px] border border-cyan-100/15 bg-cyan-100/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-cyan-100/70">
                  <Sparkles className="h-3 w-3" />
                  Rewritten bullet
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-100 max-sm:text-xs max-sm:leading-5">
                  Turned fragmented customer data into a weekly retention signal,
                  giving leaders clearer renewal decisions.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
