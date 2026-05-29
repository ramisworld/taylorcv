// src/components/landing/MissingProofScoreGlassCard.tsx

"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/lib/utils";
import styles from "./missing-proof-score-glass-card.module.css";

interface MissingProofScoreGlassCardProps {
  className?: string;
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 26 15"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2.2 12.1L7.7 7.1L11.4 9.1L19.6 2.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1 2.5H19.9V6.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InlineRing({
  percent,
  size,
  strokeWidth,
  rotation,
  gradientId,
  gradientStops,
  strokeOpacity = 1,
  labelClassName,
}: {
  percent: number;
  size: number;
  strokeWidth: number;
  rotation: number;
  gradientId: string;
  gradientStops: ReactNode;
  strokeOpacity?: number;
  labelClassName?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div
      className={styles.ringWrap}
      style={{ "--ring-size": `${size}px` } as CSSProperties}
    >
      <svg
        className={styles.ringSvg}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
      >
        <defs>
          <linearGradient id={gradientId} x1="12%" y1="0%" x2="88%" y2="100%">
            {gradientStops}
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(221, 227, 248, 0.44)"
          strokeWidth={strokeWidth}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          opacity={strokeOpacity}
        />
      </svg>

      <div className={cn(styles.ringLabel, labelClassName)}>
        <span className={styles.ringValue}>{percent}%</span>
      </div>
    </div>
  );
}

function GlassArrowOrb() {
  return (
    <div className={styles.glassOrb} aria-hidden="true">
      <span className={styles.orbGlow} />
      <span className={styles.orbHighlight} />

      <svg viewBox="0 0 88 88" fill="none" className={styles.orbSvg}>
        <defs>
          <radialGradient id="match-orb-body" cx="32%" cy="24%" r="76%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.96)" />
            <stop offset="23%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="62%" stopColor="rgba(214,224,255,0.17)" />
            <stop offset="100%" stopColor="rgba(115,100,255,0.25)" />
          </radialGradient>

          <linearGradient id="match-orb-rim" x1="12%" y1="6%" x2="88%" y2="92%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
            <stop offset="44%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(108,93,255,0.24)" />
          </linearGradient>
        </defs>

        <circle cx="44" cy="44" r="39" fill="url(#match-orb-body)" />
        <circle
          cx="44"
          cy="44"
          r="39"
          stroke="url(#match-orb-rim)"
          strokeWidth="1.5"
        />
        <path
          d="M32.5 44H54.5M46.5 35.5L55 44L46.5 52.5"
          stroke="#5c4dff"
          strokeWidth="4.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function MissingProofScoreGlassCard({
  className,
}: MissingProofScoreGlassCardProps) {
  return (
    <div className={cn(styles.scoreRoot, className)}>
      <div className={styles.scoreGlass}>
        <span className={styles.scoreRim} aria-hidden="true" />
        <span className={styles.scoreInnerRim} aria-hidden="true" />
        <span className={styles.scoreTopHighlight} aria-hidden="true" />
        <span className={styles.scoreBottomHighlight} aria-hidden="true" />
        <span className={styles.scoreCausticOne} aria-hidden="true" />
        <span className={styles.scoreCausticTwo} aria-hidden="true" />
        <span className={styles.scorePrism} aria-hidden="true" />
        <span className={styles.scoreDots} aria-hidden="true" />

        <div className={styles.scoreContent}>
          <div className={styles.metaBefore}>
            <span className={styles.badge}>Before</span>
            <span className={styles.metaLabel}>Initial match</span>
          </div>

          <div className={styles.ringBefore}>
            <InlineRing
              percent={58}
              size={148}
              strokeWidth={10}
              rotation={-90}
              gradientId="missing-proof-ring-58"
              strokeOpacity={0.82}
              labelClassName={styles.ringLabelWeak}
              gradientStops={
                <>
                  <stop offset="0%" stopColor="#c6b8ff" />
                  <stop offset="32%" stopColor="#9c8fff" />
                  <stop offset="68%" stopColor="#7e82ff" />
                  <stop offset="100%" stopColor="#6e99ff" />
                </>
              }
            />
          </div>

          <GlassArrowOrb />

          <div className={styles.ringAfter}>
            <InlineRing
              percent={92}
              size={148}
              strokeWidth={10}
              rotation={-90}
              gradientId="missing-proof-ring-92"
              labelClassName={styles.ringLabelStrong}
              gradientStops={
                <>
                  <stop offset="0%" stopColor="#bd8cff" />
                  <stop offset="28%" stopColor="#8254ff" />
                  <stop offset="62%" stopColor="#4e58ff" />
                  <stop offset="100%" stopColor="#326cff" />
                </>
              }
            />
          </div>

          <div className={styles.metaAfter}>
            <span className={styles.badge}>After</span>
            <h3 className={styles.metaHeadline}>Stronger match</h3>
            <span className={styles.improvementChip}>
              <TrendIcon className={styles.trendIcon} />
              <span>+34 point improvement</span>
            </span>
            <span className={styles.metaSupport}>
              Clearer evidence. Better alignment.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
