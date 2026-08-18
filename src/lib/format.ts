const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

export const DELIVERY_DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  WEDNESDAY: "Wednesday",
  FRIDAY: "Friday",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Received",
  SOURCED: "Sourced",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export const ORDER_STATUS_STEPS = [
  "RECEIVED",
  "SOURCED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;
