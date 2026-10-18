import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readCart } from "@/lib/cart";
import { isMember, ownedDelivery, priceFor, readActiveDelivery } from "@/lib/order-container";
import { dayIn, getDeliveryCycle } from "@/lib/delivery";
import { cutoffFor, nextDeliveryDate } from "@/lib/delivery-dates";
import { quantityLabel } from "@/lib/delivery-labels";
import { hasFreeDelivery } from "@/lib/pricing";
import { isBuyable } from "@/lib/product";
import { formatPhone } from "@/lib/phone";
import { listAddresses, addressLine } from "@/lib/addresses";
import { creditBalance } from "@/lib/credit";
import { confirmRight } from "@/lib/basket-rules";
import { basketName } from "@/lib/delivery-labels";
import { getSiteSettings } from "@/lib/site-settings";
import { transferReady } from "@/lib/site-settings-schema";
import { LinkButton } from "@/components/ui/button";
import { CheckoutFlow } from "./checkout-flow";

/*
 * Confirming an order: one page, filled in already. It reads the delivery
 * itself (never a cart), prices it here, and shows the real date for the
 * address picked. A guest with a cart is asked to sign in first; their cart
 * becomes their order when they do.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    const cart = await readCart();
    if (cart.items.length === 0) redirect("/cart");
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-heading-lg">Sign in to order</h1>
        <p className="mt-3 text-sm text-muted">Your cart is saved and comes with you. It takes a minute, and you pay when it arrives.</p>
        <div className="mt-6 flex flex-col gap-3">
          <LinkButton href="/start?next=/checkout" size="lg">
            Create an account
          </LinkButton>
          <Link href="/login?next=/checkout" className="text-sm font-medium text-carbon underline">
            I have an account
          </Link>
        </div>
      </div>
    );
  }

  const basket = (await ownedDelivery(user.id, b)) ?? (await readActiveDelivery(user.id));
  if (!basket) redirect("/basket");

  // A free account confirms one trial basket; after that, it's membership that keeps baskets coming.
  if (!(await confirmRight(user)).ok) {
    return (
      <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
        <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
          <p className="text-4xl" aria-hidden>
            🧺
          </p>
          <h1 className="mt-4 text-[28px] leading-tight font-bold tracking-[-0.02em]">Keep your basket coming</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Your trial basket has been used. Members get their baskets every week at member prices, with a reminder before each delivery. Nothing is ever charged automatically.
          </p>
          <div className="mt-6 grid gap-2.5">
            <LinkButton href="/subscribe" size="lg" className="flex justify-center">
              See membership
            </LinkButton>
            <Link href="/basket" className="text-sm font-semibold underline underline-offset-2">
              Back to your basket
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [items, addresses, zones, credit, settings] = await Promise.all([
    prisma.basketItem.findMany({ where: { basketId: basket.id }, include: { product: true }, orderBy: { product: { name: "asc" } } }),
    listAddresses(user.id),
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" } }),
    creditBalance(user.id),
    getSiteSettings(),
  ]);

  const member = isMember(user);
  const lines = items.filter((i) => isBuyable(i.product));
  if (!lines.length) redirect("/basket");
  const leftOut = items.filter((i) => !isBuyable(i.product)).map((i) => i.product.name);

  // The date depends on the area, so each saved address carries its own.
  const savedAddresses = await Promise.all(
    addresses.map(async (a) => {
      const cycle = a.zone.isServed ? await getDeliveryCycle(basket, a.zone) : null;
      return {
        id: a.id,
        label: a.label,
        line: addressLine(a),
        landmark: a.landmark,
        isDefault: a.isDefault,
        zone: { id: a.zone.id, name: a.zone.name, served: a.zone.isServed, fee: a.zone.deliveryFee },
        dateIso: cycle?.date?.toISOString() ?? null,
        cutoffIso: cycle?.cutoff?.toISOString() ?? null,
      };
    }),
  );
  const zoneOptions = zones.map((z) => {
    const date = nextDeliveryDate(dayIn(z, basket.deliveryDay), z.cutoffHour);
    return { id: z.id, name: z.name, area: z.area, fee: z.deliveryFee, dateIso: date.toISOString(), cutoffIso: cutoffFor(date, z.cutoffHour).toISOString() };
  });

  const subtotal = lines.reduce((s, i) => s + priceFor(i.product, member) * i.quantity, 0);
  const standard = lines.reduce((s, i) => s + i.product.standardPrice * i.quantity, 0);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
      <BackButton fallback="/basket" label="Your basket" />
      <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">{basket.oneOff ? "Confirm your one-time order" : basket.name?.trim() ? `Confirm ${basketName(basket)}` : "Confirm your basket"}</h1>
      <p className="mt-1 text-[15px] text-muted">Nothing is charged automatically. You pay when it arrives.</p>

      <CheckoutFlow
        basketId={basket.id}
        oneOff={basket.oneOff}
        lines={lines.map((i) => ({
          productId: i.productId,
          name: i.product.name,
          quantity: quantityLabel(i.quantity, i.product.unit),
          total: priceFor(i.product, member) * i.quantity,
          emoji: i.product.imageEmoji,
          publicId: i.product.cloudinaryPublicId,
        }))}
        leftOut={leftOut}
        subtotal={subtotal}
        memberSaving={member ? standard - subtotal : 0}
        freePlan={hasFreeDelivery(user.subscriptionTier?.slug)}
        freeThreshold={settings.delivery.freeThreshold}
        addresses={savedAddresses}
        zones={zoneOptions}
        contact={{ name: user.name ?? "", phone: user.phone ? formatPhone(user.phone) : "", email: user.email ?? "" }}
        credit={credit}
        transfer={transferReady(settings.transfer) ? settings.transfer : null}
        draftDefaults={{ line1: user.address ?? "", zoneId: zones.some((z) => z.id === user.deliveryZoneId) ? user.deliveryZoneId : null }}
      />
    </div>
    </div>
  );
}
