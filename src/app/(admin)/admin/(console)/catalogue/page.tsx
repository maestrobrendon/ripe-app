import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { formatQty, isLowStock } from "@/lib/stock-core";
import { ProductImage } from "@/components/product-image";
import type { Availability, Prisma, ProductCategory } from "@/generated/prisma/client";
import { Badge, Button, Card, Input, PageHeader } from "../../_ui/kit";
import { naira, one } from "../../_ui/format";
import { AVAILABILITY_LABEL, availabilityTone, CATEGORY_LABEL } from "./labels";

export const metadata: Metadata = { title: "Products" };

const selectClass = "h-11 rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff } = await requireStaffPage("catalogue.view");
  const role = staff.role as Role;
  const sp = await searchParams;
  const q = one(sp.q, 60);
  const category = one(sp.category, 20);
  const availability = one(sp.availability, 20);
  const showArchived = one(sp.archived, 3) === "1";

  const where: Prisma.ProductWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] }),
    ...(category && category in CATEGORY_LABEL && { category: category as ProductCategory }),
    ...(availability && availability in AVAILABILITY_LABEL && { availability: availability as Availability }),
    // Discontinued lines (Fresh Cuts) stay out of the way unless asked for.
    ...(!showArchived && { NOT: { tags: { has: "fresh-cuts" } } }),
  };
  const [products, counts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, category: true, unit: true, soldAs: true, availability: true, standardPrice: true, memberPrice: true,
        stockOnHand: true, reorderPoint: true, featured: true, cloudinaryPublicId: true, imageEmoji: true,
      },
    }),
    prisma.product.groupBy({ by: ["availability"], where: { NOT: { tags: { has: "fresh-cuts" } } }, _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.availability, c._count._all]));

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything the shop sells: copy, photos, prices and availability. New products start hidden."
        actions={
          can(role, "catalogue.edit") ? (
            <Link href="/catalogue/new" className="inline-flex h-11 items-center rounded-xl bg-carbon px-4 text-[14px] font-semibold text-paper-white hover:bg-carbon/85">
              New product
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
          <Link key={a} href={`/catalogue?availability=${a}`} className="rounded-2xl bg-paper-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] hover:shadow-[0_0_0_2px_var(--color-carbon)]">
            <p className="text-[12px] font-semibold text-carbon/55">{AVAILABILITY_LABEL[a]}</p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums">{count.get(a) ?? 0}</p>
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <form action="/catalogue" className="grid gap-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-center">
          <Input name="q" placeholder="Search by name" defaultValue={q} aria-label="Search products" />
          <select name="category" defaultValue={category ?? ""} aria-label="Category" className={selectClass}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="availability" defaultValue={availability ?? ""} aria-label="Availability" className={selectClass}>
            <option value="">Any availability</option>
            {Object.entries(AVAILABILITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 text-right font-semibold">Standard</th>
                <th className="px-3 py-2.5 text-right font-semibold">Member</th>
                <th className="px-3 py-2.5 text-right font-semibold">In stock</th>
                <th className="px-5 py-2.5 font-semibold">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-soft-mist/30">
                  <td className="px-5 py-2.5">
                    <Link href={`/catalogue/${p.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                      <ProductImage publicId={p.cloudinaryPublicId} alt="" emoji={p.imageEmoji} className="h-10 w-10 shrink-0" rounded="rounded-lg" emojiClassName="text-lg" sizes="40px" />
                      <span>
                        {p.name}
                        {p.featured && <span className="ml-2 text-[11px] font-semibold text-carbon/45">Featured</span>}
                        <span className="block text-[12px] font-normal text-carbon/50">{p.unit}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{CATEGORY_LABEL[p.category]}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{naira(p.standardPrice)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{naira(p.memberPrice)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${isLowStock(p.stockOnHand, p.reorderPoint) ? "font-semibold text-[#9a2c00]" : ""}`}>{formatQty(p.stockOnHand, p.soldAs)}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={availabilityTone(p.availability)}>{AVAILABILITY_LABEL[p.availability]}</Badge>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-carbon/50">
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-carbon/50">
        {showArchived ? (
          <Link href="/catalogue" className="underline">
            Hide discontinued lines
          </Link>
        ) : (
          <Link href="/catalogue?archived=1" className="underline">
            Show discontinued lines (Fresh Cuts)
          </Link>
        )}
      </p>
    </>
  );
}
