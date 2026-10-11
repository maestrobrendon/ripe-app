import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { getOwnedBasket } from "@/lib/basket";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import { LinkButton } from "@/components/ui/button";
import { CheckoutFlow } from "./checkout-flow";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; basketId?: string }>;
}) {
  const { source, basketId } = await searchParams;
  const cart = await readCart();
  if (cart.items.length === 0) redirect("/cart");

  const isBasket = source === "basket";
  const user = await getCurrentUser();

  // A guest can browse and build a cart freely; the account requirement bites
  // only here, at the payment step, for both individual and basket orders.
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-heading-lg">Create an account to check out</h1>
        <p className="mt-3 text-sm text-muted">
          Your cart is saved. Sign in or create a free account to finish this order.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <LinkButton href={`/start?next=/checkout${isBasket ? "&source=basket" : ""}`} size="lg">
            Create an account
          </LinkButton>
          <Link
            href={`/login?next=${encodeURIComponent(`/checkout${isBasket ? "?source=basket" : ""}`)}`}
            className="text-sm font-medium text-carbon underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    );
  }

  const basket = isBasket && basketId ? await getOwnedBasket(user.id, basketId) : null;

  const [zones, activeZone] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" } }),
    getActiveZone(),
  ]);

  const defaultZoneSlug = user.deliveryZone?.slug ?? activeZone?.slug ?? zones[0]?.slug ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-lg">Checkout</h1>
      <CheckoutFlow
        zones={zones.map((z) => ({ slug: z.slug, name: z.name, area: z.area }))}
        source={isBasket ? "basket" : undefined}
        basketId={basket?.id}
        shoppingWindowLabel={
          basket?.shoppingWindowDay ? SHOPPING_WINDOW_DAY_LABEL[basket.shoppingWindowDay] : null
        }
        defaults={{
          name: user.name ?? "",
          phone: user.phone ?? "",
          email: user.email ?? "",
          address: user.address ?? "",
          zoneSlug: defaultZoneSlug,
          deliveryDay: user.deliveryDay ?? "WEDNESDAY",
        }}
      />
    </div>
  );
}
