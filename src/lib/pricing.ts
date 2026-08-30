// Order-economics levers for solving the small-order delivery-cost problem.
// These are founder-tunable placeholders. See the brief, Section 5.

/** Minimum cart value (in Naira) required to check out at all. */
export const ORDER_MINIMUM = 12000;

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

export type MinimumCheck = {
  meetsMinimum: boolean;
  shortfall: number;
};

export function checkMinimum(subtotal: number): MinimumCheck {
  return {
    meetsMinimum: subtotal >= ORDER_MINIMUM,
    shortfall: Math.max(0, ORDER_MINIMUM - subtotal),
  };
}
