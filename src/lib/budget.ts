// Weekly produce-only spend bands. Shared by the Meal Planner and onboarding so
// the two stay consistent. Scaled to a produce basket, not a full grocery run.
export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export const BUDGET_BANDS: BudgetBand[] = [
  { id: "under-6k", label: "Under ₦6,000 a week", min: 0, max: 6000 },
  { id: "6k-12k", label: "₦6,000 to ₦12,000 a week", min: 6000, max: 12000 },
  { id: "12k-20k", label: "₦12,000 to ₦20,000 a week", min: 12000, max: 20000 },
  { id: "20k-plus", label: "₦20,000 or more a week", min: 20000, max: null },
];

export function bandById(id: string | null | undefined): BudgetBand | undefined {
  return BUDGET_BANDS.find((b) => b.id === id);
}

export function bandForAmount(amount: number): BudgetBand {
  return BUDGET_BANDS.find((b) => amount >= b.min && (b.max === null || amount < b.max)) ?? BUDGET_BANDS[0];
}

export function amountFitsBand(amount: number, bandId: string | null | undefined): boolean {
  const band = bandById(bandId);
  if (!band) return true;
  return amount >= band.min && (band.max === null || amount <= band.max);
}
