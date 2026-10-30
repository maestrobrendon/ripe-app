import "server-only";
import { cookies } from "next/headers";
import { claimGift } from "@/lib/gifts";
import { rewardFeedback } from "@/lib/feedback";

/*
 * Something to collect once they're signed in: a gift opened while signed
 * out, or a feedback reward earned as a guest. It's remembered in a cookie
 * for a week and collected the moment they sign in or finish signing up.
 */

const GIFT = "basket_pending_gift";
const FEEDBACK = "basket_pending_feedback";
const WEEK = 7 * 24 * 3600;

async function remember(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: WEEK });
}

export const rememberGiftClaim = (code: string) => remember(GIFT, code.slice(0, 20));
export const rememberFeedbackClaim = (id: string) => remember(FEEDBACK, id.slice(0, 40));

/** Collects anything waiting for this customer. Never throws: signing in must not fail because of it. */
export async function collectPendingClaims(userId: string): Promise<void> {
  try {
    const jar = await cookies();
    const gift = jar.get(GIFT)?.value;
    const feedback = jar.get(FEEDBACK)?.value;
    if (gift) {
      await claimGift(userId, gift).catch(() => null);
      jar.delete(GIFT);
    }
    if (feedback) {
      await rewardFeedback(userId, feedback).catch(() => null);
      jar.delete(FEEDBACK);
    }
  } catch {
    /* nothing to collect */
  }
}
