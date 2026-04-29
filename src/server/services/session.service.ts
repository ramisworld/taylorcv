import "server-only";

import { randomUUID } from "crypto";

import { env } from "~/env";
import { db } from "~/server/db";

export const anonymousSessionCookieName = "taylor_cv_session";

function readCookie(cookieHeader: string | null, name: string) {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function buildSessionCookie(anonymousSessionId: string) {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${anonymousSessionCookieName}=${anonymousSessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

export async function getOrCreateAnonymousSession(args: {
  headers: Headers;
  resHeaders?: Headers;
}) {
  const cookieValue = readCookie(
    args.headers.get("cookie"),
    anonymousSessionCookieName
  );

  if (cookieValue) {
    const existing = await db.anonymousSession.findUnique({
      where: { id: cookieValue },
    });

    if (existing) {
      return existing.id;
    }
  }

  const session = await db.anonymousSession.create({
    data: { id: randomUUID() },
  });

  args.resHeaders?.append("set-cookie", buildSessionCookie(session.id));

  return session.id;
}
