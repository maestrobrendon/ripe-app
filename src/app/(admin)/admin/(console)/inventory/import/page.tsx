import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { Card, PageHeader } from "../../../_ui/kit";
import { ImportCounts } from "./import-counts";

export const metadata: Metadata = { title: "Import and export" };

export default async function ImportPage() {
  const { staff } = await requireStaffPage("inventory.view");
  const products = await prisma.product.findMany({
    where: { NOT: { tags: { has: "fresh-cuts" } } },
    select: { slug: true, name: true, soldAs: true, stockOnHand: true },
  });
  return (
    <>
      <PageHeader title="Import and export" description="Download stock as a spreadsheet, count, and bring the counts back in." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card title="Export">
          <p className="text-[13px] text-carbon/65">Every product with its stock, promised quantity, reorder point and prices. Weighed produce is in kg.</p>
          {/* A file download, not a page: a plain link, so the browser saves it. */}
          <a href="/inventory/export" download className="mt-3 inline-flex h-9 items-center rounded-xl bg-carbon px-3 text-[13px] font-semibold text-paper-white hover:bg-carbon/85">
            Download CSV
          </a>
        </Card>
        {can(staff.role as Role, "inventory.import") ? (
          <ImportCounts products={products.map((p) => ({ slug: p.slug, name: p.name, weighed: p.soldAs === "WEIGHT", onHand: p.stockOnHand }))} />
        ) : (
          <Card title="Import counts">
            <p className="text-[13px] text-carbon/55">Your role can view stock but not import counts.</p>
          </Card>
        )}
      </div>
    </>
  );
}
