"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Icon } from "@/components/ui/icon";
import { spring } from "@/lib/motion/tokens";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function CartDrawer() {
  const cart = useCart();

  useBodyScrollLock(cart.isOpen);

  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);

  return (
    <AnimatePresence>
      {cart.isOpen && (
        <div className="fixed inset-0 z-(--z-sheet) flex justify-end">
          <motion.button
            aria-label="Close cart"
            onClick={cart.closeDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-scrim"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring.sheet}
            className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5">
              <h2 className="text-lg font-semibold">Your cart</h2>
              <button
                onClick={cart.closeDrawer}
                className="tap-target flex items-center justify-center text-muted hover:text-foreground"
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {cart.items.length === 0 ? (
                <p className="text-sm text-muted">Nothing in your cart yet. Add produce from the shop.</p>
              ) : (
                <ul className="space-y-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {cart.items.map((item) => {
                      const price = cart.isSubscriber ? item.memberPrice : item.standardPrice;
                      return (
                        <motion.li
                          key={item.productId}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={spring.smooth}
                          className="flex items-center gap-3"
                        >
                          <ProductImage
                            publicId={item.cloudinaryPublicId}
                            alt={item.name}
                            emoji={item.imageEmoji}
                            className="h-12 w-12 shrink-0"
                            rounded="rounded-lg"
                            emojiClassName="text-xl"
                            sizes="48px"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted">
                              {item.unit} · {formatNaira(price)}
                            </p>
                          </div>
                          <QuantityStepper
                            variant="inline"
                            quantity={item.quantity}
                            min={item.minOrderQty}
                            step={item.stepQty}
                            label={item.name}
                            alwaysStepper
                            onChange={(next) => cart.setQuantity(toAddable(item), next)}
                          />
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            <div className="border-t border-border px-4 py-4 sm:px-5">
              {!cart.isSubscriber && cart.savingsIfMember > 0 && (
                <p className="mb-2 text-xs text-carbon">
                  Members would pay {formatNaira(cart.memberSubtotal)} for this cart.{" "}
                  <Link href="/subscribe" className="underline" onClick={cart.closeDrawer}>
                    see subscription
                  </Link>
                </p>
              )}
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">
                  <RollingNumber value={cart.subtotal} format={formatNaira} />
                </span>
              </div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted">Delivery</span>
                <span>{delivery.isFree ? "Free" : formatNaira(delivery.fee)}</span>
              </div>

              {!delivery.isFree && (
                <p className="mb-3 text-xs text-muted">
                  Add {formatNaira(delivery.toFreeDelivery)} more for free delivery.
                </p>
              )}

              <div className="flex gap-2">
                <Link
                  href="/cart"
                  onClick={cart.closeDrawer}
                  className="flex-1 rounded-full border border-carbon px-4 py-3 text-center text-sm font-medium text-carbon hover:bg-sky-wash"
                >
                  View cart
                </Link>
                <Link
                  href="/checkout"
                  onClick={cart.closeDrawer}
                  className="flex-1 rounded-full bg-carbon px-4 py-3 text-center text-sm font-medium text-white hover:bg-carbon/85"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function toAddable(item: ReturnType<typeof useCart>["items"][number]) {
  return {
    id: item.productId,
    slug: item.slug,
    name: item.name,
    unit: item.unit,
    orderUnit: item.orderUnit,
    minOrderQty: item.minOrderQty,
    stepQty: item.stepQty,
    imageEmoji: item.imageEmoji,
    cloudinaryPublicId: item.cloudinaryPublicId,
    memberPrice: item.memberPrice,
    standardPrice: item.standardPrice,
  };
}
