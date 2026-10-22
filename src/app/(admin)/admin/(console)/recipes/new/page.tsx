import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { PageHeader } from "../../../_ui/kit";
import { RecipeEditor } from "../recipe-editor";
import { EMPTY_RECIPE } from "../recipe-draft";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  await requireStaffPage("recipes.edit");
  const products = await prisma.product.findMany({ where: { NOT: { tags: { has: "fresh-cuts" } } }, orderBy: { name: "asc" }, select: { slug: true, name: true } });
  return (
    <>
      <PageHeader title="New recipe" description="It starts as a draft. Add a photo and its ingredients, then publish it and put it on the menu." />
      <div className="max-w-3xl">
        <RecipeEditor mode="create" initial={EMPTY_RECIPE} products={products} canEdit />
      </div>
    </>
  );
}
