import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditStaff } from "@/lib/admin/guard";
import { DOWNLOAD_HEADERS, gateDownload } from "@/lib/admin/download-gate";
import { toCsv } from "@/lib/admin/csv";
import { orderToStock } from "@/lib/stock-core";
import { parseYmd } from "@/lib/delivery-dates";

/*
 * Report downloads for the accounts. reports.export with step-up; audited.
 * Orders and refunds carry no contact details (no phone, email or address):
 * they're for the books, not for reaching people.
 */

const DAY = 86_400_000;
const KINDS = ["orders", "refunds", "products", "members"] as const;
type Kind = (typeof KINDS)[number];

function range(req: NextRequest): { from: Date; to: Date } {
  const to = parseYmd(req.nextUrl.searchParams.get("to")) ?? new Date(Math.floor(Date.now() / DAY) * DAY);
  const fromRaw = parseYmd(req.nextUrl.searchParams.get("from")) ?? new Date(to.getTime() - 29 * DAY);
  // At most about a year and a month per file; the day "to" counts in full (Lagos).
  const from = new Date(Math.max(fromRaw.getTime(), to.getTime() - 400 * DAY) - 3_600_000);
  return { from, to: new Date(to.getTime() + DAY - 3_600_000) };
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");

async function build(kind: Kind, req: NextRequest): Promise<{ csv: string; rows: number }> {
  const { from, to } = range(req);
  if (kind === "orders") {
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: "asc" },
      take: 20_000,
      select: { id: true, createdAt: true, deliveryDate: true, status: true, orderType: true, zoneName: true, subtotal: true, deliveryFee: true, total: true, paymentMethod: true, paidAt: true, _count: { select: { items: true } }, credits: { select: { amount: true } } },
    });
    return {
      rows: orders.length,
      csv: toCsv(
        ["order", "placed", "delivery_date", "status", "type", "area", "lines", "subtotal", "delivery_fee", "total", "refunded", "payment", "paid_at"],
        orders.map((o) => [
          o.id.slice(-8).toUpperCase(), iso(o.createdAt), o.deliveryDate.toISOString().slice(0, 10), o.status, o.orderType, o.zoneName, o._count.items,
          o.subtotal, o.deliveryFee, o.total, o.credits.reduce((s, c) => s + c.amount, 0), o.paymentMethod, iso(o.paidAt),
        ]),
      ),
    };
  }
  if (kind === "refunds") {
    const credits = await prisma.creditRecord.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "asc" }, take: 20_000 });
    return {
      rows: credits.length,
      csv: toCsv(["date", "kind", "order", "amount", "method", "reason", "recorded_by"], credits.map((c) => [iso(c.createdAt), c.kind, c.orderId ? c.orderId.slice(-8).toUpperCase() : "", c.amount, c.method, c.reason, c.staffName])),
    };
  }
  if (kind === "products") {
    const rows = await prisma.$queryRaw<{ name: string; slug: string; soldAs: string; referenceWeightG: number | null; qty: bigint; revenue: bigint; orders: bigint }[]>`
      SELECT p.name, p.slug, p."soldAs", p."referenceWeightG", sum(oi.quantity) AS qty, sum(oi.quantity * oi."unitPrice") AS revenue, count(DISTINCT o.id) AS orders
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
      WHERE o."createdAt" >= ${from} AND o."createdAt" < ${to} AND o."paidAt" IS NOT NULL AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY p.id ORDER BY revenue DESC`;
    return {
      rows: rows.length,
      csv: toCsv(
        ["product", "slug", "quantity", "unit", "orders", "revenue"],
        rows.map((r) => {
          const stock = orderToStock(Number(r.qty), r);
          return [r.name, r.slug, r.soldAs === "WEIGHT" ? stock / 1000 : stock, r.soldAs === "WEIGHT" ? "kg" : "items", Number(r.orders), Number(r.revenue)];
        }),
      ),
    };
  }
  // members: who is on which plan, for reconciling plan payments. No contact details.
  const members = await prisma.user.findMany({
    where: { subscriptionTierId: { not: null }, erasedAt: null },
    orderBy: { subscribedAt: "asc" },
    select: { id: true, name: true, subscribedAt: true, subscriptionTier: { select: { name: true, monthlyFee: true } } },
  });
  return {
    rows: members.length,
    csv: toCsv(["customer_ref", "name", "plan", "monthly_fee", "member_since"], members.map((m) => [m.id.slice(-8).toUpperCase(), m.name, m.subscriptionTier?.name, m.subscriptionTier?.monthlyFee, iso(m.subscribedAt)])),
  };
}

async function handle(req: NextRequest, kindRaw: string, head: boolean) {
  const g = await gateDownload(req, "reports.export");
  if ("status" in g) return new NextResponse(null, { status: g.status, headers: DOWNLOAD_HEADERS });
  if (!(KINDS as readonly string[]).includes(kindRaw)) return new NextResponse(null, { status: 404, headers: DOWNLOAD_HEADERS });
  if (head) return new NextResponse(null, { status: 200, headers: DOWNLOAD_HEADERS });
  const kind = kindRaw as Kind;
  const { csv, rows } = await build(kind, req);
  const q = req.nextUrl.searchParams;
  await auditStaff(g.ctx, { action: "reports.exported", summary: `Exported ${kind} (${rows} rows)${kind !== "members" ? ` ${q.get("from") ?? ""}–${q.get("to") ?? ""}` : ""}` });
  return new NextResponse(csv, {
    headers: { ...DOWNLOAD_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="basket-${kind}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  return handle(req, (await params).kind, true);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  return handle(req, (await params).kind, false);
}
