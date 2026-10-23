import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { readCart } from "@/lib/cart";
import { KachiChat } from "./assistant-chat";

export const metadata = { title: "Kachi. BasketNG" };

/**
 * Kachi: one assistant for food questions and for changes to the order the
 * customer is filling. Every change shows as a card with Undo; Kachi never
 * places or pays for an order. See src/app/api/assistant/route.ts.
 */
export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/assistant");
  const cart = await readCart();

  return <KachiChat firstName={user.name.trim().split(/\s+/)[0] || "there"} deliveryLabel={cart.deliveryLabel ?? "your order"} />;
}
