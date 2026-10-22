import { NextResponse } from "next/server";
import { writeForCaller } from "@/lib/cart";
import { OrderError } from "@/lib/order-container";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const MAX_QTY = 100_000;

/**
 * Change one line in what the caller is filling: a guest's cart, or a
 * signed-in customer's active delivery. `mode: "add"` adds on top.
 */
export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`cart:ip:${ip}`, 120, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: { productId?: unknown; quantity?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId : "";
  const quantity = typeof body.quantity === "number" && Number.isFinite(body.quantity) ? Math.min(MAX_QTY, Math.trunc(body.quantity)) : NaN;
  const mode = body.mode === "add" ? "add" : "set";
  if (!productId || Number.isNaN(quantity)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    return NextResponse.json(await writeForCaller(productId, quantity, mode));
  } catch (err) {
    // Sold out or discontinued: say so, in words the customer can act on.
    return NextResponse.json({ error: err instanceof OrderError ? err.message : "That couldn't be added just now. Try again." }, { status: 409 });
  }
}
