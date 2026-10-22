import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffContext } from "@/lib/admin/session";
import { auditStaff, needsStepUp } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { rateLimitShared } from "@/lib/rate-limit-db";

/*
 * Everything Basket holds about one customer, as a JSON download, for a data
 * access request. Same gate as an action (session, second factor, permission,
 * fresh step-up), plus: same-origin requests only, rate-limited, audited.
 * HEAD answers whether a GET would be allowed (428 = confirm it's you first).
 */

async function gate(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return { status: 403 as const };
  const ctx = await getStaffContext();
  if (!ctx || !ctx.session.mfaVerifiedAt || ctx.staff.status !== "ACTIVE") return { status: 401 as const };
  if (!can(ctx.staff.role as Role, "customers.export")) return { status: 403 as const };
  if (needsStepUp(ctx, "customers.export")) return { status: 428 as const };
  return { status: 200 as const, ctx };
}

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function HEAD(req: NextRequest) {
  const g = await gate(req);
  return new NextResponse(null, { status: g.status, headers });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g.status !== 200) return new NextResponse(null, { status: g.status, headers });
  const { ctx } = g;
  if (!(await rateLimitShared(`admin-export:${ctx.staff.id}`, 10, 60 * 60 * 1000)).ok) return new NextResponse(null, { status: 429, headers });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: id.slice(0, 40) },
    omit: { passwordHash: true },
    include: {
      subscriptionTier: { select: { name: true, monthlyFee: true } },
      deliveryZone: { select: { name: true } },
      preferences: true,
      streak: true,
      orders: { include: { items: { include: { product: { select: { name: true } } } }, events: true, credits: true } },
      baskets: { include: { items: { include: { product: { select: { name: true } } } } } },
      savedRecipes: { include: { recipe: { select: { title: true } } } },
      weeklyMealPlans: true,
      ownMeals: true,
      producePlans: true,
      assistantThreads: { include: { messages: true } },
      planRequests: { include: { tier: { select: { name: true } } } },
      credits: true,
      notes: { select: { body: true, createdAt: true } },
    },
  });
  if (!user) return new NextResponse(null, { status: 404, headers });

  await auditStaff(ctx, { action: "customers.exported", targetType: "User", targetId: user.id, summary: "Downloaded the customer's data" });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: "Basket", customer: user }, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return new NextResponse(body, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="basket-customer-${user.id}.json"`,
    },
  });
}
