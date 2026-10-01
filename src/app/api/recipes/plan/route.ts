import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  planFromText,
  planFromGoal,
  planThisWeek,
  planFromCartSlugs,
  type PlanResponse,
} from "@/lib/produce-planner";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  GUEST_CAP_COOKIE,
  GUEST_FREE_USES_PER_DAY,
  readGuestPlannerUseCount,
  nextGuestPlannerCookieValue,
} from "@/lib/planner-cap";

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`plan:ip:${ip}`, 40, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  const user = await getCurrentUser();
  const usedBefore = user ? 0 : await readGuestPlannerUseCount();

  if (!user && usedBefore >= GUEST_FREE_USES_PER_DAY) {
    return NextResponse.json({ locked: true, usesLeft: 0 });
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

  let result: PlanResponse;
  if (body.mode === "week") {
    result = { plan: planThisWeek(servings, products) };
  } else if (body.mode === "cart") {
    const slugs = Array.isArray(body.cartSlugs)
      ? body.cartSlugs.filter((s): s is string => typeof s === "string").slice(0, 50)
      : [];
    result = { plan: planFromCartSlugs(slugs, servings, products) };
  } else if (body.mode === "goal" && typeof body.goalId === "string") {
    result = { plan: planFromGoal(body.goalId, servings, products) };
  } else if (body.mode === "text" && typeof body.text === "string") {
    result = planFromText(body.text.slice(0, 200), products);
  } else {
    result = { plan: null };
  }

  const usesLeft = user ? null : Math.max(0, GUEST_FREE_USES_PER_DAY - usedBefore - 1);
  const response = NextResponse.json({ ...result, usesLeft });

  if (!user) {
    response.cookies.set(GUEST_CAP_COOKIE, nextGuestPlannerCookieValue(usedBefore), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 2,
    });
  }

  return response;
}
