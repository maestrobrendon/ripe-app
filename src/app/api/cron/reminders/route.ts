import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getDeliveryCycle, zoneForUser } from "@/lib/delivery";
import { cutoffLabel, longDate, orderPhrase } from "@/lib/delivery-labels";
import { ymd } from "@/lib/delivery-dates";
import { isBuyable } from "@/lib/product";
import { priceFor } from "@/lib/order-container";
import { formatNaira } from "@/lib/format";
import { appOrigin } from "@/lib/site";

/*
 * The weekly reminder, run once a day by Vercel Cron (vercel.json). Nothing
 * is ever ordered for a customer: on the morning a delivery closes, anyone
 * with "Remind me each week" on and items waiting gets one message saying
 * it closes today and what's in it. One per delivery per date (dedupeKey),
 * however often this runs. Email sends now; WhatsApp is logged until a
 * provider is connected (lib/notify.ts).
 */

const WINDOW_MS = 30 * 3_600_000;
const LIVE = { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] };

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const now = Date.now();
  const deliveries = await prisma.basket.findMany({
    where: { isStanding: true, items: { some: {} }, user: { erasedAt: null, suspendedAt: null, deletionRequestedAt: null } },
    include: {
      items: { include: { product: true } },
      user: { select: { id: true, name: true, email: true, phone: true, subscriptionTierId: true } },
    },
  });

  let sent = 0;
  for (const d of deliveries) {
    const zone = await zoneForUser(d.userId);
    const cycle = await getDeliveryCycle(d, zone);
    if (!cycle.date || !cycle.cutoff) continue;
    const left = cycle.cutoff.getTime() - now;
    if (left <= 0 || left > WINDOW_MS) continue;
    // Already confirmed for that date: nothing to remind about.
    if (await prisma.order.count({ where: { basketId: d.id, deliveryDate: cycle.date, status: LIVE } })) continue;

    const lines = d.items.filter((i) => isBuyable(i.product));
    if (!lines.length) continue;
    const member = Boolean(d.user.subscriptionTierId);
    const total = lines.reduce((s, i) => s + priceFor(i.product, member) * i.quantity, 0);
    const first = d.user.name?.split(" ")[0] ?? "there";
    const phrase = orderPhrase(d, cycle.day);
    const names = lines.slice(0, 4).map((i) => i.product.name).join(", ") + (lines.length > 4 ? ` and ${lines.length - 4} more` : "");
    const link = `${appOrigin()}/basket`;
    const text = `Hi ${first}, ${phrase} for ${longDate(cycle.date)} closes ${cutoffLabel(cycle.cutoff)}. It has ${names}, about ${formatNaira(total)} before delivery. Confirm it, change it or skip the week: ${link}`;

    await notify({
      userId: d.user.id,
      kind: "reminder.cutoff",
      dedupeKey: `reminder:${d.id}:${ymd(cycle.date)}`,
      email: { to: d.user.email, subject: `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} closes ${cutoffLabel(cycle.cutoff)}`, text: `${text}\n\nNothing is ordered until you confirm. You can turn these reminders off from the ⋯ menu on Home.` },
      whatsapp: { to: d.user.phone, text: `Basket: ${text}` },
    }).catch(() => {});
    sent++;
  }

  return NextResponse.json({ checked: deliveries.length, reminded: sent });
}
