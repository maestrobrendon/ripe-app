import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getDeliveryCycle, zoneForUser } from "@/lib/delivery";
import { basketName, cutoffLabel, dayName, longDate } from "@/lib/delivery-labels";
import { lagosDate, ymd } from "@/lib/delivery-dates";
import { isBuyable } from "@/lib/product";
import { priceFor } from "@/lib/order-container";
import { formatNaira } from "@/lib/format";
import { appOrigin } from "@/lib/site";

/*
 * The weekly basket reminders, run every morning by Vercel Cron (vercel.json,
 * 08:00 Lagos). This is what makes a basket "automatic" without ever charging
 * anyone: for every basket that repeats (a member's), with produce in it,
 * whose next delivery isn't confirmed or skipped yet:
 *
 * - three days before the delivery: "your basket is ready, confirm it";
 * - on the day it closes, if still not confirmed: "it closes tonight".
 *
 * Each goes out once per basket per date on WhatsApp, email and the app
 * (lib/notify.ts; WhatsApp and app messages are logged until their providers
 * are connected). A week that isn't confirmed by its cutoff doesn't go out.
 */

const DAY = 86_400_000;
const LIVE = { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] };

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const now = new Date();
  const today = lagosDate(now).getTime();
  const baskets = await prisma.basket.findMany({
    where: { isStanding: true, items: { some: {} }, user: { subscriptionTierId: { not: null }, erasedAt: null, suspendedAt: null, deletionRequestedAt: null } },
    include: {
      items: { include: { product: true } },
      user: { select: { id: true, name: true, email: true, phone: true, subscriptionTierId: true } },
    },
  });

  let ready = 0;
  let lastCall = 0;
  for (const b of baskets) {
    const zone = await zoneForUser(b.userId);
    const cycle = await getDeliveryCycle(b, zone, now);
    if (!cycle.date || !cycle.cutoff) continue;
    if (await prisma.order.count({ where: { basketId: b.id, deliveryDate: cycle.date, status: LIVE } })) continue;

    const daysAway = Math.round((cycle.date.getTime() - today) / DAY);
    const closesToday = lagosDate(cycle.cutoff).getTime() === today;
    const kind = closesToday ? "last-call" : daysAway === 3 ? "ready" : null;
    if (!kind) continue;

    const lines = b.items.filter((i) => isBuyable(i.product));
    if (!lines.length) continue;
    const total = lines.reduce((s, i) => s + priceFor(i.product, true) * i.quantity, 0);
    const first = b.user.name?.split(" ")[0] ?? "there";
    const name = basketName(b);
    const day = `${dayName(cycle.day)} ${longDate(cycle.date).split(" ").slice(1).join(" ")}`;
    const items = lines.slice(0, 4).map((i) => i.product.name).join(", ") + (lines.length > 4 ? ` and ${lines.length - 4} more` : "");
    const link = `${appOrigin()}/checkout?b=${b.id}`;

    const text =
      kind === "ready"
        ? `Hi ${first}, ${name} is ready for ${day}: ${items}, about ${formatNaira(total)}. Confirm and pay by ${cutoffLabel(cycle.cutoff)}. Change or skip it if you need to: ${link}`
        : `Hi ${first}, ${name} for ${day} closes at ${cutoffLabel(cycle.cutoff).split(" ")[1]} today and isn't confirmed yet. Confirm it now to get it: ${link}`;
    const subject = kind === "ready" ? `${name} is ready for ${day}` : `${name} closes today`;

    await notify({
      userId: b.user.id,
      kind: `reminder.${kind}`,
      dedupeKey: `reminder:${kind}:${b.id}:${ymd(cycle.date)}`,
      email: { to: b.user.email, subject, text: `${text}\n\nNothing is ever charged automatically. A week you don't confirm simply doesn't go out.` },
      whatsapp: { to: b.user.phone, text: `Basket: ${text}` },
      push: { title: subject, body: kind === "ready" ? `Confirm and pay by ${cutoffLabel(cycle.cutoff)}.` : "Tap to confirm it now.", url: `/checkout?b=${b.id}` },
    }).catch(() => {});
    if (kind === "ready") ready++;
    else lastCall++;
  }

  return NextResponse.json({ checked: baskets.length, ready, lastCall });
}
