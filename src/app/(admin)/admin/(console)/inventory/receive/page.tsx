import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { PageHeader } from "../../../_ui/kit";
import { StockLines } from "../stock-lines";
import { productOptions } from "../products-for-lines";

export const metadata: Metadata = { title: "Receive stock" };

export default async function ReceivePage() {
  await requireStaffPage("inventory.receive");
  const [products, suppliers] = await Promise.all([
    productOptions(),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Receive stock" description="Log what came in from market. Each line adds to stock and is tracked to its best-before date, so the oldest goes out first." />
      <StockLines mode="receive" products={products} suppliers={suppliers} />
    </>
  );
}
