import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

type TimingMeta = Record<string, string | number | boolean | null | undefined>;
type TimingEntry = {
  stage: string;
  durationMs: number;
  status: "success" | "error";
};

const timingContext = new AsyncLocalStorage<{
  applicationId: string;
  flow: string;
  entries: TimingEntry[];
}>();

function logTimingEvent(args: {
  applicationId?: string | null;
  stage: string;
  durationMs: number;
  status: "success" | "error";
  meta?: TimingMeta;
}) {
  console.info("TAYLOR_TIMING", {
    applicationId: args.applicationId ?? null,
    stage: args.stage,
    durationMs: Math.round(args.durationMs),
    status: args.status,
    ...(args.meta ?? {}),
  });
}

function recordTiming(entry: TimingEntry) {
  timingContext.getStore()?.entries.push(entry);
}

export async function timedStep<T>(
  label: string,
  fn: () => Promise<T>,
  meta: TimingMeta = {}
) {
  const startedAt = performance.now();
  const context = timingContext.getStore();
  const applicationId =
    typeof meta.applicationId === "string" ? meta.applicationId : context?.applicationId;
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startedAt);
    recordTiming({ stage: label, durationMs, status: "success" });
    logTimingEvent({ applicationId, stage: label, durationMs, status: "success", meta });
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    recordTiming({ stage: label, durationMs, status: "error" });
    console.warn("TAYLOR_TIMING", {
      applicationId: applicationId ?? null,
      stage: label,
      durationMs,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    });
    throw error;
  }
}

export function logTiming(label: string, durationMs: number, meta: TimingMeta = {}) {
  const context = timingContext.getStore();
  const applicationId =
    typeof meta.applicationId === "string" ? meta.applicationId : context?.applicationId;
  const roundedDurationMs = Math.round(durationMs);
  recordTiming({ stage: label, durationMs: roundedDurationMs, status: "success" });
  logTimingEvent({
    applicationId,
    stage: label,
    durationMs: roundedDurationMs,
    status: "success",
    meta,
  });
}

export async function runWithTimingSummary<T>(args: {
  applicationId: string;
  flow: string;
  totalStage: string;
  fn: () => Promise<T>;
}) {
  const entries: TimingEntry[] = [];
  const startedAt = performance.now();
  return timingContext.run(
    { applicationId: args.applicationId, flow: args.flow, entries },
    async () => {
      try {
        const result = await args.fn();
        const totalDurationMs = Math.round(performance.now() - startedAt);
        recordTiming({
          stage: args.totalStage,
          durationMs: totalDurationMs,
          status: "success",
        });
        console.info("TAYLOR_TIMING", {
          applicationId: args.applicationId,
          stage: args.totalStage,
          durationMs: totalDurationMs,
          status: "success",
          flow: args.flow,
        });
        console.info("TAYLOR_TIMING", {
          applicationId: args.applicationId,
          stage: `${args.flow} summary`,
          flow: args.flow,
          totalDurationMs,
          timings: entries,
        });
        return result;
      } catch (error) {
        const totalDurationMs = Math.round(performance.now() - startedAt);
        recordTiming({
          stage: args.totalStage,
          durationMs: totalDurationMs,
          status: "error",
        });
        console.warn("TAYLOR_TIMING", {
          applicationId: args.applicationId,
          stage: args.totalStage,
          durationMs: totalDurationMs,
          status: "error",
          flow: args.flow,
          error: error instanceof Error ? error.message : String(error),
        });
        console.info("TAYLOR_TIMING", {
          applicationId: args.applicationId,
          stage: `${args.flow} summary`,
          flow: args.flow,
          totalDurationMs,
          timings: entries,
        });
        throw error;
      }
    }
  );
}
