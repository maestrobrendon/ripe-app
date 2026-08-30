import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCart, cartViewForCart } from "@/lib/cart";

export async function POST(request: Request) {
  const { productId, quantity } = (await request.json()) as {
    productId: string;
    quantity: number;
  };

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const cart = await getOrCreateCart();

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  } else {
    // Snap to the product's order unit: never below the minimum, always on-step.
    const above = Math.max(0, quantity - product.minOrderQty);
    const snapped =
      product.minOrderQty + Math.ceil(above / product.stepQty) * product.stepQty;
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: snapped },
      create: { cartId: cart.id, productId, quantity: snapped },
    });
  }

  return NextResponse.json(await cartViewForCart(cart.id));
}
