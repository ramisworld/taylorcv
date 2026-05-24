export function LiquidGlassDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0" focusable="false">
      <defs>
        <filter
          id="tc-glass-soft"
          x="-12%"
          y="-40%"
          width="124%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" result="softBlur" stdDeviation="0.35" />
          <feColorMatrix
            in="softBlur"
            result="saturated"
            type="matrix"
            values="1.04 0 0 0 0  0 1.05 0 0 0  0 0 1.08 0 0  0 0 0 1 0"
          />
          <feTurbulence
            baseFrequency="0.008 0.016"
            numOctaves="1"
            result="softNoise"
            seed="12"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="saturated"
            in2="softNoise"
            scale="2.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter
          id="tc-glass-button"
          x="-18%"
          y="-70%"
          width="136%"
          height="240%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" result="buttonBlur" stdDeviation="0.22" />
          <feTurbulence
            baseFrequency="0.012 0.024"
            numOctaves="1"
            result="buttonNoise"
            seed="18"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="buttonBlur"
            in2="buttonNoise"
            result="refracted"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feSpecularLighting
            in="buttonNoise"
            lightingColor="#ffffff"
            result="specular"
            specularConstant="0.18"
            specularExponent="18"
            surfaceScale="1.2"
          >
            <fePointLight x="-120" y="-80" z="180" />
          </feSpecularLighting>
          <feComposite in="specular" in2="refracted" operator="in" result="clippedSpecular" />
          <feMerge>
            <feMergeNode in="refracted" />
            <feMergeNode in="clippedSpecular" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
