import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { DELIVERY_DAY_LABEL, formatNaira } from "@/lib/format";
import { KachiMark } from "@/components/kachi-mark";
import { MENU } from "../home-menu/recipes";

// The last beat of sign-up: a bare page (see src/proxy.ts) in the homepage's look.
import "../home-menu/home-menu.css";

export const metadata = { title: "You're in. Basket" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ recipes?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { recipes: picked } = await searchParams;

  const slugs = (picked ?? "").split(",");
  const recipes = MENU.filter((r) => slugs.includes(r.slug));
  const basket = await prisma.basket.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { deliveryDay: true, items: { select: { quantity: true, product: { select: { standardPrice: true } } } } },
  });
  const items = basket?.items ?? [];
  const value = items.reduce((s, i) => s + i.product.standardPrice * i.quantity, 0);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const day = basket?.deliveryDay ?? user.deliveryDay;
  const where = user.deliveryZone
    ? `${user.deliveryZone.name}, ${day ? `${DELIVERY_DAY_LABEL[day] ?? day}s` : "your day"}`
    : "Not in your area yet";
  const askKachi = recipes[0] ? `Swap ${recipes[0].title.toLowerCase()} for something else` : "Plan my dinners for this week";

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      <header className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center">
        <Link href="/basket" className="logo-wordmark text-[22px] leading-none" aria-label="Basket">
          Basket
        </Link>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-6 pb-16">
        <KachiMark className="h-14 w-14" />
        <h1 className="mt-5 text-[clamp(2rem,7vw,2.75rem)] leading-[1.04] font-semibold tracking-[-0.045em]">You&apos;re in, {firstName}.</h1>
        <p className="hm-lede mt-3">Your week is saved. Change anything in your basket until the night before it goes out.</p>

        {recipes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[15px] font-semibold text-(--hm-ink-2)">Your recipes</h2>
            <ul className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {recipes.map((r) => (
                <li key={r.slug} className="w-40 shrink-0 snap-start">
                  <span className="relative block aspect-4/3 overflow-hidden rounded-[18px]">
                    <Image src={r.image} alt={r.alt} fill sizes="160px" className="object-cover" />
                  </span>
                  <b className="mt-2 block text-[14px] leading-snug font-semibold">{r.title}</b>
                  <span className="text-[12px] text-(--hm-ink-3)">{r.minutes} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="hm-panel mt-8 divide-y divide-(--hm-line) px-5 text-[14px]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-(--hm-ink-2)">Your basket</dt>
            <dd className="text-right font-semibold">
              {items.length} items, {formatNaira(value)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-(--hm-ink-2)">Delivery</dt>
            <dd className="text-right font-semibold">{where}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-(--hm-ink-2)">Paying</dt>
            <dd className="text-right font-semibold">Only when you check out</dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-3">
          <Link href="/basket" className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
            Open my basket
          </Link>
          <Link href="/recipes" className="flex h-14 items-center justify-center rounded-full bg-(--hm-tint-2) text-[16px] font-semibold">
            See every recipe
          </Link>
        </div>

        <Link href="/assistant" className="hm-panel mt-6 flex items-start gap-3 p-4">
          <KachiMark className="h-9 w-9" />
          <span className="min-w-0">
            <b className="block text-[15px] font-semibold">Kachi keeps planning with you</b>
            <span className="mt-0.5 block text-[14px] leading-snug text-(--hm-ink-2)">Try &ldquo;{askKachi}&rdquo;.</span>
          </span>
        </Link>
      </main>
    </div>
  );
}
