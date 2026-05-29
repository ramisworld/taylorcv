"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CVDocumentRenderer } from "~/components/CVDocumentRenderer";
import type { StructuredCv } from "~/lib/cvDocument";
import { buildCvRenderModel } from "~/lib/cvRenderModel";

export function A4CvPreview(props: {
  cv: StructuredCv;
  presentationJson?: unknown;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.72);
  const model = useMemo(
    () => buildCvRenderModel(props.cv, props.presentationJson),
    [props.cv, props.presentationJson]
  );

  useEffect(() => {
    console.info("CV_RENDER_METRICS", {
      renderTarget: "client_preview",
      ...model.metrics,
    });
  }, [model.metrics]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = () => {
      const rect = frame.getBoundingClientRect();
      const widthScale = Math.max(0.28, Math.min(1, (rect.width - 2) / 794));
      const heightScale = Math.max(0.28, Math.min(1, (window.innerHeight - 176) / 1123));
      setScale(Math.min(widthScale, heightScale));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={props.className} ref={frameRef}>
      <div
        className="mx-auto"
        style={{
          height: 1123 * scale,
          width: 794 * scale,
        }}
      >
        <div
          style={{
            height: 1123,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: 794,
          }}
        >
          <CVDocumentRenderer
            className="!m-0"
            cv={props.cv}
            presentationJson={props.presentationJson}
          />
        </div>
      </div>
    </div>
  );
}
