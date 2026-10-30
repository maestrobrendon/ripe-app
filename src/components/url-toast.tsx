"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart-provider";

/*
 * A one-off message carried in the address, shown as the usual pop-up and
 * then tidied away. For things that finish on another page: coming back
 * from Paystack's own checkout (?paid=1 / ?paid=0), a plan that's just
 * started (?joined=1), and ?toast=<key> for the rest.
 */

const TOASTS: Record<string, [string, "ok" | "error"]> = {
  "paid:1": ["Payment received. Thank you, it's confirmed.", "ok"],
  "paid:0": ["That payment didn't go through, and nothing was charged. You can try again.", "error"],
  "joined:1": ["Payment received. Your membership is on.", "ok"],
  "toast:again": ["Those items are back in your basket", "ok"],
  "toast:password": ["Password changed. You're signed in.", "ok"],
  "toast:email-verified": ["Email confirmed", "ok"],
};

export function UrlToast() {
  const cart = useCart();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const hit = ["paid", "joined", "toast"].find((k) => params.has(k) && TOASTS[`${k}:${params.get(k)}`]);
    if (!hit) return;
    const [text, tone] = TOASTS[`${hit}:${params.get(hit)}`];
    cart.announce(text, tone);
    // Shown once: a reload or a shared link shouldn't say it again.
    const rest = new URLSearchParams(params);
    rest.delete(hit);
    router.replace(`${pathname}${rest.size ? `?${rest}` : ""}`, { scroll: false });
    // Only when the address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname]);

  return null;
}
