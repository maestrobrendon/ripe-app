"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { flyToCart } from "@/components/ui/fly-to-cart";
import { press, spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { flavourFor } from "@/lib/flavour";
import type { ProductCategory } from "@/generated/prisma/enums";

export type CrossSellProduct = AddableProduct & {
  ratingAvg: number | null;
  ratingCount: number;
  category: ProductCategory;
  tags: string[];
};

function Stars({ avg }: { avg: number }) {
  const full = Math.round(avg);
  return (
    <span className="text-xs text-carbon" aria-label={`${avg} out of 5`}>
      {"★".repeat(full)}
      <span className="text-border">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function Card({ product }: { product: CrossSellProduct }) {
  const cart = useCart();
  const inCart = cart.items.some((i) => i.productId === product.id);
  const chooseOptions = product.orderUnit === "WEIGHT";
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;

  return (
    <div className="flex w-40 shrink-0 flex-col rounded-card border border-border bg-surface p-3 sm:w-56 sm:p-4">
      <Link href={`/products/${product.slug}`} className="mb-2 block sm:mb-3">
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt={product.name}
          emoji={product.imageEmoji}
          flavour={flavourFor(product.category, product.tags)}
          className="h-24 w-full sm:h-28"
          emojiClassName="text-4xl sm:text-5xl"
          sizes="(min-width: 640px) 224px, 160px"
        />
      </Link>
      <Link href={`/products/${product.slug}`} className="text-sm font-medium leading-snug hover:underline">
        {product.name}
      </Link>
      {product.ratingCount > 0 && product.ratingAvg != null && (
        <div className="mt-1 flex items-center gap-1">
          <Stars avg={product.ratingAvg} />
          <span className="text-[11px] text-muted">{product.ratingCount} reviews</span>
        </div>
      )}
      <p className="mt-1 text-sm font-semibold">
        {chooseOptions ? "From " : ""}
        {formatNaira(price)}
      </p>
      <p className="text-[11px] text-muted">{product.unit}</p>

      <div className="mt-3">
        {chooseOptions ? (
          <Link
            href={`/products/${product.slug}`}
            className="block w-full rounded-full border border-carbon px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-carbon hover:bg-sky-wash"
          >
            Choose options
          </Link>
        ) : (
          <motion.button
            whileTap={{ scale: press.scale }}
            transition={spring.snappy}
            onClick={(e) => {
              flyToCart(e.currentTarget, product.imageEmoji);
              cart.setQuantity(product, (cart.items.find((i) => i.productId === product.id)?.quantity ?? 0) + product.minOrderQty);
            }}
            className="w-full rounded-full border border-carbon px-4 py-2 text-xs font-medium uppercase tracking-wide text-carbon hover:bg-sky-wash"
          >
            {inCart ? "Add another" : "Add to cart"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

export function CompleteYourBasket({ products }: { products: CrossSellProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h2 className="text-lg font-semibold sm:text-xl">Complete your basket</h2>
      <div className="snap-row mt-4 flex gap-3 overflow-x-auto pb-2 sm:gap-4">
        {products.map((p) => (
          <Card key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
