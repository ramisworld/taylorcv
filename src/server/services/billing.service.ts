import "server-only";

import { createHash } from "crypto";

import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/index.js";

import { env } from "~/env";
import { plans, type PlanKey, isPlanKey } from "~/lib/plans";
import { db } from "~/server/db";
import {
  checkAndRecordAbuse,
  isAbuseDenied,
} from "~/server/services/abuse.service";
import { ensureBillingAccount } from "~/server/services/entitlement.service";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_missing", {
  apiVersion: "2026-04-22.dahlia",
});

function appUrl(path: string) {
  return new URL(path, env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}

export function stripePriceIdForPlan(planKey: PlanKey) {
  const envKey = plans[planKey].stripePriceEnvKey;
  if (!envKey) return null;
  const priceId = env[envKey as keyof typeof env];
  if (typeof priceId !== "string" || !priceId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Missing ${envKey}`,
    });
  }
  return priceId;
}

export async function getOrCreateStripeCustomer(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue." });
  }
  const billingAccount = await ensureBillingAccount(userId);
  if (billingAccount.stripeCustomerId) return billingAccount.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId },
  });
  await db.billingAccount.update({
    where: { userId },
    data: { stripeCustomerId: customer.id, lastSyncedAt: new Date() },
  });
  return customer.id;
}

function activePaidStatus(status: string) {
  return status === "active" || status === "trialing" || status === "past_due";
}

export async function createCheckoutSession(args: {
  userId: string;
  planKey: PlanKey;
  headers: Headers;
  resHeaders?: Headers;
  anonymousSessionId?: string | null;
}) {
  const plan = plans[args.planKey];
  if (!plan.paid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a paid plan." });
  }
  const abuse = await checkAndRecordAbuse({
    action: "checkout_create",
    headers: args.headers,
    resHeaders: args.resHeaders,
    userId: args.userId,
    anonymousSessionId: args.anonymousSessionId ?? null,
  });
  if (isAbuseDenied(abuse.decision)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many checkout attempts. Try again shortly.",
    });
  }

  const billingAccount = await ensureBillingAccount(args.userId);
  if (
    billingAccount.stripeSubscriptionId &&
    activePaidStatus(billingAccount.subscriptionStatus)
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "ALREADY_HAS_SUBSCRIPTION",
    });
  }

  const customerId = await getOrCreateStripeCustomer(args.userId);
  const priceId = stripePriceIdForPlan(args.planKey);
  if (!priceId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Free plan has no checkout." });
  }
  const disclosure = plan.requiresTwelveMonthCommitment
    ? "Annual plan: 12-month minimum commitment, charged monthly. After the initial 12 months, your plan continues month-to-month unless cancelled."
    : "Flexible monthly plan. Cancel according to the monthly billing terms.";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl("/dashboard?checkout=success"),
    cancel_url: appUrl("/?pricing=1#pricing"),
    client_reference_id: args.userId,
    metadata: {
      userId: args.userId,
      planKey: args.planKey,
      planFamily: plan.family,
      planVariant: plan.variant,
    },
    subscription_data: {
      metadata: {
        userId: args.userId,
        planKey: args.planKey,
        planFamily: plan.family,
        planVariant: plan.variant,
      },
    },
    custom_text: {
      submit: { message: disclosure },
    },
  });

  if (!session.url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe did not return a checkout URL.",
    });
  }

  return { url: session.url };
}

export async function createPortalSession(args: { userId: string }) {
  const billingAccount = await ensureBillingAccount(args.userId);
  if (!billingAccount.stripeCustomerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found." });
  }
  const lockedAnnual =
    billingAccount.commitmentActive &&
    billingAccount.commitmentEndAt &&
    billingAccount.commitmentEndAt > new Date();
  const configuration = lockedAnnual
    ? env.STRIPE_CUSTOMER_PORTAL_ANNUAL_LOCKED_CONFIGURATION_ID
    : env.STRIPE_CUSTOMER_PORTAL_MONTHLY_CONFIGURATION_ID;
  if (lockedAnnual && !configuration) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Annual plan billing changes are available after the initial commitment window.",
    });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: billingAccount.stripeCustomerId,
    return_url: appUrl("/dashboard"),
    ...(configuration ? { configuration } : {}),
  });
  return { url: session.url };
}

function dateFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null;
}

function payloadHash(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

function planKeyFromSubscription(subscription: Stripe.Subscription) {
  const metadataPlanKey = subscription.metadata?.planKey;
  if (metadataPlanKey && isPlanKey(metadataPlanKey)) return metadataPlanKey;
  const priceId = subscription.items.data[0]?.price.id;
  return Object.values(plans).find((plan) => {
    if (!plan.stripePriceEnvKey) return false;
    const value = env[plan.stripePriceEnvKey as keyof typeof env];
    return value === priceId;
  })?.key ?? "free";
}

async function findUserIdFromCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const billingAccount = await db.billingAccount.findUnique({
    where: { stripeCustomerId: customerId },
  });
  return billingAccount?.userId ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata?.userId ??
    (await findUserIdFromCustomer(
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
    ));
  if (!userId) return;
  const planKey = planKeyFromSubscription(subscription);
  const plan = plans[planKey];
  const item = subscription.items.data[0];
  const periodStart = dateFromUnix((subscription as any).current_period_start);
  const periodEnd = dateFromUnix((subscription as any).current_period_end);
  await db.billingAccount.upsert({
    where: { userId },
    update: {
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      activePlanKey: planKey,
      planFamily: plan.family,
      planVariant: plan.variant,
      subscriptionStatus: subscription.status,
      priceId: item?.price.id ?? null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      quotaPerPeriod: plan.cvGenerationQuota,
      lastSyncedAt: new Date(),
    },
    create: {
      userId,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      activePlanKey: planKey,
      planFamily: plan.family,
      planVariant: plan.variant,
      subscriptionStatus: subscription.status,
      priceId: item?.price.id ?? null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      quotaPerPeriod: plan.cvGenerationQuota,
      lastSyncedAt: new Date(),
    },
  });
}

async function ensureAnnualSchedule(subscriptionId: string, planKey: PlanKey) {
  const plan = plans[planKey];
  if (!plan.requiresTwelveMonthCommitment) return;
  const billingAccount = await db.billingAccount.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (billingAccount?.stripeSubscriptionScheduleId) return;

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscriptionId,
  });
  const firstPhase = schedule.phases[0];
  const priceId = stripePriceIdForPlan(planKey);
  if (!priceId) return;
  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        start_date: firstPhase?.start_date ?? "now",
        items: [{ price: priceId, quantity: 1 }],
        duration: { interval: "month", interval_count: 12 },
        metadata: { planKey },
      },
    ],
    metadata: {
      userId: billingAccount?.userId ?? "",
      planKey,
      planFamily: plan.family,
      planVariant: plan.variant,
    },
  } as Stripe.SubscriptionScheduleUpdateParams);
  const phase = updated.phases[0];
  await db.billingAccount.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      stripeSubscriptionScheduleId: updated.id,
      commitmentStartAt: dateFromUnix(phase?.start_date),
      commitmentEndAt: dateFromUnix(phase?.end_date),
      commitmentActive: true,
      lastSyncedAt: new Date(),
    },
  });
}

async function syncSchedule(schedule: Stripe.SubscriptionSchedule) {
  const subscriptionId =
    typeof schedule.subscription === "string"
      ? schedule.subscription
      : schedule.subscription?.id ?? null;
  const phase = schedule.phases[0];
  await db.billingAccount.updateMany({
    where: {
      OR: [
        { stripeSubscriptionScheduleId: schedule.id },
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
      ],
    },
    data: {
      stripeSubscriptionScheduleId:
        schedule.status === "released" ? null : schedule.id,
      commitmentStartAt: dateFromUnix(phase?.start_date),
      commitmentEndAt: dateFromUnix(phase?.end_date),
      commitmentActive:
        schedule.status === "active" &&
        !!phase?.end_date &&
        new Date(phase.end_date * 1000) > new Date(),
      lastSyncedAt: new Date(),
    },
  });
}

export async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const planKey = session.metadata?.planKey;
      if (
        session.subscription &&
        typeof session.subscription === "string" &&
        planKey &&
        isPlanKey(planKey)
      ) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription);
        await ensureAnnualSchedule(subscription.id, planKey);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      await db.billingAccount.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          activePlanKey: "free",
          planFamily: "free",
          planVariant: "free",
          subscriptionStatus: "canceled",
          commitmentActive: false,
          quotaPerPeriod: plans.free.cvGenerationQuota,
          lastSyncedAt: new Date(),
        },
      });
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as any).subscription;
      if (typeof subscriptionId === "string") {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
      }
      break;
    }
    case "subscription_schedule.created":
    case "subscription_schedule.updated":
    case "subscription_schedule.completed":
    case "subscription_schedule.released":
    case "subscription_schedule.canceled":
    case "subscription_schedule.aborted": {
      await syncSchedule(event.data.object as Stripe.SubscriptionSchedule);
      break;
    }
    default:
      break;
  }
}

export async function handleStripeWebhook(args: {
  payload: string;
  signature: string | null;
}) {
  if (!args.signature) {
    throw new Error("Missing Stripe signature");
  }
  const event = stripe.webhooks.constructEvent(
    args.payload,
    args.signature,
    env.STRIPE_WEBHOOK_SECRET ?? "whsec_missing"
  );
  const existing = await db.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.processingStatus === "processed") return { received: true };
  await db.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    update: {
      eventType: event.type,
      processingStatus: "processing",
      payloadHash: payloadHash(args.payload),
      error: null,
    },
    create: {
      stripeEventId: event.id,
      eventType: event.type,
      processingStatus: "processing",
      payloadHash: payloadHash(args.payload),
    },
  });
  try {
    await processStripeEvent(event);
    await db.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        processingStatus: "processed",
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await db.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        processingStatus: "failed",
        error: error instanceof Error ? error.message : "Unknown webhook error",
      },
    });
    throw error;
  }
  return { received: true };
}
