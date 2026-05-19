"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  Trophy,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";

import { TaylorBrand } from "~/components/TaylorBrand";

import { LandingArtifact } from "./LandingArtifact";
import { LandingBackground } from "./LandingBackground";

type LandingPageProps = {
  error?: string | null;
  isLoading: boolean;
  onGetStarted: () => void;
};

const entrance = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const benefits = [
  {
    icon: ShieldCheck,
    title: "Private & secure",
    body: "Your data is encrypted and never shared.",
  },
  {
    icon: Sparkles,
    title: "AI that gets you",
    body: "Built on proven job matching and NLP.",
  },
  {
    icon: CheckCircle2,
    title: "Results that land",
    body: "Tailored CVs that pass screens and get replies.",
  },
];

const companyLogos = [
  { name: "Airbnb", src: "/assets/company-logos/airbnb.svg" },
  { name: "Canva", src: "/assets/company-logos/canva.svg" },
  { name: "Microsoft", src: "/assets/company-logos/microsoft.svg" },
  { name: "Google", src: "/assets/company-logos/google.svg" },
  { name: "Atlassian", src: "/assets/company-logos/atlassian.svg" },
  { name: "Shopify", src: "/assets/company-logos/shopify.svg" },
  { name: "Stripe", src: "/assets/company-logos/stripe.svg" },
  { name: "Figma", src: "/assets/company-logos/figma.svg" },
  { name: "HubSpot", src: "/assets/company-logos/hubspot.svg" },
  { name: "Slack", src: "/assets/company-logos/slack.svg" },
] as const;

const trustedStats = [
  {
    icon: UsersRound,
    value: "1,900+",
    label: "professionals helped",
  },
  {
    icon: TrendingUp,
    value: "29%",
    label: "average match uplift",
  },
  {
    icon: Trophy,
    value: "920+",
    label: "interviews won",
  },
] as const;

function LandingNav(props: LandingPageProps) {
  return (
    <motion.header
      animate="visible"
      className="relative z-30 w-full border-b border-white/[0.075] bg-[#030813]/34 backdrop-blur-sm"
      initial="hidden"
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      variants={entrance}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10 2xl:h-[68px] 2xl:px-14">
        <TaylorBrand
          markClassName="h-8 w-8 2xl:h-9 2xl:w-9"
          textClassName="text-[21px] font-semibold 2xl:text-[22px]"
        />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-12 text-[14px] font-semibold text-white/86 lg:flex">
          <span aria-disabled="true">How it works</span>
          <span aria-disabled="true">Pricing</span>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-[14px] font-medium">
          <button
            className="hidden cursor-default rounded-md px-2.5 py-1.5 text-white/82 sm:inline-flex"
            type="button"
          >
            Sign in
          </button>
          <motion.button
            className="group inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg bg-blue-600 px-4 text-[14px] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.42),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-5"
            disabled={props.isLoading}
            onClick={props.onGetStarted}
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
          >
            {props.isLoading ? "Starting..." : "Build my CV"}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}

function LandingCta(props: LandingPageProps) {
  return (
    <div className="mt-7 flex xl:mt-6 2xl:mt-8">
      <motion.button
        className="group inline-flex min-h-14 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg bg-blue-600 px-5 text-[14px] font-semibold text-white shadow-[0_18px_58px_rgba(37,99,235,0.32),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6"
        disabled={props.isLoading}
        onClick={props.onGetStarted}
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
      >
        <ClipboardList className="h-4.5 w-4.5" />
        {props.isLoading ? "Starting..." : "Start with a job description"}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </motion.button>
    </div>
  );
}

function BenefitRows() {
  return (
    <div className="mt-8 grid overflow-hidden rounded-xl border border-white/[0.105] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:grid-cols-3 xl:mt-7 xl:max-w-[430px] 2xl:mt-8 2xl:max-w-none">
      {benefits.map((benefit) => {
        const Icon = benefit.icon;
        return (
          <div
            className="flex min-h-[92px] items-start gap-2.5 border-b border-white/[0.08] p-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 2xl:min-h-[104px] 2xl:gap-3 2xl:p-4"
            key={benefit.title}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.07)] 2xl:h-8 2xl:w-8">
              <Icon className="h-4 w-4 2xl:h-4.5 2xl:w-4.5" />
            </span>
            <div>
              <p className="text-[12px] font-semibold tracking-[-0.01em] text-white 2xl:text-[13px]">
                {benefit.title}
              </p>
              <p className="mt-1.5 text-[11px] leading-[1.4] text-slate-400 2xl:mt-2 2xl:text-[12px]">
                {benefit.body}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogoMarquee() {
  const logos = [...companyLogos, ...companyLogos];
  return (
    <div className="relative mx-auto mt-7 w-full overflow-hidden border-y border-blue-400/16 py-5 [mask-image:linear-gradient(90deg,transparent,black_9%,black_91%,transparent)] 2xl:mt-9 2xl:py-6 min-[1900px]:mt-6">
      <div className="taylor-logo-marquee flex w-max items-center gap-8">
        {logos.map((company, index) => (
          <span
            className="flex items-center gap-2.5 opacity-82"
            key={`${company.name}-${index}`}
          >
            <img
              alt={`${company.name} logo`}
              className="h-6 w-6 object-contain"
              src={company.src}
            />
            <span className="whitespace-nowrap text-[18px] font-semibold tracking-[-0.04em] text-white/82">
              {company.name}
            </span>
            <span className="ml-5 h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_14px_rgba(59,130,246,0.95)]" />
          </span>
        ))}
      </div>
    </div>
  );
}

function TrustedCompaniesSection() {
  return (
    <section className="relative z-10 border-t border-blue-400/12 px-5 py-12 sm:px-8 lg:px-10 2xl:px-14 2xl:py-14 min-[1900px]:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.18),rgba(34,211,238,0.75),rgba(59,130,246,0.18),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.16),transparent_34%)]" />
      <div className="relative mx-auto max-w-[1540px] text-center">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-400/25 bg-blue-500/[0.055] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-300 shadow-[0_0_28px_rgba(37,99,235,0.12)]">
          <ShieldCheck className="h-4 w-4" />
          Trusted by professionals
        </div>
        <h2 className="mx-auto mt-5 max-w-[1120px] text-balance text-[clamp(3rem,4.9vw,5.9rem)] font-semibold leading-[1.05] tracking-[-0.055em] text-white min-[1900px]:mt-4">
          Trusted by{" "}
          <span className="bg-[linear-gradient(100deg,#3b82f6_0%,#2776ff_48%,#49ddff_100%)] bg-clip-text text-transparent">
            professionals at
          </span>
        </h2>

        <LogoMarquee />

        <div className="mx-auto mt-12 grid max-w-[1220px] overflow-hidden rounded-xl border border-blue-300/18 bg-white/[0.025] shadow-[0_0_42px_rgba(37,99,235,0.13),inset_0_1px_0_rgba(255,255,255,0.06)] md:grid-cols-3">
          {trustedStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                className="flex items-center justify-center gap-6 border-b border-blue-300/12 px-6 py-8 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                key={stat.label}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-blue-300/22 bg-blue-500/[0.06] text-blue-400 shadow-[0_0_24px_rgba(37,99,235,0.16)]">
                  <Icon className="h-8 w-8" />
                </span>
                <span className="text-left">
                  <span className="block text-[38px] font-semibold leading-none tracking-[-0.045em] text-white">
                    {stat.value}
                  </span>
                  <span className="mt-2 block text-[16px] text-slate-300">
                    {stat.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingPage(props: LandingPageProps) {
  return (
    <main className="relative min-h-screen max-w-[100vw] overflow-x-hidden bg-[#030813] text-white">
      <LandingBackground />
      <LandingNav {...props} />

      <section className="relative z-10 mx-auto grid w-full max-w-[1920px] grid-cols-1 gap-10 px-5 pb-12 pt-8 sm:px-8 lg:px-10 xl:min-h-[calc(100vh-4rem)] xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)] xl:items-start xl:gap-6 xl:pb-6 xl:pt-9 2xl:grid-cols-[minmax(470px,570px)_minmax(0,1fr)] 2xl:gap-10 2xl:px-14 2xl:pt-11 min-[1900px]:max-w-[2060px] min-[1900px]:min-h-0 min-[1900px]:grid-cols-[minmax(540px,640px)_minmax(0,1fr)] min-[1900px]:pb-2">
        <motion.div
          animate="visible"
          className="max-w-[590px] xl:max-w-[430px] 2xl:max-w-[570px] min-[1900px]:max-w-[640px]"
          initial="hidden"
          transition={{ staggerChildren: 0.1, delayChildren: 0.05 }}
        >
          <motion.div
            className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-cyan-300/12 bg-cyan-300/[0.035] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.08)] 2xl:mb-5"
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
            variants={entrance}
          >
            <Sparkles className="h-4 w-4 fill-cyan-300/30" />
            AI Career Agent
          </motion.div>

          <motion.h1
            className="text-balance text-[clamp(3rem,3.55vw,4.55rem)] font-semibold leading-[1.08] tracking-[-0.052em] text-white min-[1900px]:text-[5rem]"
            transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
            variants={entrance}
          >
            Build the CV for
            <br />
            the job you
            <br />
            <span className="bg-[linear-gradient(100deg,#3778ff_0%,#49ddff_96%)] bg-clip-text text-transparent">
              actually want.
            </span>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-[575px] text-[15.5px] leading-7 text-slate-300/92 2xl:mt-6 2xl:text-[17px] 2xl:leading-8"
            transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
            variants={entrance}
          >
            Paste the role. Add your background. Taylor finds your strongest
            evidence, asks what's missing, and builds a focused CV that matches
            the job without sounding generic.
          </motion.p>

          <motion.div
            transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
            variants={entrance}
          >
            <LandingCta {...props} />
            {props.error ? (
              <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                {props.error}
              </p>
            ) : null}
          </motion.div>

          <motion.div
            transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
            variants={entrance}
          >
            <BenefitRows />
          </motion.div>
        </motion.div>

        <motion.div
          animate="visible"
          className="relative min-w-0"
          initial="hidden"
          transition={{ duration: 0.68, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          variants={entrance}
        >
          <div className="pointer-events-none absolute inset-0 translate-x-[6%] bg-[radial-gradient(circle_at_58%_50%,rgba(0,199,255,0.22),transparent_38%),radial-gradient(circle_at_76%_42%,rgba(37,99,235,0.2),transparent_32%)] blur-3xl" />
          <LandingArtifact />
        </motion.div>
      </section>
      <TrustedCompaniesSection />
    </main>
  );
}
