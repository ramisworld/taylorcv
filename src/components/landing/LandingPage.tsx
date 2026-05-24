"use client";

import {
  Check,
  ChevronDown,
  CircleCheck,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import {
  paidPlanFromSelection,
  planDisplayPrice,
  plans,
  type PlanKey,
} from "~/lib/plans";

import { LandingBackground } from "./LandingBackground";
import { FlowArrow } from "./FlowArrow";
import { GlassHeader } from "./GlassHeader";
import { PrimaryButton, SecondaryButton } from "./GlassButton";
import { LiquidGlassDefs } from "./LiquidGlassDefs";
import { ProofStrip } from "./ProofStrip";

type LandingPageProps = {
  error?: string | null;
  isLoading: boolean;
  isSignedIn?: boolean;
  onGetStarted: () => void;
  onDashboard?: () => void;
  onPlanSelected?: (planKey: PlanKey) => void;
  isCheckoutLoading?: boolean;
};

const requirements = [
  "Product leadership",
  "Rapid iteration mindset",
  "Manufacturing scale & cost focus",
  "AI / software product execution",
  "Cross-functional alignment",
  "High-velocity decision making",
] as const;

const gapRows = [
  {
    icon: "people",
    question: "What is the largest team you led to deliver a complex product?",
    status: "Matched",
    tone: "green",
  },
  {
    icon: "factory",
    question: "Share a measurable example of manufacturing impact at scale.",
    status: "Needs stronger evidence",
    tone: "amber",
  },
  {
    icon: "lock",
    question: "What AI or software product did you ship end-to-end?",
    status: "Missing proof",
    tone: "red",
  },
] as const;

const cvAchievements = [
  "Led Falcon 9 from concept to most-flown launch vehicle, driving reusability and >10x reduction in launch cost.",
  "Scaled Starlink to millions of users and built the world's largest LEO constellation manufacturing and deployment system.",
  "Integrated AI capabilities into products and operations to improve autonomy, forecasting, and decision velocity.",
] as const;

const cvSkills = [
  "Product Leadership",
  "Engineering Leadership",
  "Manufacturing Scale",
  "AI & Software Products",
  "Systems Thinking",
  "Cost & Margin Focus",
  "Cross-functional Alignment",
  "High-velocity Execution",
] as const;

const howSteps = [
  {
    title: "Paste the role",
    body: "TaylorCV extracts seniority, requirements, hiring signals, and must-have evidence from the job ad.",
  },
  {
    title: "Compare your background",
    body: "Your strongest proof is matched to each requirement so the CV is built from evidence, not generic claims.",
  },
  {
    title: "Answer the gaps",
    body: "A few targeted questions surface missing metrics, leadership scope, tools, and outcomes before the draft is written.",
  },
  {
    title: "Export a one-page CV",
    body: "The final CV stays concise, ATS-safe, and aligned to the role without overclaiming.",
  },
] as const;

const faqItems = [
  {
    question: "Is TaylorCV built for New Zealand job seekers?",
    answer:
      "Yes. The product is designed around practical job ads, concise one-page CVs, and the evidence employers expect from students, graduates, tradespeople, and professionals.",
  },
  {
    question: "Do I need an account?",
    answer:
      "You can start the analysis first. Account verification is required before final CV generation so your CV, usage, and billing are protected.",
  },
  {
    question: "Is the CV ATS-safe?",
    answer:
      "TaylorCV keeps the generated CV document-like, structured, and readable. It avoids decorative layouts that can make applicant tracking systems harder to parse.",
  },
  {
    question: "Are the company names endorsements?",
    answer:
      "No. The proof strip uses the wording 'professionals at' to avoid implying official company endorsement.",
  },
] as const;

const entrance = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function TaylorWordmark(props: { center?: boolean; compact?: boolean }) {
  return (
    <div
      aria-label="TaylorCV"
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        props.center && "justify-center"
      )}
    >
      <TaylorLogoIcon className={props.compact ? "h-[34px] w-[34px]" : "h-9 w-9"} />
      <span
        className={cn(
          "truncate font-bold tracking-[-0.04em] text-[#080d22]",
          props.compact ? "text-[25px]" : "text-[28px]"
        )}
      >
        TaylorCV
      </span>
    </div>
  );
}

function ScoreRing({ isHovered }: { isHovered?: boolean }) {
  const radius = 47;
  const circumference = 2 * Math.PI * radius;

  const percent = useMotionValue(84);
  const smoothPercent = useSpring(percent, { stiffness: 180, damping: 22 });

  useEffect(() => {
    const target = isHovered ? 99.7 : 84;
    const controls = animate(percent, target, {
      duration: 0.5,
      ease: "easeOut",
    });
    return controls.stop;
  }, [isHovered, percent]);

  const offset = useTransform(smoothPercent, (v) => circumference * (1 - v / 100));
  const rVal = useTransform(smoothPercent, [84, 99.7], [42, 4]);
  const gVal = useTransform(smoothPercent, [84, 99.7], [83, 214]);
  const bVal = useTransform(smoothPercent, [84, 99.7], [250, 138]);

  const color = useTransform([rVal, gVal, bVal], ([rv, gv, bv]) =>
    `rgb(${Math.round(rv as number)}, ${Math.round(gv as number)}, ${Math.round(bv as number)})`
  );

  const displayPercent = useTransform(smoothPercent, (v) => `${v.toFixed(1)}%`);

  return (
    <div className="relative grid h-[126px] w-[126px] place-items-center">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision" viewBox="0 0 126 126">
        <circle
          cx="63"
          cy="63"
          fill="none"
          r={radius}
          stroke="#e8eefb"
          strokeWidth="6"
        />
        <motion.circle
          cx="63"
          cy="63"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth="6"
          style={{ strokeDashoffset: offset, stroke: color }}
          transform="rotate(-96 63 63)"
        />
      </svg>
      <div className="relative text-center">
        <motion.p className="tabular-nums text-[27px] font-semibold leading-[1.05] tracking-[-0.018em] text-[#080d22]">
          {displayPercent}
        </motion.p>
        <p className="mt-1 text-[10.5px] font-medium leading-none text-[#64718d]">Overall fit</p>
      </div>
    </div>
  );
}

function CardShell(props: {
  children: React.ReactNode;
  className?: string;
  index: number;
  title: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <article
      className={cn(
        "relative min-h-[444px] rounded-[15px] border border-[#dfe6f2] bg-white/82 p-7 text-[#080d22] shadow-[0_24px_56px_rgba(29,42,78,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl transition duration-300 ease-out hover:scale-[1.015] hover:shadow-[0_28px_64px_rgba(29,42,78,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] xl:h-[444px]",
        props.className
      )}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      <div className="mb-5 flex items-center gap-4">
        <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#2450f4] text-[17px] font-bold text-white shadow-[0_8px_18px_rgba(32,71,240,0.24),inset_0_1px_0_rgba(255,255,255,0.25)]">
          {props.index}
        </span>
        <h3 className="text-[18px] font-semibold tracking-[-0.025em]">{props.title}</h3>
      </div>
      {props.children}
    </article>
  );
}

function JobAdCard() {
  return (
    <CardShell index={1} title="Paste job ad">
      <div className="overflow-hidden rounded-[10px] border border-[#dfe5ef] bg-white shadow-[0_16px_32px_rgba(8,13,34,0.075)]">
        <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border-b border-[#e5eaf2] p-3">
          <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[8px] border border-[#edf1f6] bg-white shadow-[0_5px_12px_rgba(8,13,34,0.04)]">
            <img
              alt="SpaceX"
              className="h-8 w-[50px] object-contain"
              src="/assets/company-logos/spacex-x.svg"
            />
          </span>
          <div className="min-w-0">
            <p className="max-w-[230px] text-[12.5px] font-bold leading-snug tracking-[-0.02em]">
              Senior Product & Engineering Executive
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#2047f0]">SpaceX</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9.5px] font-medium text-[#56627d]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Hawthorne, CA
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border border-[#9aa7bd]" />
                Full-time
              </span>
            </div>
          </div>
        </div>
        <div className="p-3">
          <p className="mb-2 text-[12px] font-bold tracking-[-0.015em]">Key requirements</p>
          <div className="flex flex-wrap gap-2">
            {requirements.map((requirement) => (
              <span
                className="inline-flex min-h-[28px] w-fit items-center gap-2.5 rounded-full border border-[#e0e6ef] bg-[#fbfcff] px-3.5 text-[11px] font-medium text-[#25314d]"
                key={requirement}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#2047f0]" />
                {requirement}
              </span>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function GapIcon(props: { type: (typeof gapRows)[number]["icon"] }) {
  if (props.type === "people") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <circle cx="6" cy="5" fill="none" r="2.2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.8 12.5c.45-2 1.55-3 3.2-3s2.75 1 3.2 3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        <path d="M10.2 7.3a2 2 0 1 0-.15-3.65" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
        <path d="M10.7 9.7c1.25.2 2.08 1.1 2.5 2.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }
  if (props.type === "factory") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M2.5 12.8V6.3l3.3 2.1V6.3l3.4 2.1V4.1h3.2v8.7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M2.2 12.8h11.6M5 11h1.2M8 11h1.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
      <rect fill="none" height="7" rx="1.7" stroke="currentColor" strokeWidth="1.5" width="9" x="3.5" y="6.5" />
      <path d="M5.2 6.5V5a2.8 2.8 0 0 1 5.6 0v1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function FitGapsCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <CardShell
      className="min-h-[444px] lg:min-w-[440px]"
      index={2}
      title="Role fit + gaps to answer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3.5 max-sm:grid-cols-1">
        <ScoreRing isHovered={hovered} />
        <div className="flex items-start gap-3 rounded-[10px] bg-[#f1f4fc] p-4">
          <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#2450f4]" viewBox="0 0 18 18">
            <path d="M9 1.6 10.4 6l4.4 1.4-4.4 1.4L9 13.2 7.6 8.8 3.2 7.4 7.6 6 9 1.6Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
            <path d="m14.2 12.4.45 1.45 1.45.45-1.45.45-.45 1.45-.45-1.45-1.45-.45 1.45-.45.45-1.45Z" fill="currentColor" />
          </svg>
          <p className="text-[12.3px] font-medium leading-[1.62] text-[#34415f]">
            <span className="font-semibold text-[#2047f0]">TaylorCV found a few gaps.</span>
            <br />
            Answer 3 quick questions to
            <br />
            strengthen your match and
            <br />
            unlock your tailored CV.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-2.5 text-[12.5px] font-bold">3 smart questions to answer</p>
        <div className="overflow-hidden rounded-[10px] border border-[#dfe5ef] bg-white">
          {gapRows.map((row) => (
            <div
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e7ecf4] px-3.5 py-2.5 last:border-b-0 max-sm:grid-cols-[32px_minmax(0,1fr)]"
              key={row.question}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef3ff] text-[#2047f0]">
                <GapIcon type={row.icon} />
              </span>
              <p className="text-[10.8px] font-medium leading-[1.55] text-[#263252]">{row.question}</p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-center text-[9.5px] font-semibold leading-tight max-sm:col-start-2 max-sm:w-fit",
                  row.tone === "green" && "bg-[#daf6e9] text-[#07814f]",
                  row.tone === "amber" && "bg-[#fff0d9] text-[#c66a00]",
                  row.tone === "red" && "bg-[#ffe4e8] text-[#d43857]"
                )}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function CvPreviewCard() {
  return (
    <CardShell index={3} title="Get tailored CV">
      <div
        className="rounded-[9px] border border-[#dfe5ef] bg-white px-4 py-3 shadow-[0_14px_30px_rgba(8,13,34,0.065)]"
        id="example-cv"
      >
        <header className="border-b border-[#e4e9f2] pb-2.5">
          <h4 className="text-[21px] font-bold leading-none tracking-[-0.045em] text-[#080d22]">
            Elon Musk
          </h4>
          <p className="mt-1 text-[10.5px] font-bold text-[#2047f0]">
            Senior Product & Engineering Executive
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[6.8px] font-medium text-[#4d5872]">
            <span>Hawthorne, CA</span>
            <span>elon@spacex.com</span>
            <span>linkedin.com/in/elonmusk</span>
          </p>
        </header>
        <CvSection title="Professional Summary">
          Product and engineering executive with a track record of building and scaling breakthrough technologies at SpaceX, Tesla, and xAI. Expert in product strategy, system design, manufacturing scale, and rapid iteration to deliver fundamentally better, lower-cost products to market.
        </CvSection>
        <CvSection title="Selected Achievements">
          <div className="space-y-1.5">
            {cvAchievements.map((achievement) => (
              <div className="grid grid-cols-[15px_minmax(0,1fr)] gap-2" key={achievement}>
                <span className="mt-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#2047f0] text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                <p>{achievement}</p>
              </div>
            ))}
          </div>
        </CvSection>
        <CvSection title="Core Skills">
          <div className="flex flex-wrap gap-1.5">
            {cvSkills.map((skill) => (
              <span
                className="rounded-full bg-[#edf1f8] px-2 py-0.5 text-[7.5px] font-semibold text-[#33405f]"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        </CvSection>
      </div>
    </CardShell>
  );
}

function CvSection(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="border-b border-[#e8edf4] py-2 text-[8.2px] leading-[1.34] text-[#1f2a44] last:border-b-0 last:pb-0">
      <h5 className="mb-1.5 text-[7.4px] font-bold uppercase tracking-[0.03em] text-[#10182d]">
        {props.title}
      </h5>
      {props.children}
    </section>
  );
}

function WorkflowCards() {
  return (
    <motion.div
      animate="visible"
      className="relative mx-auto mt-5 grid w-full max-w-[1450px] grid-cols-[0.98fr_1.1fr_1.05fr] gap-8 px-12 max-xl:grid-cols-1 max-xl:px-5"
      initial="hidden"
      transition={{ staggerChildren: 0.08, delayChildren: 0.18 }}
    >
      <motion.div className="relative" transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} variants={entrance}>
        <JobAdCard />
        <FlowArrow className="absolute right-[-34px] top-1/2 z-10 -translate-y-1/2 max-xl:hidden" />
      </motion.div>
      <motion.div className="relative" transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} variants={entrance}>
        <FitGapsCard />
        <FlowArrow className="absolute right-[-34px] top-1/2 z-10 -translate-y-1/2 max-xl:hidden" />
      </motion.div>
      <motion.div transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} variants={entrance}>
        <CvPreviewCard />
      </motion.div>
    </motion.div>
  );
}

function Hero(props: LandingPageProps) {
  return (
    <section className="relative z-10 pt-6">
      <motion.div
        animate="visible"
        className="mx-auto max-w-[960px] px-5 text-center"
        initial="hidden"
        transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
      >
        <motion.div transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} variants={entrance}>
          <TaylorWordmark center />
        </motion.div>
        <motion.h1
          className="mx-auto mt-4 max-w-[900px] text-balance text-[clamp(2.9rem,3.8vw,4.18rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#080d22]"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          variants={entrance}
        >
          Paste one job. Get a CV built
          <br className="hidden sm:block" />
          {" "}
          for the interview.
        </motion.h1>
        <motion.p
          className="mx-auto mt-3 max-w-[680px] text-[16px] leading-7 text-[#33405f]"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          variants={entrance}
        >
          TaylorCV reads the role, compares your background, and builds a sharp,
          <br className="hidden sm:block" />
          {" "}
          one-page CV that proves you’re the right hire.
        </motion.p>
        <motion.div
          className="mt-5 flex flex-wrap items-center justify-center gap-5"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          variants={entrance}
        >
          <PrimaryButton
            className="min-w-[285px]"
            disabled={props.isLoading}
            onClick={props.onGetStarted}
            trailingArrow
          >
            {props.isLoading ? "Starting..." : "See what my CV is missing"}
          </PrimaryButton>
        </motion.div>
        {props.error ? (
          <p className="mx-auto mt-4 max-w-xl rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {props.error}
          </p>
        ) : null}
        <motion.p
          className="mx-auto mt-4 flex max-w-[520px] items-center justify-center gap-2.5 text-center text-[15px] font-medium text-[#435070]"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          variants={entrance}
        >
          <span className="grid h-5 w-5 place-items-center text-[#2047f0]">
            <ShieldCheck className="h-5 w-5 fill-[#2047f0] text-white" strokeWidth={2.1} />
          </span>
          Built for job ads, ATS systems, and one-page CVs.
        </motion.p>
      </motion.div>
      <div id="examples">
        <WorkflowCards />
      </div>
      <ProofStrip />
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="relative z-10 mx-auto max-w-[1240px] px-6 py-24" id="how-it-works">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.25fr] lg:items-start">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#2047f0]">
            How it works
          </p>
          <h2 className="mt-4 text-[clamp(2.2rem,3vw,3.6rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#080d22]">
            Role evidence in.
            <br />
            One-page CV out.
          </h2>
          <p className="mt-5 max-w-[500px] text-[17px] leading-7 text-[#42506d]">
            TaylorCV keeps the workflow focused: parse the job, match your evidence, ask only the highest-value questions, then produce the draft.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {howSteps.map((step, index) => (
            <article
              className="rounded-[15px] border border-[#dfe5ef] bg-white/76 p-6 shadow-[0_18px_38px_rgba(29,42,78,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
              key={step.title}
            >
              <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-[#eef3ff] text-[15px] font-bold text-[#2047f0]">
                {index + 1}
              </span>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.025em] text-[#080d22]">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-6 text-[#42506d]">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection(props: LandingPageProps) {
  const [variant, setVariant] = useState<"annual" | "monthly">("annual");
  const proKey = paidPlanFromSelection("pro", variant);
  const premiumKey = paidPlanFromSelection("premium", variant);
  const cards = useMemo(
    () => [
      {
        key: "free" as const,
        name: "Free",
        detail: "Start with one tailored CV generation.",
        price: "NZ$0",
        quota: "1 CV generation",
        bullets: ["Paste a job ad", "Role-aware match analysis", "PDF export"],
        cta: "Get started",
        featured: false,
        onClick: props.onGetStarted,
      },
      {
        key: proKey,
        name: "Pro",
        detail: variant === "annual" ? "Annual plan, billed for 12 months." : "Monthly access for active job search.",
        price: planDisplayPrice(proKey),
        quota: `${plans[proKey].cvGenerationQuota} CVs / month`,
        bullets: ["Gap questions", "Evidence-backed tailoring", "DOCX and PDF exports"],
        cta: "Start Pro",
        featured: true,
        onClick: () => props.onPlanSelected?.(proKey),
      },
      {
        key: premiumKey,
        name: "Premium",
        detail: variant === "annual" ? "Best for frequent applications." : "Higher monthly capacity.",
        price: planDisplayPrice(premiumKey),
        quota: `${plans[premiumKey].cvGenerationQuota} CVs / month`,
        bullets: ["Everything in Pro", "Higher generation capacity", "Built for frequent tailoring"],
        cta: "Start Premium",
        featured: false,
        onClick: () => props.onPlanSelected?.(premiumKey),
      },
    ],
    [premiumKey, proKey, props, variant]
  );

  return (
    <section className="relative z-10 bg-white/46 px-6 py-24" id="pricing">
      <div className="mx-auto max-w-[1220px]">
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#2047f0]">
            Pricing
          </p>
          <h2 className="mt-4 text-[clamp(2.15rem,3vw,3.55rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#080d22]">
            Simple plans for serious applications.
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-[17px] leading-7 text-[#42506d]">
            Start free, then choose the amount of tailoring you need while you apply.
          </p>
          <div className="mt-7 inline-grid grid-cols-2 rounded-full border border-[#d8dfec] bg-white p-1 shadow-[0_10px_22px_rgba(29,42,78,0.07)]">
            {(["monthly", "annual"] as const).map((option) => (
              <button
                className={cn(
                  "h-10 rounded-full px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/16",
                  variant === option
                    ? "bg-[#2047f0] text-white shadow-[0_8px_18px_rgba(32,71,240,0.22)]"
                    : "text-[#42506d] hover:text-[#080d22]"
                )}
                key={option}
                onClick={() => setVariant(option)}
                type="button"
              >
                {option === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              className={cn(
                "relative rounded-[18px] border bg-white p-7 shadow-[0_22px_48px_rgba(29,42,78,0.1),inset_0_1px_0_rgba(255,255,255,0.95)]",
                card.featured
                  ? "border-[#2047f0] ring-4 ring-[#2047f0]/10"
                  : "border-[#dfe5ef]"
              )}
              key={card.key}
            >
              {card.featured ? (
                <span className="absolute right-5 top-5 rounded-full bg-[#eef3ff] px-3 py-1 text-[12px] font-bold text-[#2047f0]">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-[27px] font-semibold tracking-[-0.04em] text-[#080d22]">
                {card.name}
              </h3>
              <p className="mt-2 min-h-12 text-[14.5px] leading-6 text-[#42506d]">{card.detail}</p>
              <p className="mt-8 text-[42px] font-bold leading-none tracking-[-0.04em] text-[#080d22]">
                {card.price}
                {card.key !== "free" ? <span className="text-[15px] font-medium text-[#42506d]"> / month</span> : null}
              </p>
              <p className="mt-3 rounded-[10px] bg-[#f3f6fb] px-4 py-3 text-[14px] font-bold text-[#263252]">
                {card.quota}
              </p>
              <ul className="mt-6 grid gap-3">
                {card.bullets.map((bullet) => (
                  <li className="flex items-center gap-3 text-[14.5px] text-[#263252]" key={bullet}>
                    <CircleCheck className="h-4.5 w-4.5 text-[#04ae66]" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <PrimaryButton
                className={cn("mt-8 w-full", !card.featured && "bg-[#080d22] hover:bg-[#18213b]")}
                disabled={props.isLoading || props.isCheckoutLoading}
                onClick={card.onClick}
                trailingArrow
              >
                {card.cta}
              </PrimaryButton>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="relative z-10 mx-auto max-w-[1040px] px-6 py-24" id="faq">
      <div className="text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#2047f0]">
          FAQ
        </p>
        <h2 className="mt-4 text-[clamp(2.1rem,3vw,3.4rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#080d22]">
          Practical answers before you paste the job.
        </h2>
      </div>
      <div className="mt-10 grid gap-4">
        {faqItems.map((item) => (
          <details
            className="group rounded-[15px] border border-[#dfe5ef] bg-white/76 p-6 shadow-[0_16px_34px_rgba(29,42,78,0.08)]"
            key={item.question}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[18px] font-semibold tracking-[-0.02em] text-[#080d22] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14">
              {item.question}
              <ChevronDown className="h-5 w-5 text-[#2047f0] transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 max-w-[780px] text-[15px] leading-7 text-[#42506d]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function LandingPage(props: LandingPageProps) {
  return (
    <main className="relative min-h-screen max-w-[100vw] overflow-x-hidden bg-[#fcfcfd] text-[#080d22]">
      <LiquidGlassDefs />
      <LandingBackground />
      <GlassHeader {...props} />
      <Hero {...props} />
      <HowItWorksSection />
      <PricingSection {...props} />
      <FaqSection />
    </main>
  );
}
