import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  planFromText,
  planFromGoal,
  planThisWeek,
  planFromCartSlugs,
} from "@/lib/produce-planner";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`plan:ip:${ip}`, 40, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: {
    mode?: unknown;
    text?: unknown;
    goalId?: unknown;
    servings?: unknown;
    cartSlugs?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const products = await prisma.product.findMany();
  const servings =
    typeof body.servings === "number" && body.servings >= 1 && body.servings <= 20
      ? Math.trunc(body.servings)
      : 3;

  if (body.mode === "week") {
    return NextResponse.json({ plan: planThisWeek(servings, products) });
  }
  if (body.mode === "cart") {
    const slugs = Array.isArray(body.cartSlugs)
      ? body.cartSlugs.filter((s): s is string => typeof s === "string").slice(0, 50)
      : [];
    return NextResponse.json({ plan: planFromCartSlugs(slugs, servings, products) });
  }
  if (body.mode === "goal" && typeof body.goalId === "string") {
    return NextResponse.json({ plan: planFromGoal(body.goalId, servings, products) });
  }
  if (body.mode === "text" && typeof body.text === "string") {
    return NextResponse.json(planFromText(body.text.slice(0, 200), products));
  }

  return NextResponse.json({ plan: null });
}
