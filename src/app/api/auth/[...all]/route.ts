import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import {
  checkAndRecordAbuse,
  isAbuseDenied,
} from "~/server/services/abuse.service";
import { getOrCreateAnonymousSession } from "~/server/services/session.service";
import type { AbuseAction } from "../../../../../generated/prisma/index.js";

export const runtime = "nodejs";

function authActionFor(pathname: string): AbuseAction | null {
  if (pathname.endsWith("/sign-up/email")) return "account_create";
  if (pathname.endsWith("/sign-in/email")) return "sign_in";
  if (pathname.endsWith("/request-password-reset")) return "password_reset";
  if (pathname.endsWith("/send-verification-email")) return "verification_resend";
  return null;
}

async function handler(request: NextRequest) {
  const resHeaders = new Headers();
  const action = authActionFor(request.nextUrl.pathname);
  if (action && request.method === "POST") {
    const anonymousSessionId = await getOrCreateAnonymousSession({
      headers: request.headers,
      resHeaders,
    });
    const abuse = await checkAndRecordAbuse({
      action,
      headers: request.headers,
      resHeaders,
      anonymousSessionId,
    });
    if (isAbuseDenied(abuse.decision)) {
      const response = NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429 }
      );
      resHeaders.forEach((value, key) => response.headers.append(key, value));
      return response;
    }
  }
  const response = await auth.handler(request);
  resHeaders.forEach((value, key) => response.headers.append(key, value));
  return response;
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
