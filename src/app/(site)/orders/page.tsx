import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { customerStatusLabel, OPEN_STATUSES } from "@/lib/order-status";
import { orderRef, shortDate } from "@/lib/delivery-labels";
import { ProductImage } from "@/components/product-image";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Orders" };

/** Every order, coming up first. */
export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      status: true,
      deliveryDate: true,
      total: true,
      paidAt: true,
      paymentMethod: true,
      _count: { select: { items: true, issues: true } },
      items: { take: 3, select: { product: { select: { name: true, imageEmoji: true, cloudinaryPublicId: true } } } },
    },
  });

  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status)).reverse();
  const past = orders.filter((o) => !OPEN_STATUSES.includes(o.status));

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Orders</h1>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface p-8 text-center ring-1 ring-hairline">
          <p className="font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted">When you confirm an order, it shows up here with its progress.</p>
          <LinkButton href="/basket" size="sm" className="mt-4">
            Go to your order
          </LinkButton>
        </div>
      ) : (
        <>
          {open.length > 0 && <Group title="Coming up" orders={open} />}
          {past.length > 0 && <Group title="Past orders" orders={past} />}
        </>
      )}
    </div>
    </div>
  );
}

type Row = {
  id: string;
  status: Parameters<typeof customerStatusLabel>[0];
  deliveryDate: Date;
  total: number;
  paidAt: Date | null;
  paymentMethod: string;
  _count: { items: number; issues: number };
  items: { product: { name: string; imageEmoji: string; cloudinaryPublicId: string | null } }[];
};

function Group({ title, orders }: { title: string; orders: Row[] }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-4 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">{title}</h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.025] active:bg-black/[0.05]">
              <div className="flex shrink-0 -space-x-3">
                {o.items.map((i, n) => (
                  <ProductImage key={n} publicId={i.product.cloudinaryPublicId} alt="" emoji={i.product.imageEmoji} sizes="40px" rounded="rounded-full" className="size-10 border-2 border-surface" emojiClassName="text-lg" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{shortDate(o.deliveryDate)}</p>
                <p className="truncate text-xs text-muted">
                  {orderRef(o.id)} · {o._count.items} item{o._count.items === 1 ? "" : "s"} · {formatNaira(o.total)}
                  {!o.paidAt && o.status === "DELIVERED" ? " · not paid yet" : ""}
                  {o._count.issues ? " · problem reported" : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${o.status === "OUT_FOR_DELIVERY" ? "bg-mint-pop/40" : o.status === "CANCELLED" || o.status === "REFUNDED" || o.status === "FAILED_DELIVERY" ? "bg-soft-mist text-muted" : "bg-soft-mist"}`}>
                {customerStatusLabel(o.status)}
              </span>
              <Icon name="caretRight" size={16} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
