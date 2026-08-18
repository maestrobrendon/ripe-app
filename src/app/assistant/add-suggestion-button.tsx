"use client";

import { useBasket } from "@/components/basket-provider";

export function AddSuggestionButton({
  product,
}: {
  product: { id: string; slug: string; name: string; unit: string; imageEmoji: string; memberPrice: number; marketPrice: number };
}) {
  const basket = useBasket();
  const existing = basket.items.find((i) => i.productId === product.id);

  if (existing) {
    return <span className="ml-auto text-xs font-medium text-ripe-green">In basket</span>;
  }

  return (
    <button
      onClick={() => basket.setQuantity(product, 1)}
      className="ml-auto shrink-0 rounded-full border border-ripe-green px-3 py-1 text-xs font-medium text-ripe-green hover:bg-ripe-green-light"
    >
      + Add
    </button>
  );
}
