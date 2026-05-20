import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { anonymousSessionCookieName } from "~/server/services/session.service";
import { claimApplication } from "~/server/services/applicationWorkflow.service";
import { getAuthSession } from "~/server/auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  const next = url.searchParams.get("next") || "/dashboard";
  const authSession = await getAuthSession(request.headers);

  if (!authSession?.user?.id) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?returnTo=${encodeURIComponent(request.url)}`, request.url)
    );
  }

  const anonymousSessionId = (await cookies()).get(
    anonymousSessionCookieName
  )?.value;

  if (applicationId && anonymousSessionId) {
    await claimApplication({
      anonymousSessionId,
      applicationId,
      userId: authSession.user.id,
    }).catch(() => undefined);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
