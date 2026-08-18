import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ items: [], memberSubtotal: 0, marketSubtotal: 0, deliveryDay: null });

  const view = await getStandingBasketView(userId);
  if (!view) return NextResponse.json({ items: [], memberSubtotal: 0, marketSubtotal: 0, deliveryDay: null });

  return NextResponse.json({
    items: view.basket.items.map((i) => ({
      productId: i.productId,
      slug: i.product.slug,
      name: i.product.name,
      unit: i.product.unit,
      imageEmoji: i.product.imageEmoji,
      memberPrice: i.product.memberPrice,
      marketPrice: i.product.marketPrice,
      quantity: i.quantity,
    })),
    memberSubtotal: view.memberSubtotal,
    marketSubtotal: view.marketSubtotal,
    deliveryDay: view.basket.deliveryDay,
  });
}
