"use client";

/**
 * flyToCart(from, glyph) — the signature commerce moment. A clone of the
 * produce glyph arcs from the tapped Add button into whatever element
 * carries `data-flight-target="cart"` (the header cart button). On landing
 * it dispatches `ripe:cart-landed`, which the cart button listens to for its
 * "gulp" bump.
 *
 * Imperative on purpose: no React state, no re-render, transform/opacity only.
 * Reduced motion / lite motion → no flight, just the landing event.
 */

import { animate } from "motion";
import { bezier, prefersLiteMotion } from "@/lib/motion/tokens";

export const CART_LANDED_EVENT = "ripe:cart-landed";

export function flyToCart(from: HTMLElement, glyph: string, imageUrl?: string) {
  if (typeof window === "undefined") return;
  const target = document.querySelector<HTMLElement>('[data-flight-target="cart"]');
  const land = () => window.dispatchEvent(new CustomEvent(CART_LANDED_EVENT));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!target || reduced || prefersLiteMotion()) return land();

  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = 40;

  const node = document.createElement("div");
  node.setAttribute("aria-hidden", "true");
  Object.assign(node.style, {
    position: "fixed",
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: "90",
    pointerEvents: "none",
    display: "grid",
    placeItems: "center",
    fontSize: "22px",
    borderRadius: "9999px",
    background: "var(--sky-wash)",
    border: "1px solid var(--carbon)",
    willChange: "transform, opacity",
  } satisfies Partial<CSSStyleDeclaration>);

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", borderRadius: "9999px" });
    node.appendChild(img);
  } else {
    node.textContent = glyph;
  }
  document.body.appendChild(node);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const lift = Math.min(160, Math.abs(dx) * 0.35 + 60); // arc height grows with distance

  // X travels steadily, Y rises then falls: two independent curves = a natural arc.
  const duration = Math.min(0.9, 0.5 + Math.hypot(dx, dy) / 2400);

  animate(node, { x: [0, dx] }, { duration, ease: bezier.inOut });
  animate(
    node,
    { y: [0, Math.min(0, dy) - lift, dy], scale: [1, 1.18, 0.4], rotate: [0, -12, 8] },
    { duration, ease: [bezier.out, bezier.in], times: [0, 0.4, 1] },
  ).then(() => {
    node.remove();
    land();
  });
}
