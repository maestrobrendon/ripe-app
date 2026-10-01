import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserBaskets } from "@/lib/basket";
import { basketDisplayNames } from "@/lib/kachi-types";
import { KachiChat } from "./assistant-chat";

export const metadata = { title: "Kachi. Basket" };

/**
 * Kachi: opens in "Just chatting" every time (nothing can change), and only
 * acts on a basket or the cart once the customer picks one with the mode
 * pill. See src/app/api/assistant/route.ts for how each mode is scoped.
 */
export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/assistant");

  const baskets = await getUserBaskets(user.id);
  const names = basketDisplayNames(baskets);

  return (
    <KachiChat
      firstName={user.name.trim().split(/\s+/)[0] || "there"}
      baskets={baskets.map((b) => ({ id: b.id, name: names.get(b.id) ?? "Your basket" }))}
    />
  );
}
