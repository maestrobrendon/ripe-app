// Delivery-fee levers. There is no cart-wide order minimum: each product carries
// its own minimum order quantity and step size on the Product model.
// These figures are founder-tunable placeholders. See the brief, Section 5.

/** Cart value at or above which delivery is free for everyone. */
export const FREE_DELIVERY_THRESHOLD = 25000;

/** Flat delivery fee applied below the free-delivery threshold. */
export const BASE_DELIVERY_FEE = 2000;

export type DeliveryQuote = {
  fee: number;
  isFree: boolean;
  /** Naira still needed to reach free delivery, or 0 if already there. */
  toFreeDelivery: number;
};

/**
 * Delivery fee for a given subtotal. Subscribers get free delivery as a perk;
 * everyone else gets it free above FREE_DELIVERY_THRESHOLD.
 */
export function quoteDelivery(subtotal: number, isSubscriber: boolean): DeliveryQuote {
  if (isSubscriber || subtotal >= FREE_DELIVERY_THRESHOLD) {
    return { fee: 0, isFree: true, toFreeDelivery: 0 };
  }
  return {
    fee: BASE_DELIVERY_FEE,
    isFree: false,
    toFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
  };
}
