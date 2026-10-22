import { randomBytes } from "crypto";

/*
 * Invites. Food spreads through the estate group, church and the office, so
 * every customer has a code to share on WhatsApp. When someone who joined
 * with it has their first delivery, both get REFERRAL_REWARD in credit
 * (see rewardInviteIfDue in referral-rewards.ts).
 */

export const REFERRAL_REWARD = 1000;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "BREN7K2Q": the start of their name and four characters nobody can misread. */
export function newReferralCode(name: string | null | undefined): string {
  const stem = (name ?? "").normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "BSKT";
  const bytes = randomBytes(4);
  return stem + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A code as typed or pasted, cleaned up for lookup. */
export const cleanReferralCode = (raw: string | null | undefined) => (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
