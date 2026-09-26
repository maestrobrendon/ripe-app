import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getActiveZone } from "@/lib/zone";
import { readCart } from "@/lib/cart";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import { CheckoutFlow } from "./checkout-flow";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const cart = await readCart();
  if (cart.items.length === 0) redirect("/cart");

  const isBasket = source === "basket";

  const [zones, user, activeZone] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
    getActiveZone(),
  ]);

  const defaultZoneSlug = user?.deliveryZone?.slug ?? activeZone?.slug ?? zones[0]?.slug ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-lg">Checkout</h1>
      <CheckoutFlow
        zones={zones.map((z) => ({ slug: z.slug, name: z.name, area: z.area }))}
        source={isBasket ? "basket" : undefined}
        shoppingWindowLabel={
          user?.shoppingWindowDay ? SHOPPING_WINDOW_DAY_LABEL[user.shoppingWindowDay] : null
        }
        defaults={{
          name: user?.name ?? "",
          phone: user?.phone ?? "",
          email: user?.email ?? "",
          address: user?.address ?? "",
          zoneSlug: defaultZoneSlug,
          deliveryDay: user?.deliveryDay ?? "WEDNESDAY",
        }}
      />
    </div>
  );
}
