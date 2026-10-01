import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respondToMessage } from "@/lib/recipe-assistant";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`recipe-assistant:ip:${ip}`, 40, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: { message?: unknown; servings?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
  const servings =
    typeof body.servings === "number" && body.servings >= 1 && body.servings <= 20
      ? Math.trunc(body.servings)
      : null;

  const products = await prisma.product.findMany();
  const reply = respondToMessage(message, servings, products);
  return NextResponse.json(reply);
}
