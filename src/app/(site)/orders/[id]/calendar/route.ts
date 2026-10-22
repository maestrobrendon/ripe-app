import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { orderRef } from "@/lib/delivery-labels";
import { appOrigin } from "@/lib/site";

/*
 * "Add to calendar" for a confirmed delivery: an .ics file for the 9am to 5pm
 * window, with what to pay and a reminder an hour before. Phones open it
 * straight into their calendar. Same access rule as the order page.
 */

const tokenMatches = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** iCalendar text: escape commas, semicolons, backslashes and newlines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(request.url).searchParams.get("t");
  const [order, user] = await Promise.all([
    prisma.order.findUnique({ where: { id }, select: { id: true, userId: true, accessToken: true, deliveryDate: true, total: true, address: true, paidAt: true, basket: { select: { name: true } } } }),
    getCurrentUser(),
  ]);
  const allowed = order && ((user && order.userId === user.id) || (t && tokenMatches(t, order.accessToken)));
  if (!order || !allowed) return new Response("Not found", { status: 404 });

  // Delivery dates are stored as the Lagos day at midnight UTC; Lagos is UTC+1, so 9am to 5pm is 08:00 to 16:00 UTC.
  const start = new Date(order.deliveryDate.getTime() + 8 * 3_600_000);
  const end = new Date(order.deliveryDate.getTime() + 16 * 3_600_000);
  const ref = orderRef(order.id);
  const title = order.basket?.name?.trim() ? `Basket delivery: ${order.basket.name.trim()}` : "Basket delivery";
  const pay = order.paidAt ? "Paid." : `Pay ${formatNaira(order.total)} when it arrives.`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Basket//Delivery//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${order.id}@basket`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Order ${ref}. ${pay} Delivered between 9am and 5pm.`)}`,
    `LOCATION:${esc(order.address)}`,
    `URL:${appOrigin()}/orders/${order.id}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("Your Basket arrives today")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="basket-${ref.slice(1).toLowerCase()}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
