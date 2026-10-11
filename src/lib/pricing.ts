// Delivery-fee levers. There is no cart-wide order minimum: each product carries
// its own minimum order quantity and step size on the Product model.
// Each delivery area has its own fee (DeliveryZone.deliveryFee, set in the
// admin); BASE_DELIVERY_FEE is only the fallback when no area is known yet.

/** Default cart value for free delivery; the live figure is a site setting (Settings in the admin). */
export const FREE_DELIVERY_THRESHOLD = 25000;

/** Delivery fee when the customer's area isn't known yet. */
export const BASE_DELIVERY_FEE = 2000;

/** Plans whose members never pay for delivery (Member Plus). */
export const FREE_DELIVERY_PLAN_SLUGS = ["premium"];

export function hasFreeDelivery(planSlug: string | null | undefined): boolean {
  return Boolean(planSlug && FREE_DELIVERY_PLAN_SLUGS.includes(planSlug));
}

export type DeliveryQuote = {
  fee: number;
  isFree: boolean;
  /** Naira still needed to reach free delivery, or 0 if already there. */
  toFreeDelivery: number;
};

/**
 * Delivery fee for a given subtotal. Free on a plan that includes delivery,
 * or above FREE_DELIVERY_THRESHOLD; otherwise the area's fee.
 */
export function quoteDelivery(
  subtotal: number,
  freeDelivery: boolean,
  areaFee: number = BASE_DELIVERY_FEE,
  threshold: number = FREE_DELIVERY_THRESHOLD,
): DeliveryQuote {
  if (freeDelivery || subtotal >= threshold) {
    return { fee: 0, isFree: true, toFreeDelivery: 0 };
  }
  return {
    fee: areaFee,
    isFree: false,
    toFreeDelivery: Math.max(0, threshold - subtotal),
  };
}
