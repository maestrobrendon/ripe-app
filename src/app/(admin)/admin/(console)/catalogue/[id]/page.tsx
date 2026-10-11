import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { committedByProduct } from "@/lib/stock";
import { formatQty } from "@/lib/stock-core";
import { Badge, Card, PageHeader } from "../../../_ui/kit";
import { naira, when } from "../../../_ui/format";
import { AVAILABILITY_LABEL, availabilityTone } from "../labels";
import { AvailabilityCard, DetailsForm, PhotoCard, PricesCard } from "../product-editor";
import { toDetails } from "../details";
import { appOrigin } from "@/lib/site";

export const metadata: Metadata = { title: "Product" };

const FIELD_LABEL: Record<string, string> = { standardPrice: "Standard", memberPrice: "Member", costPrice: "Cost" };

export default async function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("catalogue.view");
  const role = staff.role as Role;
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: id.slice(0, 40) },
    include: {
      priceChanges: { orderBy: { at: "desc" }, take: 20 },
      movements: { orderBy: { at: "desc" }, take: 8 },
      supplier: { select: { name: true } },
    },
  });
  if (!product) notFound();
  const [others, committed] = await Promise.all([
    prisma.product.findMany({ where: { id: { not: product.id }, NOT: { tags: { has: "fresh-cuts" } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    committedByProduct([product.id]),
  ]);
  const promised = committed.get(product.id) ?? 0;

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <>
            <Link href={`${appOrigin()}/products/${product.slug}`} className="underline" target="_blank" rel="noreferrer">
              /products/{product.slug}
            </Link>{" "}
            · last changed {when(product.updatedAt)}
          </>
        }
        actions={<Badge tone={availabilityTone(product.availability)}>{AVAILABILITY_LABEL[product.availability]}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <DetailsForm
            mode="edit"
            id={product.id}
            version={product.version}
            initial={toDetails(product)}
            options={others}
            canEdit={can(role, "catalogue.edit")}
          />
        </div>

        <div className="space-y-5">
          <PhotoCard id={product.id} publicId={product.cloudinaryPublicId} emoji={product.imageEmoji} name={product.name} canEdit={can(role, "catalogue.edit")} />

          <AvailabilityCard
            id={product.id}
            current={product.availability}
            canChange={can(role, "catalogue.availability")}
            canPublish={can(role, "catalogue.publish")}
          />

          <PricesCard
            id={product.id}
            version={product.version}
            standardPrice={product.standardPrice}
            memberPrice={product.memberPrice}
            costPrice={product.costPrice}
            canChange={can(role, "catalogue.price")}
            history={product.priceChanges.map((c) => ({
              id: c.id,
              text: `${FIELD_LABEL[c.field] ?? c.field}: ${c.fromValue === null ? "—" : naira(c.fromValue)} → ${c.toValue === null ? "—" : naira(c.toValue)}`,
              meta: `${c.staffName} · ${when(c.at)}${c.reason ? ` · ${c.reason}` : ""}`,
            }))}
          />

          <Card title="Stock" actions={can(role, "inventory.view") ? <Link href={`/inventory?q=${encodeURIComponent(product.name)}`} className="text-[13px] font-semibold underline">Inventory</Link> : undefined}>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[13px]">
              <dt className="text-carbon/50">On hand</dt>
              <dd className="font-semibold tabular-nums">{formatQty(product.stockOnHand, product.soldAs)}</dd>
              <dt className="text-carbon/50">Promised to orders</dt>
              <dd className="tabular-nums">{formatQty(promised, product.soldAs)}</dd>
              <dt className="text-carbon/50">Free to sell</dt>
              <dd className="tabular-nums">{formatQty(product.stockOnHand - promised, product.soldAs)}</dd>
              <dt className="text-carbon/50">Supplier</dt>
              <dd>{product.supplier?.name ?? "—"}</dd>
            </dl>
            {product.movements.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-black/6 pt-3 text-[12px] text-carbon/65">
                {product.movements.map((m) => (
                  <li key={m.id}>
                    <b className="font-semibold">{m.quantity > 0 ? "+" : ""}{formatQty(m.quantity, product.soldAs)}</b> {m.kind.toLowerCase()} · {m.staffName} · {when(m.at)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
