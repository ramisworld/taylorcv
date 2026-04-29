import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalWhenMock = z
  .string()
  .min(1)
  .optional()
  .refine((value) => process.env.USE_MOCK_AI === "true" || !!value, {
    message: "Required when USE_MOCK_AI is false",
  });

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: optionalWhenMock,
    OPENAI_FAST_MODEL: optionalWhenMock,
    OPENAI_STRONG_MODEL: optionalWhenMock,
    OPENAI_EMBEDDING_MODEL: optionalWhenMock,
    USE_MOCK_AI: z.enum(["true", "false"]).default("false"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
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
