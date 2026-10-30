import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/*
 * Paystack's REST API, the four calls we use: start a payment, confirm one,
 * refund one, and check that a webhook really came from Paystack. Server
 * only: the secret key never reaches a browser. Amounts in and out are naira;
 * Paystack itself works in kobo.
 *
 * PAYSTACK_SECRET_KEY is sk_test_… in test mode (no real money moves) and
 * sk_live_… when live; NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is the matching pk_.
 */

const API = "https://api.paystack.co";

export function paystackReady(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY);
}

/** True while the keys are test keys, so pages can say no real money moves. */
export function paystackTestMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack isn't set up (PAYSTACK_SECRET_KEY is missing).");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) throw new Error(body?.message ?? `Paystack ${res.status}`);
  return body.data as T;
}

export type StartedPayment = { authorizationUrl: string; accessCode: string; reference: string };

/** Opens a payment for `amount` naira under our reference. Nothing is charged until the customer completes it. */
export async function initializeTransaction(input: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<StartedPayment> {
  const d = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ["card", "bank", "ussd", "bank_transfer"],
    }),
  });
  return { authorizationUrl: d.authorization_url, accessCode: d.access_code, reference: d.reference };
}

export type VerifiedTransaction = {
  id: number;
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  reference: string;
  /** Naira. */
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  cardLast4: string | null;
  gatewayResponse: string | null;
};

/** What Paystack says happened to a payment. The only thing that ever marks one paid. */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const d = await call<{
    id: number;
    status: VerifiedTransaction["status"];
    reference: string;
    amount: number;
    currency: string;
    channel?: string;
    paid_at?: string | null;
    gateway_response?: string;
    authorization?: { last4?: string };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    id: d.id,
    status: d.status,
    reference: d.reference,
    amount: d.amount / 100,
    currency: d.currency,
    channel: d.channel ?? null,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    cardLast4: d.authorization?.last4 ?? null,
    gatewayResponse: d.gateway_response ?? null,
  };
}

/** Sends `amount` naira of a payment back to the customer, the way they paid. */
export async function refundTransaction(reference: string, amount: number, note: string): Promise<{ status: string }> {
  return call<{ status: string }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference, amount: Math.round(amount * 100), merchant_note: note.slice(0, 200) }),
  });
}

/** Paystack signs each webhook with an HMAC-SHA512 of the raw body, keyed with the secret key. */
export function validWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
