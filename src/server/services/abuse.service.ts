import "server-only";

import { createHmac, randomUUID } from "crypto";

import type { AbuseAction, AbuseDecision, Prisma } from "../../../generated/prisma/index.js";

import { env } from "~/env";
import { db } from "~/server/db";

export const deviceCookieName = "taylor_cv_device";

type AbuseContext = {
  headers: Headers;
  resHeaders?: Headers;
  userId?: string | null;
  anonymousSessionId?: string | null;
};

type RateRule = {
  windowMs: number;
  maxByUser?: number;
  maxBySession?: number;
  maxByDevice?: number;
  maxByIp?: number;
};

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

const rateRules: Record<AbuseAction, RateRule> = {
  account_create: { windowMs: hour, maxByDevice: 4, maxByIp: 20 },
  sign_in: { windowMs: 15 * minute, maxByDevice: 12, maxByIp: 30 },
  anonymous_analysis: { windowMs: hour, maxBySession: 12, maxByDevice: 18, maxByIp: 80 },
  free_cv_claim: { windowMs: day, maxByUser: 1, maxByDevice: 2, maxByIp: 12 },
  checkout_create: { windowMs: 15 * minute, maxByUser: 5, maxByDevice: 8, maxByIp: 40 },
  password_reset: { windowMs: hour, maxByDevice: 5, maxByIp: 20 },
  verification_resend: { windowMs: hour, maxByUser: 5, maxByDevice: 8, maxByIp: 30 },
};

function readCookie(cookieHeader: string | null, name: string) {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function hmac(value: string) {
  const secret = env.ABUSE_HASH_SECRET ?? "test-abuse-hash-secret-test-abuse-hash-secret";
  return createHmac("sha256", secret).update(value).digest("hex");
}

function clientIp(headers: Headers) {
  return (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}

function deviceCookie(deviceId: string) {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${deviceCookieName}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

export function getOrSetDeviceId(args: Pick<AbuseContext, "headers" | "resHeaders">) {
  const existing = readCookie(args.headers.get("cookie"), deviceCookieName);
  if (existing) return existing;
  const deviceId = randomUUID();
  args.resHeaders?.append("set-cookie", deviceCookie(deviceId));
  return deviceId;
}

export function abuseKeys(args: AbuseContext) {
  const deviceId = getOrSetDeviceId(args);
  const ip = clientIp(args.headers);
  return {
    deviceKeyHash: hmac(`device:${deviceId}`),
    ipKeyHash: ip ? hmac(`ip:${ip}`) : null,
  };
}

async function countRecent(where: Prisma.AbuseSignalEventWhereInput, since: Date) {
  return db.abuseSignalEvent.count({
    where: {
      ...where,
      createdAt: { gte: since },
      decision: { in: ["allowed", "flagged"] },
    },
  });
}

export async function checkAndRecordAbuse(args: AbuseContext & {
  action: AbuseAction;
  metadata?: Prisma.InputJsonValue;
}) {
  const rule = rateRules[args.action];
  const since = new Date(Date.now() - rule.windowMs);
  const keys = abuseKeys(args);
  const counts = await Promise.all([
    args.userId && rule.maxByUser
      ? countRecent({ userId: args.userId, action: args.action }, since)
      : Promise.resolve(0),
    args.anonymousSessionId && rule.maxBySession
      ? countRecent({ anonymousSessionId: args.anonymousSessionId, action: args.action }, since)
      : Promise.resolve(0),
    rule.maxByDevice
      ? countRecent({ deviceKeyHash: keys.deviceKeyHash, action: args.action }, since)
      : Promise.resolve(0),
    keys.ipKeyHash && rule.maxByIp
      ? countRecent({ ipKeyHash: keys.ipKeyHash, action: args.action }, since)
      : Promise.resolve(0),
  ]);

  const [byUser, bySession, byDevice, byIp] = counts;
  let decision: AbuseDecision = "allowed";
  if (
    (rule.maxByUser && byUser >= rule.maxByUser) ||
    (rule.maxBySession && bySession >= rule.maxBySession) ||
    (rule.maxByDevice && byDevice >= rule.maxByDevice)
  ) {
    decision = "blocked";
  } else if (rule.maxByIp && byIp >= rule.maxByIp) {
    decision = "throttled";
  } else if (args.action === "free_cv_claim" && byDevice > 0 && byIp > 3) {
    decision = "flagged";
  }

  await db.abuseSignalEvent.create({
    data: {
      action: args.action,
      decision,
      userId: args.userId ?? null,
      anonymousSessionId: args.anonymousSessionId ?? null,
      deviceKeyHash: keys.deviceKeyHash,
      ipKeyHash: keys.ipKeyHash,
      metadataJson: args.metadata,
    },
  });

  return { decision, ...keys };
}

export function isAbuseDenied(decision: AbuseDecision) {
  return decision === "blocked" || decision === "throttled";
}
