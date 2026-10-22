import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { MENU_GOALS } from "@/lib/menu-types";
import { Badge, Card, PageHeader } from "../../_ui/kit";
import { when } from "../../_ui/format";
import { MenuOrder } from "./menu-order";

export const metadata: Metadata = { title: "Recipes" };

const GOAL_LABEL = Object.fromEntries(MENU_GOALS.map((g) => [g.id, g.label]));

export default async function RecipesAdminPage() {
  const { staff } = await requireStaffPage("recipes.view");
  const role = staff.role as Role;
  const recipes = await prisma.recipe.findMany({
    orderBy: [{ onMenu: "desc" }, { sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, goal: true, status: true, onMenu: true, membersOnly: true, image: true, minutes: true, updatedAt: true, _count: { select: { savedBy: true } } },
  });
  const menu = recipes.filter((r) => r.onMenu && r.status === "PUBLISHED");
  const others = recipes.filter((r) => !(r.onMenu && r.status === "PUBLISHED"));

  return (
    <>
      <PageHeader
        title="Recipes"
        description="The menu leads the homepage, sign-up and the recipe page, in this order. Members-only recipes show the dish to everyone and the method to members."
        actions={
          can(role, "recipes.edit") ? (
            <Link href="/recipes/new" className="inline-flex h-11 items-center rounded-xl bg-carbon px-4 text-[14px] font-semibold text-paper-white hover:bg-carbon/85">
              New recipe
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <MenuOrder
          canReorder={can(role, "recipes.publish")}
          items={menu.map((r) => ({ id: r.id, title: r.title, meta: `${GOAL_LABEL[r.goal ?? ""] ?? "No goal"} · ${r.minutes ?? "?"} min${r.membersOnly ? " · members" : ""}` }))}
        />

        <Card title={`Drafts and the rest of the library (${others.length})`} className="p-0! overflow-hidden">
          <ul className="divide-y divide-black/5 border-t border-black/6">
            {others.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <Link href={`/recipes/${r.id}`} className="font-semibold hover:underline">
                    {r.title}
                  </Link>
                  <p className="text-carbon/55">
                    {GOAL_LABEL[r.goal ?? ""] ?? "Library"} · edited {when(r.updatedAt)}
                    {r._count.savedBy > 0 && ` · saved by ${r._count.savedBy}`}
                  </p>
                </div>
                <span className="flex shrink-0 gap-1">
                  {r.status === "DRAFT" ? <Badge tone="warn">Draft</Badge> : <Badge>Library</Badge>}
                  {r.membersOnly && <Badge>Members</Badge>}
                </span>
              </li>
            ))}
            {others.length === 0 && <li className="px-5 py-4 text-[13px] text-carbon/50">Everything published is on the menu.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
