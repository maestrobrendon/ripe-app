import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { deliveryEvent, icsStamp as stamp } from "@/lib/delivery-calendar";
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

/** Lines over 75 characters continue on the next, indented by a space, as calendars expect. */
const fold = (line: string) => (line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n "));

/** iCalendar text: escape commas, semicolons, backslashes and newlines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(request.url).searchParams.get("t");
  const [order, user] = await Promise.all([
    prisma.order.findUnique({ where: { id }, select: { id: true, userId: true, accessToken: true, deliveryDate: true, total: true, address: true, paidAt: true, basket: { select: { name: true } } } }),
    getCurrentUser(),
  ]);
  const allowed = order && ((user && order.userId === user.id) || (t && tokenMatches(t, order.accessToken)));
  if (!order || !allowed) return new Response("Not found", { status: 404 });

  const e = deliveryEvent({ ...order, basketName: order.basket?.name });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Basket//Delivery//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details)}`,
    `LOCATION:${esc(e.location)}`,
    `URL:${appOrigin()}/orders/${order.id}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("Your Basket arrives today")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="basket-${e.ref.slice(1).toLowerCase()}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
