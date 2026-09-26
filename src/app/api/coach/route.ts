import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { recomputeStreak } from "@/lib/streak";
import { computeCoachProgress } from "@/lib/coach";
import { STREAK_MILESTONES, type StreakView } from "@/lib/streak-config";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";

export type CoachProduct = {
  slug: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  price: number;
};

export type CoachReply = {
  id: string;
  /** The chip the customer taps. */
  question: string;
  answer: string;
  products?: CoachProduct[];
  link?: { label: string; href: string };
};

function nextRewardLine(view: StreakView): string | null {
  if (view.nextMilestoneWeeks == null) return null;
  const milestone = STREAK_MILESTONES.find((m) => m.weeks === view.nextMilestoneWeeks);
  if (!milestone) return null;
  const toGo = milestone.weeks - view.currentStreakWeeks;
  return `${toGo} more ${toGo === 1 ? "week" : "weeks"} of ordering unlocks ${milestone.reward.toLowerCase()}.`;
}

export async function GET() {
  const user = await getCurrentUser();
  const isSubscriber = Boolean(user?.subscriptionTierId);

  const [inSeason, orders, streak, basketView] = await Promise.all([
    prisma.product.findMany({
      where: { inSeason: true, featured: true, category: { in: ["FRUIT", "VEGETABLE", "SEASONAL"] } },
      select: {
        slug: true,
        name: true,
        imageEmoji: true,
        cloudinaryPublicId: true,
        memberPrice: true,
        standardPrice: true,
      },
      orderBy: { name: "asc" },
      take: 3,
    }),
    user ? prisma.order.count({ where: { userId: user.id } }) : Promise.resolve(0),
    // Recomputed rather than read from streakStatus: placing an order does not
    // refresh that row, so a read can trail reality right after a checkout, and
    // a wrong number is worse here than one upsert per widget open.
    user ? recomputeStreak(user.id) : Promise.resolve(null),
    user ? getStandingBasketView(user.id) : Promise.resolve(null),
  ]);

  const priceOf = (p: { memberPrice: number; standardPrice: number }) =>
    isSubscriber ? p.memberPrice : p.standardPrice;

  const seasonal: CoachProduct[] = inSeason.map((p) => ({
    slug: p.slug,
    name: p.name,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    price: priceOf(p),
  }));

  const basketItems = basketView?.basket.items ?? [];
  const progress = computeCoachProgress({
    orders,
    streakWeeks: streak?.currentStreakWeeks ?? 0,
    basketKinds: basketItems.length,
  });

  const replies: CoachReply[] = [
    {
      id: "in-season",
      question: "What is good right now?",
      answer:
        seasonal.length > 0
          ? "These are in season and picked this week."
          : "Nothing is flagged in season at the moment. The full shop is still open.",
      products: seasonal,
      link: { label: "Browse the shop", href: "/shop" },
    },
    {
      id: "rewards",
      question: "How do rewards work?",
      answer: streak
        ? [
            `You are on a ${streak.currentStreakWeeks}-week streak.`,
            nextRewardLine(streak) ??
              "You have reached every streak milestone. Your longest run is " +
                `${streak.longestStreakWeeks} weeks.`,
          ].join(" ")
        : "A completed order each week builds a streak. Streaks unlock delivery credit, vouchers and early access to seasonal produce. Skipping a week does not break it.",
      link: user
        ? { label: "See your account", href: "/account" }
        : { label: "Get started", href: "/start" },
    },
    {
      id: "how-it-works",
      question: "How does ordering work?",
      answer: `Build a basket, pick the day it ships (${SHOPPING_WINDOW_DAYS.map((d) => d.label).join(
        ", ",
      )}), and it stays saved and editable until you check out. Nothing is charged automatically.`,
      link: { label: user ? "Open my basket" : "Get started", href: user ? "/basket" : "/start" },
    },
    {
      id: "human",
      question: "Talk to a person",
      answer: "A person on the Basket team can pick this up on WhatsApp.",
    },
  ];

  return NextResponse.json({
    signedIn: Boolean(user),
    firstName: user?.name?.split(" ")[0] ?? null,
    progress,
    streak,
    replies,
  });
}
