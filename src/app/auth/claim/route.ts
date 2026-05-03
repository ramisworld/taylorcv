import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { anonymousSessionCookieName } from "~/server/services/session.service";
import { claimApplication } from "~/server/services/applicationWorkflow.service";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  const next = url.searchParams.get("next") || "/hub";
  const authState = await auth();

  if (!authState.userId) {
    return authState.redirectToSignIn({ returnBackUrl: request.url });
  }

  const anonymousSessionId = (await cookies()).get(
    anonymousSessionCookieName
  )?.value;

  if (applicationId && anonymousSessionId) {
    await claimApplication({
      anonymousSessionId,
      applicationId,
      clerkUserId: authState.userId,
    }).catch(() => undefined);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
