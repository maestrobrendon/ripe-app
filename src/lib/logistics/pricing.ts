/*
 * Delivery pricing by distance. One rule, set in Logistics: a base fee, a
 * price per kilometre (after any kilometres the base covers), rounded up to a
 * tidy amount, and kept between a minimum and a maximum. Pure and standalone.
 */

export type PricingRules = {
  /** Charged on every delivery, in naira. */
  baseFee: number;
  /** Per road kilometre beyond `includedKm`, in naira. */
  perKm: number;
  /** Kilometres the base fee already covers. */
  includedKm: number;
  /** The fee never goes below this. */
  minFee: number;
  /** Nor above this (0 means no cap). */
  maxFee: number;
  /** Round the fee up to a multiple of this (e.g. 50 or 100). */
  roundTo: number;
};

export type PriceBreakdown = {
  distanceKm: number;
  chargedKm: number;
  base: number;
  distanceCharge: number;
  /** Before rounding and the min/max. */
  raw: number;
  fee: number;
  /** What changed the raw number, in words, for the calculator. */
  notes: string[];
};

export function priceDelivery(distanceKm: number, r: PricingRules): PriceBreakdown {
  const km = Math.max(0, distanceKm);
  const chargedKm = Math.max(0, km - r.includedKm);
  const distanceCharge = chargedKm * r.perKm;
  const raw = r.baseFee + distanceCharge;
  const notes: string[] = [];
  let fee = r.roundTo > 1 ? Math.ceil(raw / r.roundTo) * r.roundTo : Math.round(raw);
  if (fee !== Math.round(raw)) notes.push(`Rounded up to the nearest ₦${r.roundTo}`);
  if (fee < r.minFee) {
    fee = r.minFee;
    notes.push("Raised to the minimum fee");
  }
  if (r.maxFee > 0 && fee > r.maxFee) {
    fee = r.maxFee;
    notes.push("Capped at the maximum fee");
  }
  return { distanceKm: Math.round(km * 10) / 10, chargedKm: Math.round(chargedKm * 10) / 10, base: r.baseFee, distanceCharge: Math.round(distanceCharge), raw: Math.round(raw), fee, notes };
}
