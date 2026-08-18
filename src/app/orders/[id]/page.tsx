import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatNaira, ORDER_STATUS_LABEL, ORDER_STATUS_STEPS } from "@/lib/format";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/subscribe");

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order || order.userId !== user.id) notFound();

  const currentIndex = ORDER_STATUS_STEPS.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm text-muted">Order #{order.id.slice(-8)}</p>
      <h1 className="mt-1 text-3xl font-semibold">
        {order.type === "STANDING" ? "Standing basket order" : "Top-up order"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Delivering {order.deliveryDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <ol className="flex items-center justify-between">
          {ORDER_STATUS_STEPS.map((status, i) => (
            <li key={status} className="relative flex flex-1 flex-col items-center text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  i <= currentIndex ? "bg-ripe-green text-white" : "border border-border text-muted"
                }`}
              >
                {i <= currentIndex ? "✓" : i + 1}
              </span>
              <span className={`mt-2 text-xs ${i <= currentIndex ? "font-medium" : "text-muted"}`}>
                {ORDER_STATUS_LABEL[status]}
              </span>
              {i < ORDER_STATUS_STEPS.length - 1 && (
                <span className={`absolute mt-4 h-px w-full ${i < currentIndex ? "bg-ripe-green" : "bg-border"}`} />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Items</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between p-4 text-sm">
              <span>{i.product.imageEmoji} {i.product.name} × {i.quantity}</span>
              <span>{formatNaira(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between px-1 text-sm font-semibold">
          <span>Total</span>
          <span>{formatNaira(order.total)}</span>
        </div>
      </div>

      <Link href="/account" className="mt-8 inline-block text-sm font-medium text-ripe-green underline">
        Back to your account
      </Link>
    </div>
  );
}
