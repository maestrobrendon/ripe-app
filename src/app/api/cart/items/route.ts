import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCart, cartViewForCart, setCartItemQuantity } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const MAX_QTY = 100_000;

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`cart:ip:${ip}`, 120, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: { productId?: unknown; quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId : "";
  const quantity =
    typeof body.quantity === "number" && Number.isFinite(body.quantity)
      ? Math.min(MAX_QTY, Math.trunc(body.quantity))
      : NaN;

  if (!productId || Number.isNaN(quantity)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const cart = await getOrCreateCart();
  await setCartItemQuantity(cart.id, productId, quantity);

  return NextResponse.json(await cartViewForCart(cart.id));
}
