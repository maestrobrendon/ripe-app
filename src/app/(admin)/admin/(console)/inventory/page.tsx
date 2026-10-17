import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { committedByProduct } from "@/lib/stock";
import { PageHeader } from "../../_ui/kit";
import { one } from "../../_ui/format";
import { StockGrid, type GridRowData } from "./stock-grid";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff } = await requireStaffPage("inventory.view");
  const role = staff.role as Role;
  const q = one((await searchParams).q, 60) ?? "";
  const [products, committed] = await Promise.all([
    prisma.product.findMany({
      where: { NOT: { tags: { has: "fresh-cuts" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, category: true, soldAs: true, availability: true, stockOnHand: true, reorderPoint: true,
        costPrice: true, standardPrice: true, memberPrice: true, version: true, supplier: { select: { name: true } },
      },
    }),
    committedByProduct(),
  ]);
  const rows: GridRowData[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    weighed: p.soldAs === "WEIGHT",
    unit: p.soldAs === "WEIGHT" ? "kg" : p.soldAs === "SET" ? "sets" : "pcs",
    availability: p.availability,
    onHand: p.stockOnHand,
    committed: committed.get(p.id) ?? 0,
    reorderPoint: p.reorderPoint,
    costPrice: p.costPrice,
    standardPrice: p.standardPrice,
    memberPrice: p.memberPrice,
    version: p.version,
    supplier: p.supplier?.name ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Stock"
        description="Click a cell to edit, or paste a column from Excel. Changes wait in a review panel until you save them. Weighed produce is in kg."
      />
      <StockGrid rows={rows} initialQuery={q} canAdjust={can(role, "inventory.adjust")} canPrice={can(role, "catalogue.price")} />
    </>
  );
}
