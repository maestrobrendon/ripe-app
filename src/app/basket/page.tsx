import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { prisma } from "@/lib/prisma";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { BasketEditor } from "./basket-editor";

export default async function BasketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/subscribe");

  const view = await getStandingBasketView(user.id);
  const recommended = await prisma.product.findMany({ where: { featured: true }, take: 6 });

  const items =
    view?.basket.items.map((i) => ({
      productId: i.productId,
      slug: i.product.slug,
      name: i.product.name,
      unit: i.product.unit,
      imageEmoji: i.product.imageEmoji,
      memberPrice: i.product.memberPrice,
      marketPrice: i.product.marketPrice,
      quantity: i.quantity,
    })) ?? [];

  const memberSubtotal = view?.memberSubtotal ?? 0;
  const marketSubtotal = view?.marketSubtotal ?? 0;
  const deliveryDay = view?.basket.deliveryDay ?? user.deliveryDay;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-semibold">Your standing basket</h1>
          <p className="mt-1 text-sm text-muted">
            This repeats automatically every {DELIVERY_DAY_LABEL[deliveryDay]}. Edit it any time before your
            delivery cutoff.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="text-muted">Running basket value</p>
          <p className="text-2xl font-semibold">{formatNaira(memberSubtotal)}</p>
          {marketSubtotal > memberSubtotal && (
            <p className="text-xs text-ripe-terracotta-dark">
              vs {formatNaira(marketSubtotal)} at the market, on {user.subscriptionTier.name}
            </p>
          )}
        </div>
      </div>

      <BasketEditor
        items={items}
        deliveryDay={deliveryDay}
        recommended={recommended.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          unit: p.unit,
          imageEmoji: p.imageEmoji,
          memberPrice: p.memberPrice,
          marketPrice: p.marketPrice,
        }))}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <Link href="/assistant" className="text-sm font-medium text-ripe-green underline">
          Get suggestions from the trained assistant
        </Link>
        <Link
          href="/checkout"
          className="rounded-full bg-ripe-terracotta px-6 py-3 text-sm font-medium text-white hover:bg-ripe-terracotta-dark"
        >
          Continue to checkout
        </Link>
      </div>
    </div>
  );
}
