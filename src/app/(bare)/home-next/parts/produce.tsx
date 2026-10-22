"use client";

import { ProductImage } from "@/components/product-image";

/** Category washes, the same sticker set the shop uses. */
export const WASH: Record<string, string> = {
  FRUIT: "bg-sunburst",
  VEGETABLE: "bg-mint-pop",
  BOX_BUNDLE: "bg-lavender",
  SEASONAL: "bg-ember",
};

/** A product photo cut as a sticker: flat wash, carbon outline, soft corners. */
export function ProduceSticker({
  name,
  publicId,
  emoji,
  category,
  className = "",
  rounded = "rounded-[28%]",
  sizes = "120px",
  emojiClassName = "text-5xl",
}: {
  name: string;
  publicId: string | null;
  emoji: string;
  category?: string;
  className?: string;
  rounded?: string;
  sizes?: string;
  emojiClassName?: string;
}) {
  return (
    <ProductImage
      publicId={publicId}
      alt={name}
      emoji={emoji}
      sizes={sizes}
      rounded={rounded}
      flavour={WASH[category ?? ""] ?? "bg-sky-wash"}
      emojiClassName={emojiClassName}
      className={`border border-carbon ${className}`}
    />
  );
}
