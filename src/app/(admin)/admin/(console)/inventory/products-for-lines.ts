import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProductOption } from "./stock-lines";

/** Products for the line pickers, discontinued lines left out. */
export async function productOptions(): Promise<ProductOption[]> {
  const ps = await prisma.product.findMany({
    where: { NOT: { tags: { has: "fresh-cuts" } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, soldAs: true, category: true },
  });
  return ps.map((p) => ({
    id: p.id,
    name: p.name,
    weighed: p.soldAs === "WEIGHT",
    unit: p.soldAs === "WEIGHT" ? "kg" : p.soldAs === "SET" ? "sets" : "pcs",
    category: p.category,
  }));
}
