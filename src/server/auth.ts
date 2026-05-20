import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "~/server/services/email.service";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, {
    provider: "postgresql",
    transaction: true,
  }),
  user: {
    modelName: "user",
    fields: {
      emailVerified: "emailVerified",
    },
  },
  session: {
    modelName: "session",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  account: {
    modelName: "account",
  },
  verification: {
    modelName: "verification",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail({ email: user.email, url });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerificationEmail({ email: user.email, url });
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getAuthSession(headers: Headers) {
  return auth.api.getSession({ headers }).catch(() => null);
}
