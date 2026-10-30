import "server-only";
import { prisma } from "@/lib/prisma";
import { grantCredit } from "@/lib/credit";
import { notify } from "@/lib/notify";
import { REFERRAL_REWARD } from "@/lib/referrals";
import { formatNaira } from "@/lib/format";

/**
 * Called when an order is delivered. If this customer joined with someone's
 * invite and this is their first delivery, both get REFERRAL_REWARD in
 * credit, once.
 */
export async function rewardInviteIfDue(userId: string | null) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, referredById: true, referralRewardedAt: true } });
  if (!user?.referredById || user.referralRewardedAt) return;
  const delivered = await prisma.order.count({ where: { userId, status: "DELIVERED" } });
  if (delivered !== 1) return;

  // Claim it first, so two deliveries landing together can't pay twice.
  const { count } = await prisma.user.updateMany({ where: { id: userId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
  if (!count) return;

  const referrer = await prisma.user.findUnique({ where: { id: user.referredById }, select: { id: true, name: true, email: true, phone: true, erasedAt: true } });
  await grantCredit({ userId, amount: REFERRAL_REWARD, reason: "Welcome credit: joined with an invite", staffName: "System" });
  if (referrer && !referrer.erasedAt) {
    await grantCredit({ userId: referrer.id, amount: REFERRAL_REWARD, reason: `Invite reward: ${user.name ?? "a friend"} had their first delivery`, staffName: "System" });
    const text = `${user.name?.split(" ")[0] ?? "Your friend"} just had their first Basket delivery, so there's ${formatNaira(REFERRAL_REWARD)} credit on your account. It comes off your next order.`;
    await notify({
      userId: referrer.id,
      kind: "invite.rewarded",
      dedupeKey: `invite.rewarded:${userId}`,
      email: { to: referrer.email, subject: `${formatNaira(REFERRAL_REWARD)} credit for your invite`, text, tag: { label: "Invite reward", tone: "lavender" } },
      whatsapp: { to: referrer.phone, text: `Basket: ${text}` },
    }).catch(() => {});
  }
}
