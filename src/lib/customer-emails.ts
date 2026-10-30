import "server-only";
import { sendEmail } from "@/lib/email";
import { renderEmail, type EmailContent, type EmailTone } from "@/lib/email-layout";
import { formatNaira } from "@/lib/format";
import { appOrigin } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { supportHref, whatsappReady } from "@/lib/support";
import type { OrderStatus } from "@/generated/prisma/enums";

/*
 * Emails customers get about their orders and plan. Short, plain, one job
 * each, all in the shared layout (lib/email-layout.ts). Every function
 * swallows delivery failures: an email that doesn't go out must never undo
 * the order or status change that triggered it.
 */

const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
const ref = (id: string) => `#${id.slice(-8).toUpperCase()}`;

type OrderForEmail = {
  id: string;
  accessToken: string;
  customerName: string;
  customerEmail: string | null;
  deliveryDate: Date;
  total: number;
  address: string;
  zoneName: string;
};

function orderLink(o: OrderForEmail) {
  return `${appOrigin()}/orders/${o.id}?t=${encodeURIComponent(o.accessToken)}`;
}

async function send(to: string | null, subject: string, content: EmailContent) {
  if (!to) return;
  const { support } = await getSiteSettings();
  const help = whatsappReady(support) ? `Questions? Reply to this email or message us on WhatsApp: ${supportHref(support)}` : undefined;
  await sendEmail({ to, subject, ...renderEmail({ help, ...content }) }).catch(() => false);
}

export async function sendOrderConfirmation(o: OrderForEmail & { items: { name: string; quantity: number }[] }) {
  const first = o.customerName.split(/\s+/)[0];
  const list = o.items.slice(0, 12).map((i) => `${i.name} × ${i.quantity}`).join(", ") + (o.items.length > 12 ? ", and more" : "");
  await send(o.customerEmail, `Order ${ref(o.id)} confirmed`, {
    tag: { label: "Order confirmed", tone: "mint" },
    heading: `Thanks, ${first}. Your basket is in.`,
    paragraphs: [list],
    rows: [
      ["Arriving", day(o.deliveryDate)],
      ["To", `${o.address} (${o.zoneName})`],
      ["Total", formatNaira(o.total)],
      ["Order", ref(o.id)],
    ],
    button: { href: orderLink(o), label: "Track your order" },
  });
}

const STATUS_COPY: Partial<Record<OrderStatus, (o: OrderForEmail) => { subject: string; heading: string; tone: EmailTone; lines: string[] }>> = {
  OUT_FOR_DELIVERY: (o) => ({ subject: "Your order is on the way", heading: "On its way to you", tone: "blue", lines: [`Your order left us and is heading to ${o.zoneName}. Please keep your phone close so the rider can reach you.`] }),
  DELIVERED: () => ({ subject: "Your order was delivered", heading: "Delivered. Enjoy it.", tone: "mint", lines: ["Your order has been delivered. Enjoy cooking with it.", "If anything isn't right, tell us within 7 days from your order page and we'll put it right."] }),
  FAILED_DELIVERY: () => ({ subject: "We missed you", heading: "We missed you", tone: "sun", lines: ["We tried to deliver your order but couldn't complete it. We'll contact you to arrange another time."] }),
  CANCELLED: () => ({ subject: "Your order was cancelled", heading: "Order cancelled", tone: "ember", lines: ["Your order has been cancelled and won't be delivered. If you paid, we'll be in touch about your refund."] }),
};

/** Only the moments a customer needs to know about get an email. */
export async function sendOrderStatusEmail(o: OrderForEmail, status: OrderStatus, note?: string | null) {
  const copy = STATUS_COPY[status]?.(o);
  if (!copy) return;
  const lines = note && status === "CANCELLED" ? [...copy.lines, `Reason: ${note}`] : copy.lines;
  await send(o.customerEmail, `${copy.subject} (${ref(o.id)})`, {
    tag: { label: `Order ${ref(o.id)}`, tone: copy.tone },
    heading: copy.heading,
    paragraphs: lines,
    button: { href: orderLink(o), label: "See your order" },
  });
}

export async function sendRefundEmail(o: OrderForEmail, amount: number, method: string) {
  await send(o.customerEmail, `Refund for order ${ref(o.id)}`, {
    tag: { label: "Refund", tone: "lavender" },
    heading: `${formatNaira(amount)} is on its way back`,
    paragraphs: ["It can take a few working days to show, depending on your bank."],
    rows: [
      ["Amount", formatNaira(amount)],
      ["Refunded by", method],
      ["Order", ref(o.id)],
    ],
    button: { href: orderLink(o), label: "See your order" },
  });
}

export async function sendPlanRequestReceived(to: string | null, name: string, tierName: string, monthlyFee: number) {
  await send(to, `Your ${tierName} request`, {
    tag: { label: "Membership", tone: "violet" },
    heading: `Thanks, ${name.split(/\s+/)[0]}. Request received.`,
    paragraphs: [
      `We've got your request to join ${tierName} (${formatNaira(monthlyFee)} a month).`,
      "We'll email you payment details within one working day. Your plan starts as soon as payment is confirmed, and nothing is charged automatically.",
    ],
    button: { href: `${appOrigin()}/subscribe`, label: "See your plan" },
  });
}

export async function sendPlanDecision(to: string | null, name: string, tierName: string, approved: boolean, note?: string | null) {
  await send(
    to,
    approved ? `Welcome to ${tierName}` : `About your ${tierName} request`,
    approved
      ? {
          tag: { label: "Membership", tone: "violet" },
          heading: `Welcome to ${tierName}, ${name.split(/\s+/)[0]}`,
          paragraphs: ["Member prices and your weekly basket are ready."],
          button: { href: `${appOrigin()}/basket`, label: "Open your basket" },
        }
      : {
          tag: { label: "Membership", tone: "violet" },
          heading: `About your ${tierName} request`,
          paragraphs: [`We couldn't start your ${tierName} plan this time.`, ...(note ? [note] : []), "You can keep shopping as you go, and ask again anytime."],
          button: { href: `${appOrigin()}/subscribe`, label: "See plans" },
        },
  );
}

/** A receipt for an online payment: what it was for, how much, and how they paid. */
export async function sendPaymentReceipt(to: string | null, input: { amount: number; what: string; how: string; reference: string; link: string; linkLabel: string }) {
  await send(to, `Payment received: ${formatNaira(input.amount)}`, {
    tag: { label: "Receipt", tone: "mint" },
    heading: `${formatNaira(input.amount)} received. Thank you.`,
    paragraphs: [`This is your receipt for ${input.what}.`],
    rows: [
      ["Amount", formatNaira(input.amount)],
      ["For", input.what],
      ["Paid by", input.how],
      ["Reference", input.reference],
    ],
    button: { href: input.link, label: input.linkLabel },
  });
}

/** A gift basket arriving: who it's from, their note, and the link to claim it. */
export async function sendGiftEmail(to: string, input: { fromName: string; recipientName: string; amount: number; message: string | null; link: string }) {
  await send(to, `${input.fromName} sent you a basket`, {
    tag: { label: "A gift for you", tone: "lavender" },
    heading: `${input.recipientName.split(/\s+/)[0]}, ${input.fromName} sent you a basket`,
    paragraphs: [`${formatNaira(input.amount)} of fresh fruit and veg from BasketNG, on them.`],
    quote: input.message ?? undefined,
    button: { href: input.link, label: "Open your gift" },
    finePrint: ["Open it, pick what you'd like, and we'll bring it to your door in Lagos."],
  });
}
