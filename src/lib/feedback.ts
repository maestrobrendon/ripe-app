import "server-only";
import { prisma } from "@/lib/prisma";
import { grantCredit } from "@/lib/credit";
import { FEEDBACK_REWARD } from "@/lib/feedback-config";

export { FEEDBACK_REWARD };

/** Feedback left more than this long ago can't be claimed by signing in later. */
const CLAIM_WINDOW_MS = 7 * 24 * 3600 * 1000;

export type RewardResult = { ok: true; amount: number } | { ok: false; reason: "already" | "gone" };

/**
 * Credits the feedback reward to a customer, once per account: for feedback
 * they gave signed in, or gave as a guest and signed in afterwards to claim.
 */
export async function rewardFeedback(userId: string, feedbackId: string): Promise<RewardResult> {
  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb || (fb.userId && fb.userId !== userId) || Date.now() - fb.createdAt.getTime() > CLAIM_WINDOW_MS) return { ok: false, reason: "gone" };
  if (await hadFeedbackReward(userId)) {
    if (!fb.userId) await prisma.feedback.update({ where: { id: fb.id }, data: { userId } });
    return { ok: false, reason: "already" };
  }
  // Only the first claim wins, even if two arrive at once.
  const { count } = await prisma.feedback.updateMany({ where: { id: fb.id, rewarded: false }, data: { userId, rewarded: true } });
  if (count === 0) return { ok: false, reason: "already" };
  await grantCredit({ userId, amount: FEEDBACK_REWARD, reason: "Thank you for your feedback", staffName: "Feedback" });
  return { ok: true, amount: FEEDBACK_REWARD };
}

/** Whether this customer has already had the feedback reward. */
export async function hadFeedbackReward(userId: string) {
  return Boolean(await prisma.feedback.findFirst({ where: { userId, rewarded: true }, select: { id: true } }));
}
