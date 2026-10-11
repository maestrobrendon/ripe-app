import type { StarterCandidate, StarterPick } from "@/lib/starter-basket-core";

export type ShowcaseGoal = {
  slug: string;
  tab: string;
  title: string;
  body: string;
  adults: number;
  kids: number;
  picks: StarterPick[];
  standardTotal: number;
  memberTotal: number;
};

export type FarmProduct = {
  id: string;
  name: string;
  category: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  standardPrice: number;
  unit: string;
  inSeason: boolean;
};

export type HomeData = {
  signedIn: boolean;
  firstName: string | null;
  goals: ShowcaseGoal[];
  estimatorCandidates: StarterCandidate[];
  farm: FarmProduct[];
  zones: { name: string; days: string[] }[];
  comingSoon: string[];
  /** The delivery day most served zones share, e.g. "Wednesday". */
  deliveryDay: string;
  /** Cheapest membership, per month. Null if no tier is configured. */
  memberFee: number | null;
  freeDeliveryThreshold: number;
  deliveryFee: number;
};
