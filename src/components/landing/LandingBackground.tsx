"use client";

import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const vertex = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
      + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rot = mat2(1.56, 1.04, -1.04, 1.56);
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p);
      p = rot * p + vec2(0.19, -0.11);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv - 0.5;
    p.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.055;
    float breath = 0.5 + 0.5 * sin(uTime * 0.62);
    vec2 pointer = (uPointer - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float pointerFalloff = exp(-length(p - pointer) * 2.7);
    vec2 drift = normalize(p - pointer + vec2(0.001)) * pointerFalloff * 0.052;

    vec2 warp = p;
    warp += drift;
    warp += vec2(
      fbm(p * 1.25 + vec2(t * 0.9, -t * 0.6)),
      fbm(p * 1.45 + vec2(-t * 0.5, t * 0.8))
    ) * 0.22;

    float fieldA = fbm(warp * 2.1 + vec2(t * 0.8, -t * 0.35));
    float fieldB = fbm((warp + fieldA * 0.18) * 3.2 - vec2(t * 0.45, t * 0.55));
    float wave = sin((warp.x * 3.0 - warp.y * 2.2 + fieldA * 1.55) + uTime * 0.17);
    float silk = smoothstep(-0.42, 0.78, fieldA + fieldB * 0.34 + wave * 0.26);

    float vignette = smoothstep(0.92, 0.16, length(p));
    float topLight = smoothstep(0.78, -0.12, uv.y);
    float leftCavity = 1.0 - smoothstep(0.02, 0.82, length(p - vec2(-0.72, -0.02)));
    float rightGlow = 1.0 - smoothstep(0.08, 1.05, length(p - vec2(0.38, 0.06)));

    vec3 graphite = vec3(0.015, 0.018, 0.026);
    vec3 navy = vec3(0.018, 0.055, 0.105);
    vec3 deepTeal = vec3(0.000, 0.270, 0.340);
    vec3 cyan = vec3(0.000, 0.900, 1.000);
    vec3 electric = vec3(0.060, 0.320, 1.000);
    vec3 warm = vec3(0.950, 0.650, 0.320);

    vec3 color = mix(graphite, navy, topLight * 0.55 + silk * 0.22);
    color += deepTeal * silk * 0.18 * vignette;
    color += cyan * pow(max(silk, 0.0), 2.7) * 0.22 * vignette;
    color += electric * rightGlow * (0.09 + breath * 0.06);
    color += cyan * pointerFalloff * 0.13;
    color += warm * smoothstep(0.80, 1.0, fieldB + wave * 0.12) * 0.055 * vignette;
    color -= leftCavity * vec3(0.012, 0.020, 0.028);
    color *= 0.66 + vignette * 0.58;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function LandingBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || shouldReduceMotion) return;

    let renderer: Renderer;
    let frameId = 0;
    let disposed = false;

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        autoClear: true,
        depth: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        powerPreference: "high-performance",
        stencil: false,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "h-full w-full";
    root.appendChild(canvas);

    const uniforms = {
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
      uPointer: { value: [0.64, 0.48] },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      cullFace: null,
      depthTest: false,
      depthWrite: false,
      fragment,
      uniforms,
      vertex,
    });
    const mesh = new Mesh(gl, { geometry, program });
    const pointer = { x: 0.64, y: 0.48 };
    const smoothedPointer = { x: pointer.x, y: pointer.y };

    function resize() {
      if (!root) return;
      const width = Math.max(root.clientWidth, 1);
      const height = Math.max(root.clientHeight, 1);
      renderer.setSize(width, height);
      uniforms.uResolution.value = [
        width * renderer.dpr,
        height * renderer.dpr,
      ];
    }

    function onPointerMove(event: PointerEvent) {
      pointer.x = event.clientX / Math.max(window.innerWidth, 1);
      pointer.y = 1 - event.clientY / Math.max(window.innerHeight, 1);
    }

    function render(time: number) {
      if (disposed) return;
      smoothedPointer.x += (pointer.x - smoothedPointer.x) * 0.035;
      smoothedPointer.y += (pointer.y - smoothedPointer.y) * 0.035;
      uniforms.uTime.value = time * 0.001;
      uniforms.uPointer.value = [smoothedPointer.x, smoothedPointer.y];
      renderer.render({ scene: mesh, clear: true });
      frameId = window.requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    setWebglReady(true);
    frameId = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      program.remove();
      geometry.remove();
      canvas.remove();
    };
  }, [shouldReduceMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="taylor-landing-fallback absolute inset-0" />
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100"
        data-ready={webglReady}
        ref={rootRef}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_18%,rgba(255,255,255,0.12),transparent_20%),radial-gradient(circle_at_78%_42%,rgba(0,240,255,0.12),transparent_30%),linear-gradient(90deg,rgba(3,7,18,0.20),transparent_42%,rgba(3,7,18,0.30))]" />
      <div className="taylor-landing-contours absolute inset-0 opacity-[0.18]" />
      <div className="taylor-landing-grain absolute inset-0 opacity-[0.12]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,13,0.04)_0%,rgba(5,7,13,0.18)_58%,#05070d_100%)]" />
    </div>
  );
}
