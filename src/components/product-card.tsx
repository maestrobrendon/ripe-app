"use client";

import Link from "next/link";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { flyToCart } from "@/components/ui/fly-to-cart";
import { formatNaira } from "@/lib/format";
import type { ProductCategory } from "@/generated/prisma/enums";

export type ProductCardData = AddableProduct & {
  inSeason: boolean;
  description: string | null;
  category: ProductCategory;
  tags: string[];
};

/** "per pawpaw", "per 250g", "each": the unit, said once under the price. */
function unitLine(unit: string) {
  const u = unit.replace(/^per\s+/i, "").trim();
  return !u || /^(piece|each)$/i.test(u) ? "each" : `per ${u}`;
}

/**
 * A product in a grid or a rail. The photo leads, on a quiet tile; the name
 * gets two lines whatever its length, the price one, its unit the line under,
 * so every card in a row ends at the same height with Add in the same place.
 * The stepper shows what's really in the order, so Add never overwrites a
 * quantity already there. Sold out and Limited sit on the photo.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const quantity = cart.quantityOf(product.id);
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;
  const href = `/products/${product.slug}`;
  const signedIn = cart.container === "delivery";
  const memberLine = !cart.isSubscriber && product.memberPrice < product.standardPrice ? `Members ${formatNaira(product.memberPrice)}` : null;

  return (
    <article className="group/card flex h-full flex-col">
      <Link href={href} className="relative block overflow-hidden rounded-2xl" tabIndex={-1} aria-hidden>
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt=""
          emoji={product.imageEmoji}
          flavour="bg-soft-mist"
          rounded="rounded-2xl"
          className={`aspect-square w-full transition-transform duration-300 ease-out group-hover/card:scale-[1.03] ${product.soldOut ? "opacity-55" : ""}`}
          emojiClassName="text-5xl sm:text-6xl"
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
        />
        {(product.soldOut || !product.inSeason) && (
          <span className="absolute top-2 left-2 rounded-full bg-paper-white/90 px-2 py-0.5 text-[11px] font-semibold text-carbon backdrop-blur-sm">
            {product.soldOut ? "Sold out" : "Limited"}
          </span>
        )}
      </Link>

      <h3 className="mt-2.5 line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-medium tracking-[-0.01em]">
        <Link href={href} className="hover:underline underline-offset-2">
          {product.name}
        </Link>
      </h3>

      <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[17px] font-semibold tracking-[-0.01em]">{formatNaira(price)}</span>
        <span className="truncate text-[13px] text-muted">{unitLine(product.unit)}</span>
      </p>
      <p className="min-h-[1.25rem] text-[12px] text-muted">{memberLine}</p>

      <div className="mt-auto pt-2.5">
        {product.soldOut && quantity === 0 ? (
          <p className="flex h-9 items-center text-[13px] text-muted">Back soon</p>
        ) : (
          <QuantityStepper
            quantity={quantity}
            min={product.minOrderQty}
            step={product.stepQty}
            label={product.name}
            loading={cart.loadingProductId === product.id}
            suffix={signedIn ? "in order" : "in cart"}
            onAddFrom={(el) => flyToCart(el, product.imageEmoji)}
            onChange={(next) => cart.setQuantity(product, next)}
          />
        )}
      </div>
    </article>
  );
}
