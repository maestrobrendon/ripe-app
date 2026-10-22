import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUYABLE, snapQuantity } from "@/lib/product";
import { getOrCreateCart, cartViewForCart, readCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import { addLinesToDelivery, getOrCreateActiveDelivery } from "@/lib/order-container";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const MAX_ITEMS = 30;
const MAX_QTY = 100_000;

/** Add several products on top of what the caller is filling (a guest's cart or the active delivery). */
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

  const wanted = (Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [])
    .map((it) => it as { productId?: unknown; quantity?: unknown })
    .filter((it): it is { productId: string; quantity: number } => typeof it.productId === "string" && typeof it.quantity === "number" && Number.isFinite(it.quantity) && it.quantity > 0)
    .map((it) => ({ productId: it.productId, quantity: Math.min(MAX_QTY, Math.trunc(it.quantity)) }));
  if (wanted.length === 0) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  const user = await getCurrentUser();
  if (user) {
    const delivery = await getOrCreateActiveDelivery(user);
    await addLinesToDelivery(delivery.id, wanted);
    return NextResponse.json(await readCart());
  }

  const products = await prisma.product.findMany({ where: { id: { in: wanted.map((w) => w.productId) }, ...BUYABLE } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const cart = await getOrCreateCart();
  for (const { productId, quantity } of wanted) {
    const product = byId.get(productId);
    if (!product) continue;
    const existing = cart.items.find((i) => i.productId === productId)?.quantity ?? 0;
    const next = snapQuantity(existing + quantity, product);
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: next },
      create: { cartId: cart.id, productId, quantity: next },
    });
  }
  return NextResponse.json(await cartViewForCart(cart.id));
}
