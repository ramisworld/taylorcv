import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const emailEnabled = isProduction || process.env.ENABLE_EMAIL === "true";
const billingEnabled = isProduction || process.env.ENABLE_BILLING === "true";
const realAiEnabled = process.env.USE_MOCK_AI === "false";

/** @param {string} message */
const requiredSecret = (message) =>
  z.string().min(32, message);

/** @param {boolean} enabled @param {string} message */
const requiredWhen = (enabled, message) =>
  z
    .string()
    .min(1)
    .optional()
    .refine((value) => !enabled || !!value, { message });

const optionalWhenMock = requiredWhen(
  realAiEnabled,
  'Required when USE_MOCK_AI is "false"'
);

const requiredWhenEmailEnabled = requiredWhen(
  emailEnabled,
  'Required in production or when ENABLE_EMAIL is "true"'
);

const requiredWhenBillingEnabled = requiredWhen(
  billingEnabled,
  'Required in production or when ENABLE_BILLING is "true"'
);

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: requiredSecret(
      "BETTER_AUTH_SECRET must be at least 32 characters"
    ),
    BETTER_AUTH_URL: z.string().url(),
    RESEND_API_KEY: requiredWhenEmailEnabled,
    AUTH_EMAIL_FROM: requiredWhenEmailEnabled,
    ABUSE_HASH_SECRET: requiredSecret(
      "ABUSE_HASH_SECRET must be at least 32 characters"
    ),
    ENABLE_EMAIL: z.enum(["true", "false"]).default("false"),
    ENABLE_BILLING: z.enum(["true", "false"]).default("false"),
    STRIPE_SECRET_KEY: requiredWhenBillingEnabled,
    STRIPE_WEBHOOK_SECRET: requiredWhenBillingEnabled,
    STRIPE_PRICE_PRO_ANNUAL: requiredWhenBillingEnabled,
    STRIPE_PRICE_PRO_MONTHLY: requiredWhenBillingEnabled,
    STRIPE_PRICE_PREMIUM_ANNUAL: requiredWhenBillingEnabled,
    STRIPE_PRICE_PREMIUM_MONTHLY: requiredWhenBillingEnabled,
    STRIPE_CUSTOMER_PORTAL_MONTHLY_CONFIGURATION_ID: z.string().min(1).optional(),
    STRIPE_CUSTOMER_PORTAL_ANNUAL_LOCKED_CONFIGURATION_ID: z.string().min(1).optional(),
    OPENAI_API_KEY: optionalWhenMock,
    OPENAI_FAST_MODEL: optionalWhenMock,
    OPENAI_STRONG_MODEL: optionalWhenMock,
    USE_MOCK_AI: z.enum(["true", "false"]),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  client: {
    NEXT_PUBLIC_ENABLE_TRPC_LOGGER: z.enum(["true", "false"]).optional(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    ABUSE_HASH_SECRET: process.env.ABUSE_HASH_SECRET,
    ENABLE_EMAIL: process.env.ENABLE_EMAIL,
    ENABLE_BILLING: process.env.ENABLE_BILLING,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PREMIUM_ANNUAL: process.env.STRIPE_PRICE_PREMIUM_ANNUAL,
    STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    STRIPE_CUSTOMER_PORTAL_MONTHLY_CONFIGURATION_ID:
      process.env.STRIPE_CUSTOMER_PORTAL_MONTHLY_CONFIGURATION_ID,
    STRIPE_CUSTOMER_PORTAL_ANNUAL_LOCKED_CONFIGURATION_ID:
      process.env.STRIPE_CUSTOMER_PORTAL_ANNUAL_LOCKED_CONFIGURATION_ID,
    NEXT_PUBLIC_ENABLE_TRPC_LOGGER:
      process.env.NEXT_PUBLIC_ENABLE_TRPC_LOGGER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_FAST_MODEL: process.env.OPENAI_FAST_MODEL,
    OPENAI_STRONG_MODEL: process.env.OPENAI_STRONG_MODEL,
    USE_MOCK_AI: process.env.USE_MOCK_AI,
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
