"use client";

export function LandingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#fcfdff]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_9%_8%,rgba(203,229,255,0.62),transparent_34%),radial-gradient(ellipse_at_92%_31%,rgba(242,213,233,0.54),transparent_32%),radial-gradient(ellipse_at_50%_24%,rgba(255,255,255,0.98),rgba(255,255,255,0.72)_35%,transparent_58%),radial-gradient(ellipse_at_48%_96%,rgba(205,225,252,0.34),transparent_38%)]" />
      <div className="absolute inset-x-0 top-[88px] h-[420px] bg-[radial-gradient(ellipse_at_50%_18%,rgba(255,255,255,0.96),rgba(255,255,255,0.74)_38%,transparent_72%)]" />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 980"
      >
        <defs>
          <linearGradient id="tcBgArcBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="28%" stopColor="rgba(255,255,255,0.88)" />
            <stop offset="54%" stopColor="rgba(178,212,255,0.36)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="tcBgArcRight" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="24%" stopColor="rgba(255,255,255,0.82)" />
            <stop offset="52%" stopColor="rgba(147,190,252,0.38)" />
            <stop offset="78%" stopColor="rgba(255,255,255,0.66)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id="tcBgBubbleFill" cx="50%" cy="34%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.38)" />
            <stop offset="58%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="tcBgSoftBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <filter id="tcBgReflectionBlur" x="-25%" y="-60%" width="150%" height="220%">
            <feGaussianBlur stdDeviation="4.8" />
          </filter>
          <mask id="tcTopLeftArcMask">
            <rect width="1440" height="980" fill="black" />
            <radialGradient id="tcTopLeftArcMaskGradient" cx="8%" cy="5%" r="48%">
              <stop offset="0%" stopColor="white" stopOpacity="0.95" />
              <stop offset="45%" stopColor="white" stopOpacity="0.72" />
              <stop offset="72%" stopColor="white" stopOpacity="0.16" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <rect width="720" height="430" fill="url(#tcTopLeftArcMaskGradient)" />
          </mask>
          <mask id="tcRightBubbleMask">
            <rect width="1440" height="980" fill="black" />
            <ellipse cx="1339" cy="314" fill="white" rx="490" ry="452" />
          </mask>
          <clipPath id="tcRightBubbleClip">
            <rect x="1060" y="0" width="380" height="760" />
          </clipPath>
        </defs>

        <g mask="url(#tcTopLeftArcMask)">
          <ellipse
            cx="-115"
            cy="-176"
            fill="none"
            rx="605"
            ry="548"
            stroke="url(#tcBgArcBlue)"
            strokeWidth="1.25"
          />
          <ellipse
            cx="-102"
            cy="-168"
            fill="none"
            filter="url(#tcBgSoftBlur)"
            opacity="0.42"
            rx="618"
            ry="560"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="5"
          />
        </g>

        <g clipPath="url(#tcRightBubbleClip)" mask="url(#tcRightBubbleMask)">
          <ellipse
            cx="1324"
            cy="314"
            fill="url(#tcBgBubbleFill)"
            opacity="0.58"
            rx="490"
            ry="452"
          />
          <ellipse
            cx="1324"
            cy="314"
            fill="none"
            rx="490"
            ry="452"
            stroke="url(#tcBgArcRight)"
            strokeWidth="1.45"
          />
          <ellipse
            cx="1332"
            cy="306"
            fill="none"
            filter="url(#tcBgSoftBlur)"
            opacity="0.34"
            rx="505"
            ry="468"
            stroke="rgba(255,255,255,0.82)"
            strokeWidth="6"
          />
        </g>

        <g clipPath="url(#tcRightBubbleClip)">
          <ellipse
            cx="1324"
            cy="314"
            fill="none"
            opacity="0.28"
            rx="490"
            ry="452"
            stroke="rgba(116,165,242,0.38)"
            strokeWidth="1"
          />
        </g>
      </svg>

      <div className="absolute right-[-14%] bottom-[-20%] h-[520px] w-[620px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.36),rgba(210,226,252,0.16)_48%,transparent_72%)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(252,253,255,0.7)_58%,#fcfdff_100%)]" />
    </div>
  );
}
