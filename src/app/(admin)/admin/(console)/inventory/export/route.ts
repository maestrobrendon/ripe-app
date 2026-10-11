import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffContext } from "@/lib/admin/session";
import { auditStaff } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { committedByProduct } from "@/lib/stock";

/*
 * Stock as a CSV, for counting sheets and spreadsheets. Same gate as the
 * stock page, same-origin only, audited. Weighed produce is in kg. Cells that
 * a spreadsheet would run as a formula are neutralised.
 */

function cell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return new NextResponse(null, { status: 403 });
  const ctx = await getStaffContext();
  if (!ctx || !ctx.session.mfaVerifiedAt || ctx.staff.status !== "ACTIVE") return new NextResponse(null, { status: 401 });
  if (!can(ctx.staff.role as Role, "inventory.view")) return new NextResponse(null, { status: 403 });

  const [products, committed] = await Promise.all([
    prisma.product.findMany({
      where: { NOT: { tags: { has: "fresh-cuts" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, soldAs: true, stockOnHand: true, reorderPoint: true, costPrice: true, standardPrice: true, memberPrice: true, availability: true },
    }),
    committedByProduct(),
  ]);
  const kg = (v: number | null, weighed: boolean) => (v === null ? null : weighed ? v / 1000 : v);
  const header = ["slug", "name", "unit", "on_hand", "promised", "reorder_at", "cost", "standard_price", "member_price", "availability"];
  const lines = products.map((p) => {
    const w = p.soldAs === "WEIGHT";
    return [p.slug, p.name, w ? "kg" : p.soldAs === "SET" ? "sets" : "pcs", kg(p.stockOnHand, w), kg(committed.get(p.id) ?? 0, w), kg(p.reorderPoint, w), p.costPrice, p.standardPrice, p.memberPrice, p.availability]
      .map(cell)
      .join(",");
  });
  await auditStaff(ctx, { action: "inventory.exported", summary: `Exported stock for ${products.length} products` });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`${header.join(",")}\n${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="basket-stock-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
