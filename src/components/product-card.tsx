"use client";

import Link from "next/link";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { Card } from "@/components/ui/card";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { flyToCart } from "@/components/ui/fly-to-cart";
import { formatNaira } from "@/lib/format";
import { unitPriceLabel } from "@/lib/delivery-labels";
import { flavourFor } from "@/lib/flavour";
import type { ProductCategory } from "@/generated/prisma/enums";

export type ProductCardData = AddableProduct & {
  inSeason: boolean;
  description: string | null;
  category: ProductCategory;
  tags: string[];
};

/**
 * A product in a grid. The stepper shows what's really in the order (or a
 * guest's cart), so "Add" never overwrites a quantity already there. One price:
 * the one this customer pays. Non-members see what members pay, once.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const quantity = cart.quantityOf(product.id);
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;
  const href = `/products/${product.slug}`;
  const signedIn = cart.container === "delivery";

  return (
    <Card className="flex flex-col transition hover:bg-sky-wash">
      <Link href={href} className="mb-2 block sm:mb-3">
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt={product.name}
          emoji={product.imageEmoji}
          flavour={flavourFor(product.category, product.tags)}
          className="h-28 w-full sm:h-32"
          emojiClassName="text-5xl sm:text-6xl"
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
        />
      </Link>

      {/* Fixed-height title and price blocks keep every card in a row the same height. */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-h-10 min-w-0 text-sm font-medium leading-snug break-words sm:min-h-11 sm:text-base">
          <Link href={href} className="hover:underline">{product.name}</Link>
        </h3>
        {product.soldOut ? (
          <span className="shrink-0 rounded-full bg-soft-mist px-1.5 py-0.5 text-[10px] font-medium text-carbon sm:px-2 sm:text-[11px]">Sold out</span>
        ) : (
          !product.inSeason && (
            <span className="shrink-0 rounded-full bg-ember/12 px-1.5 py-0.5 text-[10px] font-medium text-carbon sm:px-2 sm:text-[11px]">Limited</span>
          )
        )}
      </div>

      <div className="mb-3 flex flex-col gap-0.5">
        <span className="text-base font-semibold sm:text-lg">{unitPriceLabel(formatNaira(price), product.unit)}</span>
        <span className="text-xs text-muted">
          {!cart.isSubscriber && product.memberPrice < product.standardPrice ? <>Members pay {formatNaira(product.memberPrice)}</> : <>&nbsp;</>}
        </span>
      </div>

      {product.soldOut && quantity === 0 ? (
        <p className="mt-auto flex h-9 items-center text-xs text-muted">Back soon</p>
      ) : (
        <div className="mt-auto">
          <QuantityStepper
            quantity={quantity}
            min={product.minOrderQty}
            step={product.stepQty}
            label={product.name}
            loading={cart.loadingProductId === product.id}
            suffix={signedIn ? "in your order" : "in cart"}
            onAddFrom={(el) => flyToCart(el, product.imageEmoji)}
            onChange={(next) => cart.setQuantity(product, next)}
          />
        </div>
      )}
    </Card>
  );
}
