import "server-only";
import { sendEmail } from "@/lib/email";
import { formatNaira } from "@/lib/format";
import { appOrigin } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { supportHref, whatsappReady } from "@/lib/support";
import type { OrderStatus } from "@/generated/prisma/enums";

/*
 * Emails customers get about their orders and plan. Short, plain, one job
 * each. Every function swallows delivery failures: an email that doesn't go
 * out must never undo the order or status change that triggered it.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });


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

async function wrap(lines: string[], link?: { href: string; label: string }) {
  const { support } = await getSiteSettings();
  const help = whatsappReady(support) ? `Questions? Reply to this email or message us on WhatsApp: ${supportHref(support)}` : "Questions? Just reply to this email.";
  const html = `${lines.map((l) => `<p>${esc(l)}</p>`).join("")}${link ? `<p><a href="${esc(link.href)}">${esc(link.label)}</a></p>` : ""}<p style="color:#666">${esc(help)}</p>`;
  const text = `${lines.join("\n\n")}${link ? `\n\n${link.label}: ${link.href}` : ""}\n\n${help}`;
  return { html, text };
}

async function send(to: string | null, subject: string, body: { html: string; text: string }) {
  if (!to) return;
  await sendEmail({ to, subject, ...body }).catch(() => false);
}

export async function sendOrderConfirmation(o: OrderForEmail & { items: { name: string; quantity: number }[] }) {
  const first = o.customerName.split(/\s+/)[0];
  const list = o.items.slice(0, 12).map((i) => `${i.name} × ${i.quantity}`).join(", ") + (o.items.length > 12 ? ", and more" : "");
  await send(
    o.customerEmail,
    `Order #${o.id.slice(-8).toUpperCase()} confirmed`,
    await wrap(
      [
        `Thanks, ${first}. Your order is in.`,
        `Arriving ${day(o.deliveryDate)} at ${o.address} (${o.zoneName}). Total ${formatNaira(o.total)}.`,
        list,
      ],
      { href: orderLink(o), label: "Track your order" },
    ),
  );
}

const STATUS_COPY: Partial<Record<OrderStatus, (o: OrderForEmail) => { subject: string; lines: string[] }>> = {
  OUT_FOR_DELIVERY: (o) => ({ subject: "Your order is on the way", lines: [`Your order left us and is heading to ${o.zoneName}. Please keep your phone close so the rider can reach you.`] }),
  DELIVERED: () => ({ subject: "Your order was delivered", lines: ["Your order has been delivered. Enjoy cooking with it.", "If anything isn't right, tell us within 7 days from your order page and we'll put it right."] }),
  FAILED_DELIVERY: () => ({ subject: "We missed you", lines: ["We tried to deliver your order but couldn't complete it. We'll contact you to arrange another time."] }),
  CANCELLED: () => ({ subject: "Your order was cancelled", lines: ["Your order has been cancelled and won't be delivered. If you paid, we'll be in touch about your refund."] }),
};

/** Only the moments a customer needs to know about get an email. */
export async function sendOrderStatusEmail(o: OrderForEmail, status: OrderStatus, note?: string | null) {
  const copy = STATUS_COPY[status]?.(o);
  if (!copy) return;
  const lines = note && status === "CANCELLED" ? [...copy.lines, `Reason: ${note}`] : copy.lines;
  await send(o.customerEmail, `${copy.subject} (#${o.id.slice(-8).toUpperCase()})`, await wrap(lines, { href: orderLink(o), label: "See your order" }));
}

export async function sendRefundEmail(o: OrderForEmail, amount: number, method: string) {
  await send(
    o.customerEmail,
    `Refund for order #${o.id.slice(-8).toUpperCase()}`,
    await wrap([`We've refunded ${formatNaira(amount)} for your order, by ${method}.`, "It can take a few working days to show, depending on your bank."], { href: orderLink(o), label: "See your order" }),
  );
}

export async function sendPlanRequestReceived(to: string | null, name: string, tierName: string, monthlyFee: number) {
  await send(
    to,
    `Your ${tierName} request`,
    await wrap(
      [
        `Thanks, ${name.split(/\s+/)[0]}. We've got your request to join ${tierName} (${formatNaira(monthlyFee)} a month).`,
        "We'll email you payment details within one working day. Your plan starts as soon as payment is confirmed, and nothing is charged automatically.",
      ],
      { href: `${appOrigin()}/subscribe`, label: "See your plan" },
    ),
  );
}

export async function sendPlanDecision(to: string | null, name: string, tierName: string, approved: boolean, note?: string | null) {
  const lines = approved
    ? [`You're on ${tierName}, ${name.split(/\s+/)[0]}. Member prices and your weekly basket are ready.`]
    : [`We couldn't start your ${tierName} plan this time.`, ...(note ? [note] : []), "You can keep shopping as you go, and ask again anytime."];
  await send(to, approved ? `Welcome to ${tierName}` : `About your ${tierName} request`, await wrap(lines, { href: `${appOrigin()}/${approved ? "basket" : "subscribe"}`, label: approved ? "Open your basket" : "See plans" }));
}
