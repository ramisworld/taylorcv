import { z } from "zod";

import { plans } from "~/lib/plans";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createCheckoutSession,
  createPortalSession,
} from "~/server/services/billing.service";
import { getEntitlementState } from "~/server/services/entitlement.service";

const planKeySchema = z.enum([
  "pro_annual",
  "pro_monthly",
  "premium_annual",
  "premium_monthly",
]);

export const billingRouter = createTRPCRouter({
  getEntitlement: protectedProcedure.query(async ({ ctx }) => {
    const entitlement = await getEntitlementState(ctx.userId);
    return {
      planKey: entitlement.planKey,
      plan: entitlement.plan,
      used: entitlement.used,
      remaining: entitlement.remaining,
      periodStart: entitlement.periodStart,
      periodEnd: entitlement.periodEnd,
      emailVerified: entitlement.user.emailVerified,
      billingAccount: entitlement.billingAccount,
      plans,
    };
  }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ planKey: planKeySchema }))
    .mutation(({ ctx, input }) =>
      createCheckoutSession({
        userId: ctx.userId,
        planKey: input.planKey,
        headers: ctx.headers,
        resHeaders: ctx.resHeaders,
        anonymousSessionId: ctx.anonymousSessionId,
      })
    ),

  createPortalSession: protectedProcedure.mutation(({ ctx }) =>
    createPortalSession({ userId: ctx.userId })
  ),
});
