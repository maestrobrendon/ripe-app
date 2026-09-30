"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { press, spring, stagger } from "@/lib/motion/tokens";

export type TodayPick = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  orderUnit: string;
  minOrderQty: number;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
};

/**
 * "Buy something today": one-off produce added straight to the cart, never
 * to the recurring basket. Distinct service and distinct destination from
 * the "Often added" rail above it.
 */
export function TodayPicks({ picks }: { picks: TodayPick[] }) {
  const cart = useCart();

  if (picks.length === 0) return null;

  return (
    <div
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
      }}
    >
      {picks.map((p, i) => {
        const inCart = cart.items.some((l) => l.productId === p.id);
        const price = cart.isSubscriber ? p.memberPrice : p.standardPrice;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.snappy, delay: Math.min(i, 8) * stagger.tight }}
            className="w-[124px] shrink-0"
          >
            <div className="relative">
              <Link href={`/products/${p.slug}`}>
                <ProductImage
                  publicId={p.cloudinaryPublicId}
                  alt={p.name}
                  emoji={p.imageEmoji}
                  className="h-[104px] w-full"
                  rounded="rounded-2xl"
                  emojiClassName="text-4xl"
                  sizes="124px"
                />
              </Link>
              <motion.button
                type="button"
                aria-label={inCart ? `${p.name} is in your cart` : `Add ${p.name} to your cart`}
                disabled={cart.loadingProductId === p.id}
                onClick={() =>
                  cart.setQuantity(
                    {
                      id: p.id,
                      slug: p.slug,
                      name: p.name,
                      unit: p.unit,
                      orderUnit: p.orderUnit,
                      minOrderQty: p.minOrderQty,
                      stepQty: p.stepQty,
                      imageEmoji: p.imageEmoji,
                      cloudinaryPublicId: p.cloudinaryPublicId,
                      memberPrice: p.memberPrice,
                      standardPrice: p.standardPrice,
                    },
                    inCart ? 0 : p.minOrderQty,
                  )
                }
                whileTap={{ scale: press.scale }}
                transition={spring.snappy}
                className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-60 ${
                  inCart ? "bg-carbon" : "bg-carbon"
                }`}
              >
                <Icon name={inCart ? "checkPlain" : "plus"} size={16} weight="bold" />
              </motion.button>
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-muted">
              {formatNaira(price)} {p.unit}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
