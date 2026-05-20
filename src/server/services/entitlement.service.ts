import "server-only";

import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../../generated/prisma/index.js";

import { plans, type PlanKey } from "~/lib/plans";
import { db } from "~/server/db";
import {
  checkAndRecordAbuse,
  isAbuseDenied,
} from "~/server/services/abuse.service";

type DbOrTx = PrismaClient | Parameters<Parameters<typeof db.$transaction>[0]>[0];

function isPaidStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function ensureBillingAccount(userId: string) {
  return db.billingAccount.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      activePlanKey: "free",
      planFamily: "free",
      planVariant: "free",
      subscriptionStatus: "none",
      quotaPerPeriod: plans.free.cvGenerationQuota,
    },
  });
}

export async function getEntitlementState(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue." });
  }
  const billingAccount = await ensureBillingAccount(userId);
  const paidActive = plans[billingAccount.activePlanKey as PlanKey]?.paid &&
    isPaidStatus(billingAccount.subscriptionStatus);
  const planKey = paidActive ? (billingAccount.activePlanKey as PlanKey) : "free";
  const plan = plans[planKey];
  const periodStart = paidActive ? billingAccount.currentPeriodStart : null;
  const periodEnd = paidActive ? billingAccount.currentPeriodEnd : null;
  const usageWhere = paidActive && periodStart && periodEnd
    ? { userId, createdAt: { gte: periodStart, lt: periodEnd } }
    : { userId, planKey: "free" };
  const used = await db.cvGenerationUsage.count({ where: usageWhere });
  return {
    user,
    billingAccount,
    planKey,
    plan,
    used,
    remaining: Math.max(0, plan.cvGenerationQuota - used),
    periodStart,
    periodEnd,
    requiresEmailVerification: planKey === "free" && !user.emailVerified,
    paidActive: !!paidActive,
  };
}

export async function assertCanGenerateCv(args: {
  userId: string | null | undefined;
  anonymousSessionId: string;
  headers: Headers;
  resHeaders?: Headers;
}) {
  if (!args.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ACCOUNT_REQUIRED",
    });
  }
  const entitlement = await getEntitlementState(args.userId);
  if (entitlement.requiresEmailVerification) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "EMAIL_VERIFICATION_REQUIRED",
    });
  }
  if (entitlement.remaining <= 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "QUOTA_EXCEEDED",
    });
  }
  if (entitlement.planKey === "free") {
    const abuse = await checkAndRecordAbuse({
      action: "free_cv_claim",
      headers: args.headers,
      resHeaders: args.resHeaders,
      userId: args.userId,
      anonymousSessionId: args.anonymousSessionId,
    });
    if (isAbuseDenied(abuse.decision)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "FREE_CV_LIMIT_REACHED",
      });
    }
  }
  return entitlement;
}

export async function recordSuccessfulCvGeneration(args: {
  tx: DbOrTx;
  userId: string;
  applicationId: string;
  cvDraftId: string;
  planKey: PlanKey;
  billingPeriodStart?: Date | null;
  billingPeriodEnd?: Date | null;
}) {
  return args.tx.cvGenerationUsage.create({
    data: {
      userId: args.userId,
      applicationId: args.applicationId,
      cvDraftId: args.cvDraftId,
      planKey: args.planKey,
      billingPeriodStart: args.billingPeriodStart ?? null,
      billingPeriodEnd: args.billingPeriodEnd ?? null,
    },
  });
}
