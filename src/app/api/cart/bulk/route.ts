import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCart, cartViewForCart } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const MAX_ITEMS = 30;
const MAX_QTY = 100_000;

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`cartbulk:ip:${ip}`, 30, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const raw = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  const wanted = raw
    .map((it) => it as { productId?: unknown; quantity?: unknown })
    .filter(
      (it): it is { productId: string; quantity: number } =>
        typeof it.productId === "string" &&
        typeof it.quantity === "number" &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0,
    )
    .map((it) => ({ productId: it.productId, quantity: Math.min(MAX_QTY, Math.trunc(it.quantity)) }));

  if (wanted.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: wanted.map((w) => w.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const cart = await getOrCreateCart();

  for (const { productId, quantity } of wanted) {
    const product = byId.get(productId);
    if (!product) continue;
    const above = Math.max(0, quantity - product.minOrderQty);
    const snapped = product.minOrderQty + Math.ceil(above / product.stepQty) * product.stepQty;

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: (existing?.quantity ?? 0) + snapped },
      create: { cartId: cart.id, productId, quantity: snapped },
    });
  }

  return NextResponse.json(await cartViewForCart(cart.id));
}
