import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CartView } from "./cart-view";

/** A guest's cart. A signed-in customer has no cart: their order is on Home. */
export default async function CartPage() {
  if (await getCurrentUser()) redirect("/basket");
  return <CartView />;
}
