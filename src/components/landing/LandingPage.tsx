"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Flag,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  UserRound,
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
      className="sticky top-0 z-50 w-full border-b border-white/[0.09] bg-[#030813]/58 shadow-[0_14px_42px_rgba(2,6,23,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#030813]/42"
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

const howItWorksSteps = [
  {
    title: "Paste your job description",
    body: "Taylor reads the role and extracts what really matters.",
  },
  {
    title: "Add your background",
    body: "Add your experience and Taylor builds a complete picture.",
  },
  {
    title: "Taylor finds strong evidence and asks 1–3 high-ROI questions",
    body: "You get targeted questions to surface the evidence that wins.",
  },
  {
    title: "Get a tailored CV with a stronger match",
    body: "Your CV is aligned to the role and ready to land interviews.",
  },
] as const;

const backgroundRows = [
  {
    icon: BriefcaseBusiness,
    title: "12+ years experience",
    body: "Product Strategy",
  },
  {
    icon: UserRound,
    title: "Senior Product Manager",
    body: "SaaS · B2B · Remote",
  },
  {
    icon: Star,
    title: "Key skills",
    body: "Analytics, Roadmaps, Stakeholder Mgmt",
  },
  {
    icon: Flag,
    title: "Achievements",
    body: "Led cross-functional teams, improved activation by 32%",
  },
] as const;

const tailoredCvItems = [
  "Stronger evidence",
  "Keyword alignment",
  "Impact statements",
  "Skill coverage",
  "Role relevance",
] as const;

function StepIntro(props: { body: string; index: number; title: string }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 min-[2400px]:grid-cols-[48px_minmax(0,1fr)] min-[2400px]:gap-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-[17px] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.58),inset_0_1px_0_rgba(255,255,255,0.24)] min-[2400px]:h-12 min-[2400px]:w-12 min-[2400px]:text-[20px]">
        {props.index}
      </span>
      <div>
        <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.035em] text-white min-[2400px]:text-[20px]">
          {props.title}
        </h3>
        <p className="mt-2.5 max-w-[250px] text-[13.5px] leading-6 text-slate-300/86 min-[2400px]:mt-3 min-[2400px]:max-w-[290px] min-[2400px]:text-[16px] min-[2400px]:leading-7">
          {props.body}
        </p>
      </div>
    </div>
  );
}

function ProcessArrow() {
  return (
    <div className="hidden h-[320px] items-center justify-center pt-[156px] xl:flex 2xl:h-[330px] min-[2400px]:!h-[410px] min-[2400px]:pt-[196px]">
      <ArrowRight className="h-8 w-8 text-slate-300/70 min-[2400px]:h-9 min-[2400px]:w-9" strokeWidth={1.65} />
    </div>
  );
}

function WhiteProcessCard(props: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl border border-blue-100/80 bg-white p-5 text-slate-950 min-[2400px]:p-6",
        "shadow-[0_28px_82px_rgba(2,6,23,0.42),0_0_0_1px_rgba(255,255,255,0.48),inset_0_1px_0_rgba(255,255,255,0.9)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_85%_5%,rgba(59,130,246,0.08),transparent_30%)]",
        props.className ?? "",
      ].join(" ")}
    >
      <div className="relative">
        <h4 className="text-[16px] font-semibold leading-none tracking-[-0.035em] text-slate-950 min-[2400px]:text-[18px]">
          {props.title}
        </h4>
        {props.children}
      </div>
    </div>
  );
}

function MiniScoreRing(props: { score: number; tone: "blue" | "green" }) {
  const isGreen = props.tone === "green";
  return (
    <div
      className={[
        "relative grid place-items-center rounded-full",
        isGreen
          ? "h-[108px] w-[108px] min-[2400px]:h-[128px] min-[2400px]:w-[128px]"
          : "h-[92px] w-[92px] min-[2400px]:h-[112px] min-[2400px]:w-[112px]",
      ].join(" ")}
      style={{
        background: isGreen
          ? `conic-gradient(#1fb874 ${props.score * 3.6}deg, #d9f3e8 0deg)`
          : `conic-gradient(#1667f2 ${props.score * 3.6}deg, #cfe0fb 0deg)`,
      }}
    >
      <div className="absolute inset-[9px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]" />
      <div className="relative text-center">
        <p className="text-[25px] font-bold leading-none tracking-[-0.05em] text-slate-950 min-[2400px]:text-[30px]">
          {props.score}%
        </p>
        <p className="mt-1 text-[11px] font-semibold text-slate-800 min-[2400px]:text-[12px]">Match</p>
      </div>
    </div>
  );
}

function JobDescriptionProcessCard(props: LandingPageProps) {
  return (
    <WhiteProcessCard className="h-[320px] 2xl:h-[330px] min-[2400px]:!h-[410px]" title="Job description">
      <div className="mt-7 space-y-3.5 min-[2400px]:mt-8 min-[2400px]:space-y-4">
        {[92, 78, 92, 78, 92, 78, 92].map((width, index) => (
          <div className="flex items-center gap-3" key={`${width}-${index}`}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-200 min-[2400px]:h-2.5 min-[2400px]:w-2.5" />
            <span
              className="h-2 rounded-full bg-slate-200 min-[2400px]:h-2.5"
              style={{ width: `${width}%` }}
            />
          </div>
        ))}
      </div>

      <button
        className="absolute inset-x-6 bottom-9 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-blue-600 text-[13.5px] font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] transition hover:bg-blue-500 min-[2400px]:inset-x-7 min-[2400px]:bottom-11 min-[2400px]:min-h-13 min-[2400px]:gap-3 min-[2400px]:text-[15px]"
        disabled={props.isLoading}
        onClick={props.onGetStarted}
        type="button"
      >
        <ClipboardList className="h-5 w-5" />
        {props.isLoading ? "Starting..." : "Paste job description"}
      </button>
    </WhiteProcessCard>
  );
}

function BackgroundProcessCard() {
  return (
    <WhiteProcessCard className="h-[320px] 2xl:h-[330px] min-[2400px]:!h-[410px]" title="Your background">
      <div className="mt-7 space-y-4.5 min-[2400px]:mt-8 min-[2400px]:space-y-6">
        {backgroundRows.map((row) => {
          const Icon = row.icon;
          return (
            <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 min-[2400px]:grid-cols-[38px_minmax(0,1fr)]" key={row.title}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 min-[2400px]:h-9 min-[2400px]:w-9">
                <Icon className="h-4.5 w-4.5 min-[2400px]:h-5 min-[2400px]:w-5" />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 min-[2400px]:text-[14px]">
                  {row.title}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-slate-600 min-[2400px]:text-[13px]">{row.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </WhiteProcessCard>
  );
}

function EvidenceProcessCards() {
  return (
    <div className="grid gap-3 min-[2400px]:gap-4">
      <WhiteProcessCard className="h-[150px] 2xl:h-[155px] min-[2400px]:!h-[204px]" title="Evidence found">
        <div className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-5 min-[2400px]:mt-5 min-[2400px]:grid-cols-[118px_minmax(0,1fr)] min-[2400px]:gap-6">
          <MiniScoreRing score={55} tone="blue" />
          <div className="space-y-3">
            {[94, 94, 82, 95].map((width, index) => (
              <span
                className="block h-2 rounded-full bg-slate-200 min-[2400px]:h-2.5"
                key={`${width}-${index}`}
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </div>
      </WhiteProcessCard>

      <WhiteProcessCard className="h-[170px] 2xl:h-[170px] min-[2400px]:!h-[190px]" title="">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white shadow-[0_0_16px_rgba(37,99,235,0.32)]">
            ?
          </span>
          <h4 className="text-[16px] font-semibold leading-none tracking-[-0.035em] text-slate-950 min-[2400px]:text-[18px]">
            High-ROI question
          </h4>
        </div>
        <p className="mt-4 text-[12px] leading-5 text-slate-700 min-[2400px]:mt-5 min-[2400px]:text-[13px] min-[2400px]:leading-6">
          What was the measurable impact of the activation strategy you led?
        </p>
        <div className="mt-3 min-h-11 rounded-md border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] min-[2400px]:mt-4 min-[2400px]:text-[13px]">
          Type your answer...
        </div>
      </WhiteProcessCard>
    </div>
  );
}

function TailoredCvProcessCard() {
  return (
    <WhiteProcessCard className="h-[320px] 2xl:h-[330px] min-[2400px]:!h-[410px]" title="Your tailored CV">
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-[2400px]:mt-7 min-[2400px]:gap-4">
        <div className="flex justify-center text-emerald-500">
          <Sparkles className="h-7 w-7 fill-emerald-500/18 min-[2400px]:h-8 min-[2400px]:w-8" />
        </div>
        <MiniScoreRing score={97} tone="green" />
        <div className="flex justify-center text-emerald-500">
          <Sparkles className="h-7 w-7 fill-emerald-500/18 min-[2400px]:h-8 min-[2400px]:w-8" />
        </div>
      </div>

      <ul className="mt-5 space-y-2.5 min-[2400px]:mt-6 min-[2400px]:space-y-3">
        {tailoredCvItems.map((item) => (
          <li className="flex items-center gap-3 text-[12px] text-slate-700 min-[2400px]:text-[13px]" key={item}>
            <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </WhiteProcessCard>
  );
}

function HowItWorksSection(props: LandingPageProps) {
  return (
    <section className="relative z-10 overflow-hidden px-5 pb-20 pt-8 sm:px-8 lg:px-10 xl:pb-24 xl:pt-8 2xl:px-14 min-[2400px]:pb-28 min-[2400px]:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(37,99,235,0.17),transparent_38%),radial-gradient(circle_at_50%_88%,rgba(14,165,233,0.08),transparent_36%)]" />
      <div className="relative mx-auto max-w-[1320px] min-[2400px]:max-w-[1880px]">
        <div className="text-center">
          <p className="text-[14px] font-semibold uppercase tracking-[0.42em] text-cyan-300">
            How it works
          </p>
          <h2 className="mx-auto mt-6 max-w-[980px] text-balance text-[clamp(2.75rem,3.72vw,3.8rem)] font-semibold leading-[1.13] tracking-[-0.055em] text-white min-[2400px]:relative min-[2400px]:left-1/2 min-[2400px]:w-[2200px] min-[2400px]:max-w-none min-[2400px]:-translate-x-1/2 min-[2400px]:whitespace-nowrap min-[2400px]:text-[3rem]">
            How Taylor turns your background
            <br className="hidden md:block min-[2400px]:hidden" />
            into a stronger CV
          </h2>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2 xl:grid-cols-[1fr_38px_1fr_38px_1.08fr_38px_1fr] xl:items-start xl:gap-3 min-[2400px]:mt-16 min-[2400px]:grid-cols-[1fr_58px_1fr_58px_1.1fr_58px_1fr] min-[2400px]:gap-5">
          <div>
            <StepIntro index={1} {...howItWorksSteps[0]} />
            <div className="mt-5 min-[2400px]:mt-8">
              <JobDescriptionProcessCard {...props} />
            </div>
          </div>
          <ProcessArrow />

          <div>
            <StepIntro index={2} {...howItWorksSteps[1]} />
            <div className="mt-5 min-[2400px]:mt-8">
              <BackgroundProcessCard />
            </div>
          </div>
          <ProcessArrow />

          <div>
            <StepIntro index={3} {...howItWorksSteps[2]} />
            <div className="mt-5 min-[2400px]:mt-8">
              <EvidenceProcessCards />
            </div>
          </div>
          <ProcessArrow />

          <div>
            <StepIntro index={4} {...howItWorksSteps[3]} />
            <div className="mt-5 min-[2400px]:mt-8">
              <TailoredCvProcessCard />
            </div>
          </div>
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

      <section className="relative z-10 mx-auto grid w-full max-w-[1920px] grid-cols-1 gap-10 px-5 pb-12 pt-8 sm:px-8 lg:px-10 xl:min-h-[calc(100vh-4rem)] xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)] xl:items-start xl:gap-6 xl:pb-6 xl:pt-9 2xl:grid-cols-[minmax(470px,570px)_minmax(0,1fr)] 2xl:gap-10 2xl:px-14 2xl:pt-11 min-[1900px]:max-w-[2060px] min-[1900px]:!min-h-0 min-[1900px]:grid-cols-[minmax(540px,640px)_minmax(0,1fr)] min-[1900px]:pb-2">
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
      <HowItWorksSection {...props} />
    </main>
  );
}
