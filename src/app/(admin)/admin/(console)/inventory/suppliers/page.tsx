import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { PageHeader } from "../../../_ui/kit";
import { SuppliersView } from "./suppliers-view";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { staff } = await requireStaffPage("inventory.view");
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }),
    prisma.product.findMany({ where: { NOT: { tags: { has: "fresh-cuts" } } }, orderBy: { name: "asc" }, select: { id: true, name: true, supplierId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy from, and which products usually come from whom. The buy list groups by supplier." />
      <SuppliersView
        canManage={can(staff.role as Role, "suppliers.manage")}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone ?? "", market: s.market ?? "", notes: s.notes ?? "", active: s.active, products: s._count.products }))}
        products={products}
      />
    </>
  );
}
