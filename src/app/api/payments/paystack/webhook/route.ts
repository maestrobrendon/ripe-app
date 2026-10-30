import { NextResponse } from "next/server";
import { validWebhookSignature } from "@/lib/paystack";
import { settlePayment } from "@/lib/payments";

/*
 * Paystack's webhook (Paystack dashboard > Settings > API Keys & Webhooks:
 * https://www.getbasket.ng/api/payments/paystack/webhook). It's how a payment
 * is recorded when the customer closed the page before it came back. The body
 * is trusted only with a valid x-paystack-signature, and even then the event
 * is just a prompt: settlePayment asks Paystack itself what happened.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const reference = event.data?.reference;
  // Only our own references; anything else on the account isn't ours to record.
  if (event.event === "charge.success" && reference?.startsWith("BSK-PAY-")) {
    await settlePayment(reference, "webhook");
  }
  // Paystack retries anything that isn't a 200, so every handled event gets one.
  return NextResponse.json({ received: true });
}
