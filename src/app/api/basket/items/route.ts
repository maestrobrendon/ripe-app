import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateStandingBasket, getStandingBasketView } from "@/lib/basket";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "You need to sign up before building a basket." }, { status: 401 });
  }

  const { productId, quantity } = (await request.json()) as { productId: string; quantity: number };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const basket = await getOrCreateStandingBasket(userId, user.deliveryDay);

  if (quantity <= 0) {
    await prisma.basketItem.deleteMany({ where: { basketId: basket.id, productId } });
  } else {
    await prisma.basketItem.upsert({
      where: { basketId_productId: { basketId: basket.id, productId } },
      update: { quantity },
      create: { basketId: basket.id, productId, quantity },
    });
  }

  const view = await getStandingBasketView(userId);
  if (!view) return NextResponse.json({ error: "Basket not found" }, { status: 404 });

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
