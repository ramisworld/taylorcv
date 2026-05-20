import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalWhenMock = z
  .string()
  .min(1)
  .optional()
  .refine((value) => process.env.USE_MOCK_AI === "true" || !!value, {
    message: "Required when USE_MOCK_AI is false",
  });

const requiredOutsideTest = z
  .string()
  .min(1)
  .optional()
  .refine((value) => process.env.NODE_ENV === "test" || !!value, {
    message: "Required outside test mode",
  });

const secretOutsideTest = z
  .string()
  .min(32)
  .optional()
  .refine((value) => process.env.NODE_ENV === "test" || !!value, {
    message: "Required outside test mode",
  });

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: secretOutsideTest,
    BETTER_AUTH_URL: z.string().url().optional().default("http://localhost:3000"),
    RESEND_API_KEY: requiredOutsideTest,
    AUTH_EMAIL_FROM: requiredOutsideTest,
    ABUSE_HASH_SECRET: secretOutsideTest,
    STRIPE_SECRET_KEY: requiredOutsideTest,
    STRIPE_WEBHOOK_SECRET: requiredOutsideTest,
    STRIPE_PRICE_PRO_ANNUAL: requiredOutsideTest,
    STRIPE_PRICE_PRO_MONTHLY: requiredOutsideTest,
    STRIPE_PRICE_PREMIUM_ANNUAL: requiredOutsideTest,
    STRIPE_PRICE_PREMIUM_MONTHLY: requiredOutsideTest,
    STRIPE_CUSTOMER_PORTAL_MONTHLY_CONFIGURATION_ID: z.string().min(1).optional(),
    STRIPE_CUSTOMER_PORTAL_ANNUAL_LOCKED_CONFIGURATION_ID: z.string().min(1).optional(),
    OPENAI_API_KEY: optionalWhenMock,
    OPENAI_FAST_MODEL: optionalWhenMock,
    OPENAI_STRONG_MODEL: optionalWhenMock,
    OPENAI_EMBEDDING_MODEL: optionalWhenMock,
    USE_MOCK_AI: z.enum(["true", "false"]).default("false"),
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
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    USE_MOCK_AI: process.env.USE_MOCK_AI,
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
