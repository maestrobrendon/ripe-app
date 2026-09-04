import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planFromText, planSurprise } from "@/lib/meal-planner";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`plan:ip:${ip}`, 40, 60 * 1000).ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: {
    mode?: unknown;
    text?: unknown;
    preferenceId?: unknown;
    budgetBandId?: unknown;
    servings?: unknown;
    excludeSlug?: unknown;
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
      : undefined;

  let plan = null;
  if (body.mode === "text" && typeof body.text === "string") {
    plan = planFromText(body.text.slice(0, 200), products);
  } else if (body.mode === "surprise") {
    plan = planSurprise(
      {
        preferenceId: typeof body.preferenceId === "string" ? body.preferenceId : undefined,
        budgetBandId: typeof body.budgetBandId === "string" ? body.budgetBandId : undefined,
        excludeSlug: typeof body.excludeSlug === "string" ? body.excludeSlug : undefined,
        servings,
      },
      products,
    );
  }

  return NextResponse.json({ plan });
}
