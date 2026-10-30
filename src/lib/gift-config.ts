/** What a gift can be worth (naira): a small basket, a family basket, a big one. Client-safe. */
export const GIFT_VALUES = [
  { amount: 7500, label: "A small basket", sub: "Fruit and a few vegetables for one or two" },
  { amount: 15000, label: "A family basket", sub: "A week of fruit and veg for a household" },
  { amount: 25000, label: "A big basket", sub: "Everything they'd want, and then some" },
] as const;

export const GIFT_DESIGNS = [
  { id: "mint", label: "Fresh", bg: "#d8f5e6", ink: "#0f7a48", ribbon: "#0f7a48" },
  { id: "sun", label: "Sunny", bg: "#fff1c2", ink: "#8a5a00", ribbon: "#e0a100" },
  { id: "berry", label: "Berry", bg: "#ffdfe6", ink: "#a3214a", ribbon: "#d6336c" },
  { id: "leaf", label: "Leafy", bg: "#e3efd3", ink: "#3c6a12", ribbon: "#5a8f1f" },
] as const;

export type GiftDesign = (typeof GIFT_DESIGNS)[number]["id"];
