import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { ownedDelivery, rememberActiveDelivery } from "@/lib/order-container";

/**
 * Opens Home on one particular basket, for links in reminders ("see Kachi's
 * suggestion for For Mum"). Someone else's basket id just opens Home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const b = url.searchParams.get("b");
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/basket/open${b ? `?b=${encodeURIComponent(b)}` : ""}`)}`, url));
  const basket = await ownedDelivery(user.id, b);
  if (basket) await rememberActiveDelivery(basket.id);
  return NextResponse.redirect(new URL("/basket", url));
}
