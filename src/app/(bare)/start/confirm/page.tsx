import { redirect } from "next/navigation";
import { creditBalance } from "@/lib/credit";
import { paystackReady } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isMember, ownedDelivery, priceFor } from "@/lib/order-container";
import { getDeliveryCycle, zoneForUser } from "@/lib/delivery";
import { confirmRight } from "@/lib/basket-rules";
import { hasFreeDelivery, quoteDelivery } from "@/lib/pricing";
import { getSiteSettings } from "@/lib/site-settings";
import { transferReady } from "@/lib/site-settings-schema";
import { isBuyable } from "@/lib/product";
import { DELIVERY_WINDOW, longDate, quantityLabel } from "@/lib/delivery-labels";
import { getLogistics, zoneFee } from "@/lib/delivery-logistics";
import { ConfirmFlow } from "./confirm-flow";

// The same bare, step-by-step look as sign-up.
import "../../home-menu/home-menu.css";

export const metadata = { title: "Your basket. BasketNG" };

/**
 * Straight after the account is made: their basket and paying for it, then
 * where it goes. One thing per screen, in the same flow as sign-up. "Pay
 * later" leaves it saved and takes them into their account.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");
  const { b } = await searchParams;

  const basket = (await ownedDelivery(user.id, b)) ?? (await prisma.basket.findFirst({ where: { userId: user.id, oneOff: false, items: { some: {} } }, orderBy: { createdAt: "asc" } }));
  const [zone, right, settings] = await Promise.all([zoneForUser(user.id), confirmRight(user), getSiteSettings()]);
  if (!basket || !zone || !right.ok) redirect("/basket");

  const cycle = await getDeliveryCycle(basket, zone);
  if (!cycle.date || !cycle.cutoff) redirect("/basket");

  const items = await prisma.basketItem.findMany({ where: { basketId: basket.id }, include: { product: true }, orderBy: { product: { name: "asc" } } });
  const member = isMember(user);
  const lines = items.filter((i) => isBuyable(i.product));
  if (!lines.length) redirect("/basket");

  const subtotal = lines.reduce((s, i) => s + priceFor(i.product, member) * i.quantity, 0);
  // The area's fee (by distance from the depot when Logistics prices that way); the address comes after paying.
  const fee = quoteDelivery(subtotal, hasFreeDelivery(user.subscriptionTier?.slug), zoneFee(zone, await getLogistics()), settings.delivery.freeThreshold).fee;
  const transfer = transferReady(settings.transfer) ? settings.transfer : null;
  // A gift or a reward they already have comes off this first basket.
  const credit = Math.min(await creditBalance(user.id), subtotal + fee);

  return (
    <ConfirmFlow
      basketId={basket.id}
      firstName={user.name.trim().split(/\s+/)[0] || "there"}
      contact={{ name: user.name, email: user.email ?? "", phone: user.phone ?? "" }}
      lines={lines.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        amount: quantityLabel(i.quantity, i.product.unit),
        total: priceFor(i.product, member) * i.quantity,
        publicId: i.product.cloudinaryPublicId,
        emoji: i.product.imageEmoji,
      }))}
      subtotal={subtotal}
      fee={fee}
      credit={credit}
      when={`${longDate(cycle.date)}, ${DELIVERY_WINDOW}`}
      zone={{ id: zone.id, name: zone.name }}
      online={paystackReady()}
      transfer={transfer ? { bankName: transfer.bankName, accountNumber: transfer.accountNumber, accountName: transfer.accountName } : null}
      reference={`BSK-${basket.id.slice(-6).toUpperCase()}`}
    />
  );
}
