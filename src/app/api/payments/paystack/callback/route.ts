import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/payments";
import { appOrigin } from "@/lib/site";
import { prisma } from "@/lib/prisma";

/*
 * Where Paystack sends the customer back after paying on its own page (the
 * fallback when the in-page checkout can't open). It records the payment,
 * then shows them the order, or their basket for a new membership.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";
  if (!reference.startsWith("BSK-PAY-")) return NextResponse.redirect(`${appOrigin()}/basket`);
  const r = await settlePayment(reference, "callback");
  if (r.orderId) {
    const token = r.ok && r.accessToken ? `&t=${encodeURIComponent(r.accessToken)}` : "";
    return NextResponse.redirect(`${appOrigin()}/orders/${r.orderId}?paid=${r.ok ? 1 : 0}${token}`);
  }
  if (r.ok && r.kind === "GIFT" && r.giftCode) return NextResponse.redirect(`${appOrigin()}/gift/${r.giftCode}?sent=1`);
  if (!r.ok) {
    // Not an order: a gift goes back to the gift page, a membership to the plans.
    const p = await prisma.payment.findUnique({ where: { reference }, select: { kind: true } });
    if (p?.kind === "GIFT") return NextResponse.redirect(`${appOrigin()}/gift?paid=0`);
  }
  return NextResponse.redirect(`${appOrigin()}/${r.ok ? "basket?joined=1" : "subscribe?paid=0"}`);
}
