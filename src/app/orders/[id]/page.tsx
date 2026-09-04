import { notFound } from "next/navigation";
import Link from "next/link";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProductImage } from "@/components/product-image";
import { formatNaira, ORDER_STATUS_LABEL, ORDER_STATUS_STEPS } from "@/lib/format";

function tokenMatches(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ id }, { t }, user] = await Promise.all([params, searchParams, getCurrentUser()]);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) notFound();

  const ownsIt = Boolean(user && order.userId && order.userId === user.id);
  const hasValidToken = Boolean(t) && tokenMatches(t!, order.accessToken);
  // Same response as "not found" so the endpoint does not confirm the order exists.
  if (!ownsIt && !hasValidToken) notFound();

  const currentIndex = ORDER_STATUS_STEPS.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm text-muted">Order #{order.id.slice(-8)}</p>
      <h1 className="mt-1 text-3xl font-semibold">
        {order.orderType === "SUBSCRIPTION" ? "Standing basket order" : "Order confirmed"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Delivering {order.deliveryDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })} to{" "}
        {order.address} ({order.zoneName})
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
            <li key={i.id} className="flex items-center gap-3 p-4 text-sm">
              <ProductImage
                publicId={i.product.cloudinaryPublicId}
                alt={i.product.name}
                emoji={i.product.imageEmoji}
                className="h-10 w-10 shrink-0"
                rounded="rounded-lg"
                emojiClassName="text-lg"
                sizes="40px"
              />
              <span className="min-w-0 flex-1 truncate">{i.product.name} × {i.quantity}</span>
              <span className="shrink-0">{formatNaira(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 px-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>{formatNaira(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Delivery</span>
            <span>{order.deliveryFee === 0 ? "Free" : formatNaira(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatNaira(order.total)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Payment</span>
            <span>{order.paymentMethod}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <Link href="/shop" className="text-sm font-medium text-ripe-green underline">Keep shopping</Link>
        <Link href="/account" className="text-sm font-medium text-ripe-green underline">Your account</Link>
      </div>
    </div>
  );
}
