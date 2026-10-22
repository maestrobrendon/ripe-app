import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { DELIVERY_DAY_LABEL, formatNaira } from "@/lib/format";
import { KachiMark } from "@/components/kachi-mark";
import { SuccessMark } from "@/components/ui/success-mark";
import { getMenu } from "@/lib/menu";
import { zoneForUser } from "@/lib/delivery";
import { WelcomeChoice } from "./welcome-choice";

// The last beat of sign-up: a bare page (see src/proxy.ts) in the homepage's look.
import "../home-menu/home-menu.css";

export const metadata = { title: "You're in. Basket" };

/**
 * Straight after sign-up. The account is made and the first basket is saved,
 * not placed, so the one decision left is the customer's: confirm it now
 * (and pay when it arrives, or now by transfer) or keep it for later.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ recipes?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { recipes: picked } = await searchParams;

  const slugs = (picked ?? "").split(",");
  const recipes = (await getMenu()).filter((r) => slugs.includes(r.slug) && r.image);
  const basket = await prisma.basket.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, deliveryDay: true, items: { select: { quantity: true, product: { select: { standardPrice: true } } } } },
  });
  const items = basket?.items ?? [];
  const value = items.reduce((s, i) => s + i.product.standardPrice * i.quantity, 0);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const day = basket?.deliveryDay ?? user.deliveryDay;
  // Where we'd deliver: the address if there is one, else the area picked at sign-up (null if we don't serve it).
  const zone = await zoneForUser(user.id);
  const served = Boolean(zone);
  const canConfirm = Boolean(basket && items.length && served);
  const summary = items.length
    ? `${items.length} ${items.length === 1 ? "item" : "items"}, ${formatNaira(value)}${zone && day ? `, ${DELIVERY_DAY_LABEL[day] ?? day}s in ${zone.name}` : ""}.`
    : "Add what you'd like on Home whenever you're ready.";
  const askKachi = recipes[0] ? `Swap ${recipes[0].title.toLowerCase()} for something else` : "What can I make with mangoes?";

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      <header className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center">
        <Link href="/basket" className="logo-wordmark text-[22px] leading-none" aria-label="Basket">
          Basket
        </Link>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-4 pb-16">
        <SuccessMark size={64} />
        <h1 className="mt-5 text-[clamp(2rem,7vw,2.75rem)] leading-[1.04] font-semibold tracking-[-0.045em]">You&apos;re in, {firstName}.</h1>
        <p className="hm-lede mt-3">Your first basket is saved: {summary}</p>

        <WelcomeChoice canConfirm={canConfirm} checkoutHref={basket ? `/checkout?b=${basket.id}` : "/basket"} areaName={user.deliveryZone?.name ?? null} />

        <p className="mt-4 text-center text-[13px] text-(--hm-ink-3)">Your first basket is a trial at market prices. Nothing is ever charged automatically.</p>

        {recipes.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[15px] font-semibold text-(--hm-ink-2)">Your recipes</h2>
            <ul className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {recipes.map((r) => (
                <li key={r.slug} className="w-40 shrink-0 snap-start">
                  <Link href={`/recipes/${r.slug}`} className="block">
                    <span className="relative block aspect-4/3 overflow-hidden rounded-[18px]">
                      <Image src={r.image} alt={r.alt} fill sizes="160px" className="object-cover" />
                    </span>
                    <b className="mt-2 block text-[14px] leading-snug font-semibold">{r.title}</b>
                    <span className="text-[12px] text-(--hm-ink-3)">{r.minutes} min</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/assistant" className="hm-panel mt-8 flex items-start gap-3 p-4">
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
