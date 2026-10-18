import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { supportHref, supportVerb } from "@/lib/support";
import { customerStatusLabel, OPEN_STATUSES } from "@/lib/order-status";
import { pendingPlanRequest } from "@/lib/plans";
import { creditBalance } from "@/lib/credit";
import { newReferralCode, REFERRAL_REWARD } from "@/lib/referrals";
import { addressLine } from "@/lib/addresses";
import { formatPhone } from "@/lib/phone";
import { basketName, orderRef, shortDate } from "@/lib/delivery-labels";
import { confirmRight } from "@/lib/basket-rules";
import { AccountView } from "./account-view";

export const metadata = { title: "Me" };

/** The next monthly anniversary of the membership start, from today. */
function nextRenewal(start: Date) {
  const now = new Date();
  const d = new Date(start);
  while (d <= now) d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

/** A code to share, made the first time someone looks for it. */
async function ensureReferralCode(user: { id: string; name: string | null; referralCode: string | null }) {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 4; i++) {
    const code = newReferralCode(user.name);
    try {
      await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
      return code;
    } catch {
      // Taken: try another.
    }
  }
  return null;
}

/** The latest plan request, if it was turned down in the last 30 days. */
function recentlyDeclined<T extends { status: string; decidedAt: Date | null }>(request: T | null): T | null {
  if (request?.status !== "DECLINED" || !request.decidedAt) return null;
  return Date.now() - request.decidedAt.getTime() < 30 * 86_400_000 ? request : null;
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [lastOrder, liveOrder, orderCount, pending, lastRequest, defaultAddress, addressCount, credit, invited, rewarded, settings, code, baskets, right] = await Promise.all([
    prisma.order.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.order.findFirst({ where: { userId: user.id, status: { in: OPEN_STATUSES } }, orderBy: { deliveryDate: "asc" }, select: { status: true, deliveryDate: true } }),
    prisma.order.count({ where: { userId: user.id } }),
    pendingPlanRequest(user.id),
    prisma.planRequest.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { tier: { select: { name: true } } } }),
    prisma.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { label: true, line1: true, estate: true, zone: { select: { name: true } } } }),
    prisma.address.count({ where: { userId: user.id } }),
    creditBalance(user.id),
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.user.count({ where: { referredById: user.id, referralRewardedAt: { not: null } } }),
    getSiteSettings(),
    ensureReferralCode(user),
    prisma.basket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { name: true, isStanding: true } }),
    confirmRight(user),
  ]);

  const tier = user.subscriptionTier;
  const declined = recentlyDeclined(lastRequest);
  const first = user.name?.split(" ")[0] ?? "";
  const helpText = `Hi, it's ${first || "a Basket customer"}${user.phone ? ` (${formatPhone(user.phone)})` : ""}.${lastOrder ? ` My last order was ${orderRef(lastOrder.id)}.` : ""} `;

  return (
    <AccountView
      name={user.name ?? ""}
      email={user.email ?? ""}
      phone={user.phone ? formatPhone(user.phone) : ""}
      hasPassword={Boolean(user.passwordHash)}
      address={defaultAddress ? { label: defaultAddress.label, line: addressLine(defaultAddress), zone: defaultAddress.zone.name, count: addressCount } : null}
      adults={user.householdAdults}
      kids={user.householdKids}
      goal={user.preferences?.primaryGoal ?? ""}
      likes={user.preferences?.producePreferences ?? []}
      dietaryNotes={user.preferences?.dietaryNotes ?? ""}
      membership={
        tier
          ? { state: "member", tierName: tier.name, monthlyFee: tier.monthlyFee, renews: user.subscribedAt ? nextRenewal(user.subscribedAt) : null }
          : pending
            ? { state: "pending", tierName: pending.tier.name, monthlyFee: pending.tier.monthlyFee, renews: null }
            : declined
              ? { state: "declined", tierName: declined.tier.name, monthlyFee: 0, renews: null, note: declined.decidedNote ?? null }
              : null
      }
      orders={{ count: orderCount, live: liveOrder ? `${customerStatusLabel(liveOrder.status)} · ${shortDate(liveOrder.deliveryDate)}` : null }}
      notify={{ whatsapp: user.notifyWhatsApp, email: user.notifyEmail, push: user.notifyPush }}
      baskets={{ names: baskets.map(basketName), running: baskets.filter((b) => b.isStanding).length }}
      trial={tier ? null : right.ok ? "available" : "used"}
      invite={{ code, reward: REFERRAL_REWARD, invited, rewarded, credit }}
      kachiReview={Boolean(user.kachiReviewConsentAt)}
      deletionRequested={user.deletionRequestedAt?.toISOString() ?? null}
      help={{ href: supportHref(settings.support, helpText, "Help with my account"), verb: supportVerb(settings.support) }}
    />
  );
}
