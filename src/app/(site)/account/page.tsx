import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SUPPORT_WHATSAPP } from "@/lib/site";
import { customerStatusLabel, OPEN_STATUSES } from "@/lib/order-status";
import { AccountView, type OrderRow } from "./account-view";


function shortDate(d: Date) {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${weekday}, ${rest}`;
}

/** The next monthly anniversary of the membership start, from today. */
function nextRenewal(start: Date) {
  const now = new Date();
  const d = new Date(start);
  while (d <= now) d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [zones, orders, cheapestTier] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    // Baskets and cart orders together, newest first: one list, filtered on the page.
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, orderType: true, status: true, deliveryDate: true, total: true, _count: { select: { items: true } } },
    }),
    prisma.subscriptionTier.findFirst({ orderBy: { monthlyFee: "asc" }, select: { monthlyFee: true } }),
  ]);

  const orderRows: OrderRow[] = orders.map((o) => {
    const kind = o.orderType === "ONE_OFF" ? "cart" : "basket";
    const live = OPEN_STATUSES.includes(o.status);
    return {
      id: o.id,
      kind,
      name: kind === "basket" ? "Basket order" : `Cart order, ${o._count.items} ${o._count.items === 1 ? "item" : "items"}`,
      when: `${live ? "Arrives" : o.status === "DELIVERED" ? "Delivered" : "Was due"} ${shortDate(o.deliveryDate)}`,
      total: o.total,
      status: customerStatusLabel(o.status),
      live,
    };
  });

  const tier = user.subscriptionTier;

  return (
    <AccountView
      name={user.name}
      email={user.email ?? ""}
      phone={user.phone ?? ""}
      address={user.address ?? ""}
      zoneSlug={user.deliveryZone?.slug ?? ""}
      zoneName={user.deliveryZone?.name ?? ""}
      zones={zones}
      card={
        user.paymentCardLast4
          ? { brand: user.paymentCardBrand ?? "CARD", last4: user.paymentCardLast4, expiry: user.paymentCardExpiry ?? "" }
          : null
      }
      adults={user.householdAdults}
      kids={user.householdKids}
      goal={user.preferences?.primaryGoal ?? ""}
      likes={user.preferences?.producePreferences ?? []}
      membership={
        tier
          ? { tierName: tier.name, monthlyFee: tier.monthlyFee, renews: user.subscribedAt ? nextRenewal(user.subscribedAt) : null }
          : null
      }
      cheapestPlan={cheapestTier?.monthlyFee ?? null}
      orders={orderRows}
      whatsappHref={`https://wa.me/${SUPPORT_WHATSAPP}`}
    />
  );
}
