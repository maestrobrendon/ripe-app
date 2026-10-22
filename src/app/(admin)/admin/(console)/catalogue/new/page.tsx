import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { PageHeader } from "../../../_ui/kit";
import { DetailsForm } from "../product-editor";
import { EMPTY_DETAILS } from "../details";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage("catalogue.edit");
  const options = await prisma.product.findMany({ where: { NOT: { tags: { has: "fresh-cuts" } } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New product" description="It starts hidden. Add a photo and check the copy, then put it on sale from its page." />
      <div className="max-w-3xl">
        <DetailsForm mode="create" initial={EMPTY_DETAILS} options={options} canEdit />
      </div>
    </>
  );
}
