import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/admin/guard";
import { PageHeader } from "../../../_ui/kit";
import { StockLines } from "../stock-lines";
import { productOptions } from "../products-for-lines";

export const metadata: Metadata = { title: "Record waste" };

export default async function WastePage() {
  await requireStaffPage("inventory.adjust");
  return (
    <>
      <PageHeader title="Record waste" description="Anything thrown away or unsellable. It comes off stock, oldest batch first, and shows in the waste totals." />
      <StockLines mode="waste" products={await productOptions()} />
    </>
  );
}
