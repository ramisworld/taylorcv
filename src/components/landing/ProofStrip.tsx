"use client";

import { FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "~/lib/utils";

type LiveCounterState = {
  value: number;
  history: number[];
  lastUpdatedAt: number;
  anchor: number;
};

const proofLogos = [
  {
    name: "Microsoft",
    src: "/assets/company-logos/microsoft-wordmark.svg",
    className: "h-[23px] w-[112px] translate-y-[1px]",
  },
  {
    name: "Deloitte",
    src: "/assets/company-logos/deloitte.svg",
    className: "h-[23px] w-[112px] translate-y-[1px]",
  },
  {
    name: "Stripe",
    src: "/assets/company-logos/stripe-wordmark.svg",
    className: "h-[27px] w-[82px] translate-y-[1px]",
  },
  {
    name: "Amazon",
    src: "/assets/company-logos/amazon.svg",
    className: "h-[30px] w-[98px] translate-y-[5px]",
  },
  {
    name: "PwC",
    src: "/assets/company-logos/pwc.svg",
    className: "h-[38px] w-[64px] -translate-y-[2px]",
  },
] as const;

const liveCounterStorageKey = "taylorcv_live_counter_state_v2";
const liveCounterMin = 900;
const liveCounterMax = 3100;
const liveCounterAnchorMin = 1900;
const liveCounterAnchorMax = 2400;
const liveCounterSoftUpper = 2700;
const liveCounterSoftLower = 1300;
const liveCounterForceNegative = 2900;
const liveCounterForcePositive = 1100;
const liveCounterHistoryLength = 22;

function formatCount(value: number) {
  return new Intl.NumberFormat("en-NZ").format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function createNextDelay() {
  return randomInt(7_000, 18_000);
}

function createDelta(value: number, anchor: number) {
  let noise: number;
  const roll = Math.random();
  if (roll < 0.7) {
    noise = randomInt(-4, 4);
  } else if (roll < 0.95) {
    noise = randomInt(-8, 8);
  } else {
    noise = randomInt(-12, 12);
  }

  const reversion = -(value - anchor) * 0.035;
  let delta = Math.round(reversion + noise);

  delta = clamp(delta, -12, 12);

  if (value >= liveCounterForceNegative) {
    delta = Math.min(0, delta);
  } else if (value >= liveCounterSoftUpper && delta > 0) {
    delta = Math.max(0, delta - 4);
  }
  if (value <= liveCounterForcePositive) {
    delta = Math.max(0, delta);
  } else if (value <= liveCounterSoftLower && delta < 0) {
    delta = Math.min(0, delta + 4);
  }

  return delta;
}

function safeCounterValue(value: number) {
  return clamp(Math.round(value), liveCounterMin, liveCounterMax);
}

function buildInitialCounterState(): LiveCounterState {
  const anchor = randomInt(liveCounterAnchorMin, liveCounterAnchorMax);
  let value = randomInt(anchor - 120, anchor + 120);
  const historyCount = randomInt(20, 24);
  const history: number[] = [];
  for (let index = 0; index < historyCount; index += 1) {
    value = safeCounterValue(value + randomInt(-4, 4));
    history.push(value);
  }
  return {
    value,
    history,
    lastUpdatedAt: Date.now(),
    anchor,
  };
}

function isLiveCounterState(value: unknown): value is LiveCounterState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<LiveCounterState>;
  const counterValue = state.value;
  const lastUpdatedAt = state.lastUpdatedAt;
  const history = state.history;
  const anchor = state.anchor;
  return (
    typeof counterValue === "number" &&
    Number.isFinite(counterValue) &&
    Number.isInteger(counterValue) &&
    counterValue >= liveCounterMin &&
    counterValue <= liveCounterMax &&
    typeof lastUpdatedAt === "number" &&
    Number.isFinite(lastUpdatedAt) &&
    lastUpdatedAt > 0 &&
    typeof anchor === "number" &&
    Number.isFinite(anchor) &&
    Number.isInteger(anchor) &&
    anchor >= liveCounterAnchorMin &&
    anchor <= liveCounterAnchorMax &&
    Array.isArray(history) &&
    history.length >= 18 &&
    history.length <= 24 &&
    history.every(
      (point) =>
        Number.isInteger(point) &&
        point >= liveCounterMin &&
        point <= liveCounterMax
    )
  );
}

function readLiveCounterState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(liveCounterStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isLiveCounterState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistLiveCounterState(state: LiveCounterState) {
  try {
    const persisted = {
      value: state.value,
      history: state.history,
      lastUpdatedAt: state.lastUpdatedAt,
      anchor: state.anchor,
    };
    window.localStorage.setItem(liveCounterStorageKey, JSON.stringify(persisted));
  } catch {
    // The live proof stat should keep working even when storage is unavailable.
  }
}

function advanceCounterState(state: LiveCounterState, updates = 1): LiveCounterState {
  let value = state.value;
  let history = state.history.slice(-liveCounterHistoryLength);
  for (let index = 0; index < updates; index += 1) {
    value = safeCounterValue(value + createDelta(value, state.anchor));
    history = [...history, value].slice(-liveCounterHistoryLength);
  }
  return {
    value,
    history,
    lastUpdatedAt: Date.now(),
    anchor: state.anchor,
  };
}

function normalizeStoredCounterState(state: LiveCounterState) {
  const elapsed = Math.max(0, Date.now() - state.lastUpdatedAt);
  const simulatedUpdates = clamp(Math.floor(elapsed / 12_000), 0, 5);
  if (simulatedUpdates < 1) {
    return {
      value: safeCounterValue(state.value),
      history: state.history.slice(-liveCounterHistoryLength).map(safeCounterValue),
      lastUpdatedAt: state.lastUpdatedAt,
      anchor: state.anchor,
    };
  }
  return advanceCounterState(state, simulatedUpdates);
}

function Sparkline(props: { history: number[] }) {
  const points = props.history;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = 3 + (index / Math.max(1, points.length - 1)) * 82;
    const y = 38 - ((point - min) / range) * 31;
    return { x, y };
  });
  const path = coordinates
    .map((point, index) => {
      if (index === 0) return `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      const previous = coordinates[index - 1] ?? point;
      const controlX = previous.x + (point.x - previous.x) * 0.5;
      return `C${controlX.toFixed(2)} ${previous.y.toFixed(2)} ${controlX.toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg aria-label="CV activity trend" className="h-12 w-[86px] shrink-0 overflow-visible" viewBox="0 0 90 48">
      <path
        d={path}
        fill="none"
        opacity="0.18"
        stroke="#1c4bf1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d={path}
        fill="none"
        stroke="#2450f4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function LiveProofStat() {
  const [state, setState] = useState<LiveCounterState | null>(null);

  useEffect(() => {
    const stored = readLiveCounterState();
    const initial = stored ? normalizeStoredCounterState(stored) : buildInitialCounterState();
    persistLiveCounterState(initial);
    setState(initial);
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => {
        const next = advanceCounterState(current ?? buildInitialCounterState());
        persistLiveCounterState(next);
        return next;
      });
    }, createNextDelay());
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div className="flex min-h-[104px] items-center gap-3.5 px-7 max-lg:border-b max-md:px-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[#263252]">
          <span className="relative grid h-2.5 w-2.5 place-items-center">
            <span className="absolute h-4 w-4 animate-ping rounded-full bg-[#10b981]/18" />
            <span className="relative h-2 w-2 rounded-full bg-[#08b86f] shadow-[0_0_0_4px_rgba(8,184,111,0.12),0_0_11px_rgba(8,184,111,0.48)]" />
          </span>
          Live now
        </p>
        <div className="mt-2 flex items-end gap-3">
          {state ? (
            <span className="min-w-[96px] tabular-nums text-[31px] font-semibold leading-[1.04] tracking-[-0.018em] text-[#080d22]">
              {formatCount(state.value)}
            </span>
          ) : (
            <span className="block h-8 min-w-[96px] rounded-[8px] bg-[#e9eef8]" />
          )}
          <span className="min-w-[78px] pb-0.5 text-[13px] leading-4 text-[#33405f]">
            CVs built in
            <br />
            the last hour
          </span>
        </div>
      </div>
      {state ? (
        <Sparkline history={state.history} />
      ) : (
        <span className="h-12 w-[86px] rounded-[8px] bg-[#eef3ff]" />
      )}
    </div>
  );
}

function StarRating() {
  return (
    <span className="flex items-center gap-[2px] pb-[3px] text-[#08a968]">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg aria-hidden="true" className="h-[16px] w-[16px] fill-current" key={index} viewBox="0 0 20 20">
          <path d="m10 1.9 2.18 4.78 5.2.61-3.86 3.56 1.03 5.15L10 13.42 5.45 16l1.03-5.15-3.86-3.56 5.2-.61L10 1.9Z" />
        </svg>
      ))}
    </span>
  );
}

function InsetDivider(props: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute right-0 top-[18px] bottom-[18px] w-px bg-[#cfd8e8]/82", props.className)}
    />
  );
}

export function ProofStrip() {
  return (
    <section className="mx-auto mt-6 grid w-[calc(100%-96px)] max-w-[1450px] grid-cols-[330px_275px_minmax(0,1fr)_170px] items-center overflow-hidden rounded-[15px] border border-[#dfe5ef]/90 bg-white/78 shadow-[0_18px_48px_rgba(29,42,78,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl max-xl:grid-cols-2 max-xl:gap-y-4 max-md:w-[calc(100%-32px)] max-md:grid-cols-1">
      <div className="relative">
        <LiveProofStat />
        <InsetDivider className="max-lg:hidden" />
      </div>
      <div className="relative flex min-h-[104px] items-center gap-4 px-8 max-lg:border-b max-md:px-5">
        <div>
          <p className="text-[13px] font-medium text-[#33405f]">Beta feedback</p>
          <div className="mt-2 flex items-end gap-2.5">
            <span className="tabular-nums text-[31px] font-semibold leading-[1.04] tracking-[-0.018em] text-[#080d22]">
              4.9<span className="ml-0.5 text-[16px] font-medium tracking-[-0.005em] text-[#2f3d5d]">/5</span>
            </span>
            <StarRating />
          </div>
          <p className="mt-1 text-[12px] text-[#42506d]">from 327 beta testers</p>
        </div>
        <InsetDivider className="max-lg:hidden" />
      </div>
      <div className="relative flex min-h-[104px] flex-col items-center justify-center gap-3 px-6 max-md:items-start max-md:border-b max-md:px-5">
        <p className="whitespace-nowrap text-[13px] font-medium text-[#33405f]">
          Trusted by professionals at
        </p>
        <div className="flex min-w-0 flex-nowrap items-center justify-center gap-x-5 max-md:flex-wrap max-md:justify-start max-md:gap-y-3">
          {proofLogos.map((logo) => (
            <img
              alt={logo.name}
              className={cn("shrink-0 object-contain", logo.className)}
              key={logo.name}
              src={logo.src}
            />
          ))}
        </div>
        <InsetDivider className="max-lg:hidden" />
      </div>
      <div className="grid min-w-0 gap-4 px-6 max-md:px-5 max-md:py-5">
        <p className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-semibold text-[#080d22]">
          <FileText className="h-[19px] w-[19px] text-[#2047f0]" strokeWidth={1.8} />
          One-page CVs
        </p>
        <p className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-semibold text-[#080d22]">
          <ShieldCheck className="h-[19px] w-[19px] text-[#2047f0]" strokeWidth={1.8} />
          ATS-safe
        </p>
      </div>
    </section>
  );
}
