import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { appOrigin } from "@/lib/site";
import { PageHeader } from "../../../_ui/kit";
import { when } from "../../../_ui/format";
import { RecipeEditor, VisibilityCard } from "../recipe-editor";
import { toDraft } from "../recipe-draft";

export const metadata: Metadata = { title: "Recipe" };

export default async function RecipeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("recipes.view");
  const role = staff.role as Role;
  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id: id.slice(0, 40) }, include: { _count: { select: { savedBy: true } } } });
  if (!recipe) notFound();
  const products = await prisma.product.findMany({ where: { NOT: { tags: { has: "fresh-cuts" } } }, orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });

  return (
    <>
      <Link href="/recipes" className="text-[13px] font-semibold text-carbon/60 underline underline-offset-2">
        ← All recipes
      </Link>
      <PageHeader title={recipe.title} description={`Last changed ${when(recipe.updatedAt)}`} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <RecipeEditor
          mode="edit"
          id={recipe.id}
          version={recipe.version}
          initial={toDraft(recipe, new Map(products.map((p) => [p.id, p.slug])))}
          products={products.map((p) => ({ slug: p.slug, name: p.name }))}
          canEdit={can(role, "recipes.edit")}
        />
        <div>
          <VisibilityCard
            id={recipe.id}
            status={recipe.status}
            onMenu={recipe.onMenu}
            membersOnly={recipe.membersOnly}
            canPublish={can(role, "recipes.publish")}
            previewHref={`${appOrigin()}/recipes/${recipe.slug}`}
            saved={recipe._count.savedBy}
          />
        </div>
      </div>
    </>
  );
}
