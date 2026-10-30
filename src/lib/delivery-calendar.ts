import { formatNaira } from "@/lib/format";
import { orderRef } from "@/lib/delivery-labels";

/*
 * A delivery as a calendar event, one source for both ways in: the .ics file
 * (Apple Calendar, Outlook) and a Google Calendar link (Android, where an .ics
 * download opens nothing).
 */

type OrderLike = { id: string; deliveryDate: Date; total: number; address: string; paidAt: Date | null; basketName?: string | null };

export function deliveryEvent(o: OrderLike) {
  // Delivery dates are stored as the Lagos day at midnight UTC; Lagos is UTC+1, so 9am to 5pm is 08:00 to 16:00 UTC.
  const start = new Date(o.deliveryDate.getTime() + 8 * 3_600_000);
  const end = new Date(o.deliveryDate.getTime() + 16 * 3_600_000);
  const ref = orderRef(o.id);
  const title = o.basketName?.trim() ? `Basket delivery: ${o.basketName.trim()}` : "Basket delivery";
  const pay = o.paidAt ? "Paid." : `Pay ${formatNaira(o.total)} to confirm it.`;
  return { uid: `${o.id}@basket`, ref, title, start, end, details: `Order ${ref}. ${pay} Delivered between 9am and 5pm.`, location: o.address };
}

/** 20261024T080000Z */
export const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Opens Google Calendar with the event filled in, ready to save. */
export function googleCalendarUrl(e: ReturnType<typeof deliveryEvent>, link: string) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsStamp(e.start)}/${icsStamp(e.end)}`,
    details: `${e.details}\n${link}`,
    location: e.location,
    ctz: "Africa/Lagos",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
