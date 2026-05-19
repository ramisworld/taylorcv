"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  FileText,
  Gauge,
  HelpCircle,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const checklist = [
  "Stronger evidence",
  "Keyword alignment",
  "Impact statements",
  "Skill coverage",
  "Role relevance",
];

const chipStyles = {
  blue: "border-blue-300/40 bg-blue-500/18 text-blue-100 shadow-[0_0_20px_rgba(37,99,235,0.38)]",
  green:
    "border-emerald-300/42 bg-emerald-400/18 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.34)]",
  purple:
    "border-violet-300/42 bg-violet-500/18 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.34)]",
  cyan: "border-cyan-300/42 bg-cyan-400/16 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.34)]",
  yellow:
    "border-amber-200/45 bg-amber-300/18 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.34)]",
};

function useAnimatedScore(target: number, duration = 1400) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setScore(target);
      return;
    }

    let frame = 0;
    let start = 0;
    const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);

    const tick = (time: number) => {
      if (!start) start = time;
      const progress = Math.min((time - start) / duration, 1);
      setScore(Math.round(target * easeOut(progress)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, target]);

  return score;
}

function NumberChip(props: {
  index: number;
  tone: keyof typeof chipStyles;
  className?: string;
}) {
  return (
    <span
      className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold leading-none",
        "bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.38),transparent_34%)]",
        chipStyles[props.tone],
        props.className,
      ].join(" ")}
    >
      {props.index}
    </span>
  );
}

function PlaceholderLines() {
  return (
    <div className="mt-2.5 space-y-1 2xl:mt-3 2xl:space-y-1.5">
      <span className="block h-1.5 w-[84%] rounded-full bg-slate-500/23" />
      <span className="block h-1.5 w-[72%] rounded-full bg-slate-500/18" />
    </div>
  );
}

function WorkflowCard(props: {
  children: ReactNode;
  dataAttribute?: string;
  icon: ComponentType<{ className?: string }>;
  index: number;
  title: string;
  tone: keyof typeof chipStyles;
}) {
  const Icon = props.icon;

  return (
    <motion.div
      className={[
        "relative overflow-hidden rounded-xl border border-white/[0.115] bg-[#081321]/88 p-3 2xl:p-3.5",
        "shadow-[0_18px_56px_rgba(0,0,0,0.33),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(137deg,rgba(255,255,255,0.085),transparent_42%,rgba(14,165,233,0.055))]",
        "after:pointer-events-none after:absolute after:inset-x-5 after:top-0 after:h-px after:bg-white/14",
      ].join(" ")}
      data-card={props.dataAttribute}
      whileHover={{ y: -2 }}
    >
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <NumberChip index={props.index} tone={props.tone} />
            <p className="truncate text-[12.5px] font-semibold tracking-[-0.015em] text-white 2xl:text-[13px]">
              {props.title}
            </p>
          </div>
          <Icon className="h-4.5 w-4.5 shrink-0 text-slate-300/85" />
        </div>
        <div className="mt-2.5 2xl:mt-3">{props.children}</div>
      </div>
    </motion.div>
  );
}

function AnimatedScoreRing(props: {
  label?: string;
  score: number;
  size: "compact" | "hero";
  theme: "blue" | "green";
}) {
  const animatedScore = useAnimatedScore(props.score, props.size === "hero" ? 1550 : 1250);
  const id = useId().replace(/:/g, "");
  const isHero = props.size === "hero";
  const size = isHero ? 136 : 74;
  const center = size / 2;
  const radius = isHero ? 49 : 27;
  const stroke = isHero ? 7 : 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animatedScore / 100);
  const trackColor =
    props.theme === "green" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)";

  return (
    <div className="flex flex-col items-center">
      <svg
        aria-hidden="true"
        className="overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient id={`${id}-gradient`} x1="0" x2={size} y1="0" y2={size}>
            {props.theme === "green" ? (
              <>
                <stop offset="0%" stopColor="#16f2a7" />
                <stop offset="45%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22c55e" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="42%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </>
            )}
          </linearGradient>
          <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur result="blur" stdDeviation={isHero ? "3.4" : "2.2"} />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={center}
          cy={center}
          fill={
            props.theme === "green"
              ? "rgba(4,24,26,0.96)"
              : "rgba(7,13,31,0.96)"
          }
          r={radius + stroke * 1.25}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          filter={`url(#${id}-glow)`}
          r={radius}
          stroke={`url(#${id}-gradient)`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius - stroke * 1.45}
          stroke="rgba(255,255,255,0.045)"
          strokeWidth="1"
        />
        <text
          dominantBaseline="central"
          fill="white"
          fontSize={isHero ? 34 : 18}
          fontWeight="700"
          letterSpacing={isHero ? "-1.4" : "-0.6"}
          textAnchor="middle"
          x={center}
          y={center}
        >
          {animatedScore}%
        </text>
      </svg>

      {props.label ? (
        <p
          className={[
            "mt-2 font-semibold",
            isHero
              ? "bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-[13px] text-transparent"
              : "text-[10px] text-cyan-300",
          ].join(" ")}
        >
          {props.label}
        </p>
      ) : null}
    </div>
  );
}

function WorkflowStack() {
  return (
    <div className="relative z-20 grid gap-2.5 2xl:gap-3">
      <WorkflowCard icon={ClipboardList} index={1} title="Job description" tone="blue">
        <p className="text-[11.5px] font-semibold text-white 2xl:text-[12px]">Senior Product Manager</p>
        <p className="mt-1 text-[10.5px] text-slate-300 2xl:text-[11px]">SaaS · B2B · Remote</p>
        <PlaceholderLines />
      </WorkflowCard>

      <WorkflowCard icon={UserRound} index={2} title="Your background" tone="green">
        <p className="text-[11.5px] font-semibold text-white 2xl:text-[12px]">12+ years experience</p>
        <p className="mt-1 text-[10.5px] text-slate-300 2xl:text-[11px]">Product · Analytics · Strategy</p>
        <PlaceholderLines />
      </WorkflowCard>

      <WorkflowCard
        dataAttribute="current-match"
        icon={Gauge}
        index={3}
        title="Current match"
        tone="purple"
      >
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5 2xl:grid-cols-[78px_minmax(0,1fr)] 2xl:gap-3">
          <AnimatedScoreRing score={55} size="compact" theme="blue" />
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-white">Top strengths</p>
            <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-slate-300">
              <li>Product Strategy</li>
              <li>Data Analysis</li>
              <li>Stakeholder Mgmt</li>
            </ul>
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
              See full breakdown <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </div>
      </WorkflowCard>

      <WorkflowCard icon={Search} index={4} title="Evidence found" tone="cyan">
        <p className="text-[10.5px] leading-[1.42] text-slate-200 2xl:text-[11px] 2xl:leading-[1.45]">
          We found 18 strong evidence points from your background.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 2xl:mt-2.5">
          {["Strategy", "Metrics", "Leadership", "Roadmaps"].map((tag) => (
            <span
              className="rounded-md border border-white/12 bg-white/[0.055] px-1.5 py-0.5 text-[9px] font-medium text-slate-200"
              key={tag}
            >
              {tag}
            </span>
          ))}
          <span className="px-0.5 py-0.5 text-[9px] font-semibold text-cyan-300">
            +14 more
          </span>
        </div>
      </WorkflowCard>

      <WorkflowCard icon={HelpCircle} index={5} title="Gap question" tone="yellow">
        <p className="text-[10.3px] leading-[1.38] text-slate-200 2xl:text-[10.8px] 2xl:leading-[1.45]">
          How much direct experience do you have leading cross-functional teams
          through product launches?
        </p>
        <button
          className="mt-2.5 inline-flex cursor-default items-center gap-1.5 rounded-md border border-amber-200/22 bg-amber-300/12 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] 2xl:mt-3"
          type="button"
        >
          Add your answer <ArrowRight className="h-3 w-3" />
        </button>
      </WorkflowCard>
    </div>
  );
}

function CvSection(props: { children: ReactNode; title: string }) {
  return (
    <section className="border-t border-slate-200 pt-2.5 min-[1900px]:pt-3">
      <h3 className="text-[7.9px] font-bold uppercase tracking-[0.01em] text-blue-700 min-[1900px]:text-[8.8px]">
        {props.title}
      </h3>
      <div className="mt-1.5">{props.children}</div>
    </section>
  );
}

function CvPreview() {
  return (
    <article
      className="relative z-10 aspect-[210/297] overflow-hidden rounded-[18px] bg-white px-6 py-6 text-slate-950 shadow-[0_0_0_1px_rgba(219,234,254,0.92),0_0_58px_rgba(0,174,255,0.36),0_34px_95px_rgba(0,64,180,0.28)] xl:px-7 xl:py-6"
      data-cv-preview="true"
    >
      <div className="absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_72%_2%,rgba(59,130,246,0.12),transparent_28%)]" />
      <div className="relative flex h-full flex-col">
        <header className="flex items-start justify-between gap-5 pb-3.5">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.055em] text-slate-950 min-[1900px]:text-[25px]">
              Alex Morgan
            </h2>
            <p className="mt-0.5 text-[10px] font-bold text-blue-600 min-[1900px]:text-[11.5px]">
              Senior Product Manager
            </p>
            <p className="mt-2 text-[6.9px] text-slate-600 min-[1900px]:text-[7.8px]">
              London, UK &nbsp;&bull;&nbsp; alex.morgan@email.com
              &nbsp;&bull;&nbsp; linkedin.com/in/alexmorgan
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[6.1px] font-bold uppercase text-blue-500 min-[1900px]:text-[6.8px]">
            Tailored for this role <Sparkles className="h-2.5 w-2.5" />
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-between gap-2.5 min-[1900px]:gap-3">
          <CvSection title="Professional Summary">
            <p className="text-[7.7px] leading-[1.45] text-slate-700 min-[1900px]:text-[8.6px]">
              Product leader with 12+ years driving strategy and execution for
              B2B SaaS products. Proven track record of delivering
              customer-centric solutions that accelerate growth, improve
              retention and expand market share.
            </p>
          </CvSection>

          <CvSection title="Key Achievements">
            <div className="space-y-1.5 text-[7.6px] leading-[1.34] text-slate-700 min-[1900px]:space-y-2 min-[1900px]:text-[8.5px] min-[1900px]:leading-[1.35]">
              {[
                "Led cross-functional team to deliver new analytics platform, driving 32% increase in activation and $7.2M ARR within 12 months.",
                "Redesigned pricing and packaging strategy resulting in 18% uplift in conversion and 25% improvement in gross margin.",
                "Established customer insights program that reduced churn by 14% and increased NPS from 32 to 55.",
              ].map((item) => (
                <div
                  className="grid grid-cols-[18px_1fr] gap-2 min-[1900px]:grid-cols-[21px_1fr] min-[1900px]:gap-2.5"
                  key={item}
                >
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-50 text-blue-600 min-[1900px]:h-[21px] min-[1900px]:w-[21px]">
                    <BriefcaseBusiness className="h-2.5 w-2.5 min-[1900px]:h-3 min-[1900px]:w-3" />
                  </span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </CvSection>

          <CvSection title="Experience">
            <div className="space-y-2 text-[7.6px] leading-[1.34] text-slate-700 min-[1900px]:space-y-2.5 min-[1900px]:text-[8.5px]">
              <div>
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">
                      Senior Product Manager
                    </p>
                    <p className="font-semibold">DataFlow (B2B SaaS)</p>
                  </div>
                  <p className="text-right text-[6.8px] text-slate-600 min-[1900px]:text-[7.8px]">
                    2021 - Present
                    <br />
                    London, UK
                  </p>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-3 min-[1900px]:pl-3.5">
                  <li>
                    Own product strategy and roadmap for analytics suite serving
                    10k+ customers.
                  </li>
                  <li>
                    Partner with engineering, design and go-to-market to deliver
                    impactful solutions.
                  </li>
                  <li>
                    Delivered 6 major releases improving activation, retention
                    and revenue.
                  </li>
                </ul>
              </div>
              <div>
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">Product Manager</p>
                    <p className="font-semibold">Insightly</p>
                  </div>
                  <p className="text-right text-[6.8px] text-slate-600 min-[1900px]:text-[7.8px]">
                    2017 - 2021
                    <br />
                    London, UK
                  </p>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-3 min-[1900px]:pl-3.5">
                  <li>
                    Led discovery and delivery for core platform features used
                    by 50k+ users.
                  </li>
                  <li>
                    Improved onboarding experience resulting in 27% increase in
                    trial conversion.
                  </li>
                  <li>
                    Built reporting dashboards that increased operational
                    efficiency by 20%.
                  </li>
                </ul>
              </div>
            </div>
          </CvSection>

          <CvSection title="Education">
            <div className="space-y-1.5 text-[7.6px] leading-[1.32] text-slate-700 min-[1900px]:space-y-2 min-[1900px]:text-[8.5px]">
              <div className="flex justify-between gap-4">
                <p>
                  <span className="font-bold text-slate-950">
                    MSc Management
                  </span>
                  <br />
                  London Business School
                </p>
                <p className="text-right text-[6.8px] text-slate-600 min-[1900px]:text-[7.8px]">
                  Distinction
                  <br />
                  2011 - 2012
                </p>
              </div>
              <div className="flex justify-between gap-4">
                <p>
                  <span className="font-bold text-slate-950">
                    BSc Business Information Systems
                  </span>
                  <br />
                  University of Manchester
                </p>
                <p className="text-right text-[6.8px] text-slate-600 min-[1900px]:text-[7.8px]">
                  First Class
                  <br />
                  2007 - 2010
                </p>
              </div>
            </div>
          </CvSection>
        </div>
      </div>
    </article>
  );
}

function ImprovedMatchCard() {
  return (
    <aside
      className="relative z-20 overflow-hidden rounded-[20px] border border-emerald-300/22 bg-[#061a21]/90 p-4 shadow-[0_28px_85px_rgba(0,0,0,0.43),0_0_62px_rgba(16,185,129,0.13),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl xl:mt-[122px] 2xl:mt-[132px] 2xl:p-5"
      data-improved-match-card="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(16,185,129,0.18),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.09),transparent_38%,rgba(16,185,129,0.085))]" />
      <div className="absolute inset-x-6 top-0 h-px bg-emerald-200/18" />
      <div className="relative">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <NumberChip index={6} tone="green" />
            <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-white">
              Improved match
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/18 bg-emerald-300/10 text-emerald-300">
            <TrendingUp className="h-4.5 w-4.5" />
          </span>
        </div>

        <div className="pt-2 pb-0.5 2xl:pt-3 2xl:pb-1">
          <AnimatedScoreRing label="Excellent match" score={97} size="hero" theme="green" />
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 2xl:mt-5 2xl:pt-5">
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-white">
            What improved
          </p>
          <ul className="mt-3 space-y-2.5 2xl:mt-3.5 2xl:space-y-3">
            {checklist.map((item) => (
              <li
                className="flex items-center gap-2.5 text-[11.5px] leading-none text-slate-300"
                key={item}
              >
                <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-[#062018] shadow-[0_0_16px_rgba(52,211,153,0.28)]">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <button
          className="mt-5 inline-flex min-h-10 w-full cursor-default items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.075] px-3 text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-6 2xl:min-h-11"
          type="button"
        >
          View full breakdown <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function ConnectorLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block"
      preserveAspectRatio="none"
      viewBox="0 0 1000 700"
    >
      <defs>
        <linearGradient id="connectorBlue" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(34,211,238,0.25)" />
          <stop offset="48%" stopColor="rgba(56,189,248,0.98)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.34)" />
        </linearGradient>
        <filter id="connectorGlow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur result="blur" stdDeviation="2.2" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[
        "M252 70 H292 C314 70 309 100 333 100",
        "M252 175 H292 C314 175 309 194 333 194",
        "M252 292 H333",
        "M252 425 H292 C314 425 309 384 333 384",
        "M252 556 H292 C314 556 309 495 333 495",
        "M714 340 H790",
      ].map((path) => (
        <g key={path}>
          <path
            d={path}
            fill="none"
            stroke="rgba(14,165,233,0.16)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d={path}
            fill="none"
            filter="url(#connectorGlow)"
            stroke="url(#connectorBlue)"
            strokeLinecap="round"
            strokeWidth="2.35"
          />
        </g>
      ))}
    </svg>
  );
}

export function LandingArtifact() {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-[1220px]"
      data-landing-artifact="true"
      initial="hidden"
      transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      variants={fadeUp}
      viewport={{ once: true }}
      whileInView="visible"
    >
      <div className="pointer-events-none absolute inset-y-4 left-[22%] hidden w-[68%] rounded-[56px] bg-[radial-gradient(circle_at_48%_48%,rgba(0,209,255,0.18),transparent_52%)] blur-3xl xl:block" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(210px,0.68fr)_minmax(370px,1.18fr)_minmax(210px,0.7fr)] xl:items-start xl:gap-[clamp(16px,1.65vw,34px)] 2xl:grid-cols-[minmax(230px,0.72fr)_minmax(410px,1.22fr)_minmax(230px,0.74fr)]">
        <ConnectorLines />
        <WorkflowStack />
        <CvPreview />
        <ImprovedMatchCard />
      </div>
    </motion.div>
  );
}
