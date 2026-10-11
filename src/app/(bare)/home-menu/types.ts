import type { StarterCandidate } from "@/lib/starter-basket-core";

/** What the page needs to know about a catalogue item a recipe uses. */
export type MenuProduct = {
  slug: string;
  name: string;
  category: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
};

export type MenuData = {
  signedIn: boolean;
  /** Keyed by slug. A recipe ingredient missing here is treated as "elsewhere". */
  products: Record<string, MenuProduct>;
  estimatorCandidates: StarterCandidate[];
  zones: { name: string; days: string[] }[];
  comingSoon: string[];
  /** The delivery day most served zones share, e.g. "Wednesday". */
  deliveryDay: string;
  /** Cheapest membership, per month. Null if no tier is configured. */
  memberFee: number | null;
  freeDeliveryThreshold: number;
  deliveryFee: number;
};
