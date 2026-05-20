import { NextResponse, type NextRequest } from "next/server";

import { handleStripeWebhook } from "~/server/services/billing.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    await handleStripeWebhook({ payload, signature });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 400 }
    );
  }
}
