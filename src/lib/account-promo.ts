// Internal promotional content for the account page's banner slot. Kept as
// data, not hardcoded into the page, so a new promo (or turning it off) is a
// one-line edit here rather than a change to account/page.tsx. Only one promo
// shows at a time: the first whose date window (if any) covers now.

export type AccountPromo = {
  id: string;
  message: string;
  ctaLabel?: string;
  href?: string;
  /** ISO date strings. Omit either to leave that side of the window open. */
  startsAt?: string;
  endsAt?: string;
};

export const ACCOUNT_PROMOS: AccountPromo[] = [
  // Example shape, left commented so the slot is easy to light up later:
  // {
  //   id: "harmattan-2026",
  //   message: "Harmattan restock: citrus and root veg are back in season.",
  //   ctaLabel: "See what's in season",
  //   href: "/shop?inSeason=1",
  //   startsAt: "2026-11-01",
  //   endsAt: "2026-12-15",
  // },
];

export function getActiveAccountPromo(now: Date = new Date()): AccountPromo | null {
  return (
    ACCOUNT_PROMOS.find((p) => {
      if (p.startsAt && now < new Date(p.startsAt)) return false;
      if (p.endsAt && now > new Date(p.endsAt)) return false;
      return true;
    }) ?? null
  );
}
