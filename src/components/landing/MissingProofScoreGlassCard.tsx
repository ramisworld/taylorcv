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
      viewBox="0 0 28 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2.4 12.8L8.2 7.4L12.3 9.7L21.1 2.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.3 2.5H21.5V6.7"
        stroke="currentColor"
        strokeWidth="2"
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
          <linearGradient id={gradientId} x1="7%" y1="0%" x2="90%" y2="100%">
            {gradientStops}
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(232, 237, 255, 0.58)"
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
      <span className={styles.orbCaustic} />

      <svg viewBox="0 0 92 92" fill="none" className={styles.orbSvg}>
        <defs>
          <radialGradient id="match-orb-body" cx="31%" cy="22%" r="78%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.99)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="55%" stopColor="rgba(222,229,255,0.17)" />
            <stop offset="100%" stopColor="rgba(113,99,255,0.22)" />
          </radialGradient>

          <linearGradient id="match-orb-rim" x1="10%" y1="6%" x2="88%" y2="92%">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.44)" />
            <stop offset="100%" stopColor="rgba(108,93,255,0.23)" />
          </linearGradient>
        </defs>

        <circle cx="46" cy="46" r="40" fill="url(#match-orb-body)" />
        <circle
          cx="46"
          cy="46"
          r="40"
          stroke="url(#match-orb-rim)"
          strokeWidth="1.6"
        />
        <path
          d="M34 46H57M48 37.4L56.8 46L48 54.6"
          stroke="#5c4dff"
          strokeWidth="4.1"
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
              size={158}
              strokeWidth={11}
              rotation={-94}
              gradientId="missing-proof-ring-58"
              strokeOpacity={0.82}
              labelClassName={styles.ringLabelWeak}
              gradientStops={
                <>
                  <stop offset="0%" stopColor="#d6ccff" />
                  <stop offset="30%" stopColor="#aa92ff" />
                  <stop offset="66%" stopColor="#7e86ff" />
                  <stop offset="100%" stopColor="#72a2ff" />
                </>
              }
            />
          </div>

          <GlassArrowOrb />

          <div className={styles.ringAfter}>
            <InlineRing
              percent={92}
              size={158}
              strokeWidth={11}
              rotation={-94}
              gradientId="missing-proof-ring-92"
              labelClassName={styles.ringLabelStrong}
              gradientStops={
                <>
                  <stop offset="0%" stopColor="#bf8fff" />
                  <stop offset="27%" stopColor="#8658ff" />
                  <stop offset="61%" stopColor="#4d5fff" />
                  <stop offset="100%" stopColor="#2f6dff" />
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
