import "server-only";

type TimingMeta = Record<string, string | number | boolean | null | undefined>;

export async function timedStep<T>(
  label: string,
  fn: () => Promise<T>,
  meta: TimingMeta = {}
) {
  const startedAt = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startedAt);
    console.info("taylor_timing", {
      step: label,
      durationMs,
      status: "success",
      ...meta,
    });
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    console.warn("taylor_timing", {
      step: label,
      durationMs,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    });
    throw error;
  }
}

export function logTiming(label: string, durationMs: number, meta: TimingMeta = {}) {
  console.info("taylor_timing", {
    step: label,
    durationMs: Math.round(durationMs),
    status: "success",
    ...meta,
  });
}
