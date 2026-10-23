import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { OFFERED } from "@/lib/product";
import { MEMBER_BASKET_LIMIT } from "@/lib/basket";
import { Check, Eyebrow } from "@/app/(bare)/home-menu/parts/shared";
import { startSubscription } from "./actions";
import { CancelMembershipButton, SwitchPlanButton, WithdrawRequestButton } from "./plan-buttons";
import { pendingPlanRequest } from "@/lib/plans";
import "@/app/(bare)/home-menu/home-menu.css";

export const metadata: Metadata = {
  title: "Pricing. BasketNG",
  description: "Try one basket at market prices, or become a member: your baskets every week at member prices, a reminder before each delivery, and nothing charged automatically. Member Plus adds free delivery.",
};

/** "Chilli Pepper (Ata Rodo)" reads as "Chilli Pepper" in a price table. */
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "");

/** A few everyday items for the side-by-side, if the catalogue has them. */
const SAMPLE_SLUGS = ["tomato", "banana", "onion", "avocado", "spinach", "pineapple"];

type Cell = boolean | string;

/**
 * Who gets what, row by row. Columns: the trial, Member, Member Plus.
 * Two rows are the business's rules rather than code yet: recipe access is
 * not gated by plan, and checkout still prices delivery with the flat rule in
 * lib/pricing.ts until each delivery area has its own fee.
 */
function comparison(avgSaving: number): { label: string; cells: [Cell, Cell, Cell] }[] {
  const member = avgSaving > 0 ? `About ${avgSaving}% less` : "Member";
  return [
    { label: "Your basket every week", cells: ["Once, as a trial", true, true] },
    { label: "Baskets, like one for Mum", cells: ["One", `Up to ${MEMBER_BASKET_LIMIT}`, "Unlimited"] },
    { label: "Prices", cells: ["Market rate", member, member] },
    { label: "A reminder before each delivery", cells: [false, true, true] },
    { label: "Delivery", cells: ["Priced by area", "Priced by area", "Free"] },
    { label: "Recipes, with amounts and steps", cells: ["Most recipes", "Every recipe", "Every recipe"] },
    { label: "Kachi, your food assistant", cells: [true, true, true] },
    { label: "Weekly meal plan", cells: [false, true, true] },
    { label: "Early access to seasonal produce", cells: [false, false, true] },
    { label: "Priority support on WhatsApp", cells: [false, false, true] },
  ];
}

const FAQ = [
  { q: "Do I need a membership to try it?", a: "No. Your first basket is a trial: one delivery at market prices. To have your basket every week, or more than one basket, become a member." },
  { q: "Why are member prices so much lower?", a: "Membership is how we make our money, so members pay close to what we pay at the market. Everyone else pays the market rate." },
  { q: "When do I pay for food?", a: "When it arrives, by transfer or card to the rider, or by bank transfer before it's packed. A few days before each delivery we remind you on WhatsApp, email and the app; you confirm it yourself, change it until the evening before, or skip the week." },
  { q: "How much is delivery?", a: "It depends on where you are. Each delivery area has its own fee, shown before you pay. Delivery is free on Member Plus." },
  { q: "How is the membership paid?", a: "Once a month, by transfer. Nothing is charged automatically: we message you when it's due." },
  { q: "Can I switch plans or cancel?", a: "Yes, anytime, from this page or your account. If you cancel, your baskets stop coming every week; their produce stays saved." },
  { q: "Which plan is right for me?", a: "Member covers almost everyone. Member Plus is for people who want first pick of seasonal produce and faster help when something needs sorting." },
];

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ reason?: string; requested?: string; error?: string }> }) {
  const [tiers, user, { reason, requested, error }, samples, all] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
    searchParams,
    prisma.product.findMany({ where: { slug: { in: SAMPLE_SLUGS }, ...OFFERED } }),
    prisma.product.findMany({ where: OFFERED, select: { standardPrice: true, memberPrice: true } }),
  ]);

  const currentSlug = user?.subscriptionTier?.slug ?? null;
  const pending = user ? await pendingPlanRequest(user.id) : null;
  const discounted = all.filter((p) => p.memberPrice < p.standardPrice);
  const saving = discounted.length ? discounted.reduce((s, p) => s + (1 - p.memberPrice / p.standardPrice), 0) / discounted.length : 0;
  const avgSaving = Math.round(saving * 100);
  const rows = SAMPLE_SLUGS.map((s) => samples.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const featuredSlug = tiers[0]?.slug;


  // Guests make an account first, then land straight back on the plans.
  const joinHref = "/start?next=%2Fsubscribe%23plans";
  const solid = "inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-colors";

  return (
    <div className="hm">
      <section className="bg-[var(--hm-tint)]">
        <div className="hm-wrap py-12 text-center sm:py-16">
          <Eyebrow className="text-[#0f7a48]">Pricing</Eyebrow>
          <h1 className="hm-h2 mx-auto max-w-[20ch]">Fruit and veg every week, close to market cost.</h1>
          <p className="hm-lede mx-auto mt-4 max-w-2xl">
            Try your first basket at market prices. Members get their baskets every week at member prices, with a reminder before each
            delivery. You confirm, and pay when it arrives: nothing is charged automatically.
          </p>
        </div>
      </section>

      {reason === "free-basket-used" && (
        <div className="hm-wrap mt-8">
          <p className="rounded-[20px] border-[1.5px] border-dashed border-ember px-5 py-4 text-center text-[15px]">
            Your trial basket is for one delivery. Members get their baskets every week, up to {MEMBER_BASKET_LIMIT} of them (unlimited on Member Plus), at member prices. Your produce is saved and waiting.
          </p>
        </div>
      )}

      {error === "too-many" && (
        <div className="hm-wrap mt-8">
          <p role="alert" className="rounded-[20px] border-[1.5px] border-dashed border-ember px-5 py-4 text-center text-[15px]">
            You&apos;ve asked a few times this hour, so we didn&apos;t send another request. If you already asked, we have it; give it a little while.
          </p>
        </div>
      )}

      {reason === "basket-limit" && (
        <div className="hm-wrap mt-8">
          <p className="rounded-[20px] border-[1.5px] border-dashed border-ember px-5 py-4 text-center text-[15px]">
            You have {MEMBER_BASKET_LIMIT} baskets, the most a Member plan holds. Member Plus has no limit.
          </p>
        </div>
      )}

      {pending && (
        <div className="hm-wrap mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-sunburst/25 px-5 py-4">
            <p className="max-w-2xl text-[15px]">
              {requested ? "Request sent. " : ""}You asked to join <b className="font-semibold">{pending.tier.name}</b>. We&apos;ll email payment details within one
              working day, and your plan starts once payment is confirmed. Nothing is charged automatically.
            </p>
            <WithdrawRequestButton />
          </div>
        </div>
      )}

      {currentSlug && (
        <div className="hm-wrap mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-mint-pop/25 px-5 py-4">
            <p className="text-[15px]">
              You&apos;re on <b className="font-semibold">{user?.subscriptionTier?.name}</b>. Your baskets come every week, each on its own day.
            </p>
            <CancelMembershipButton />
          </div>
        </div>
      )}

      {/* The three ways to pay, side by side. Membership in the middle. */}
      <section id="plans" className="hm-wrap mt-10 scroll-mt-24" aria-label="Plans">
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <article className="flex flex-col rounded-[28px] bg-paper-white p-7 shadow-[0_0_0_1px_var(--hm-line)]">
            <h2 className="text-[17px] font-semibold">Trial basket</h2>
            <p className="mt-3 text-[2.4rem] leading-none font-semibold tracking-[-0.045em]">₦0</p>
            <p className="mt-1.5 text-[14px] text-[var(--hm-ink-2)]">No fee. Pay for the produce when it arrives.</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
              {[
                "One basket, delivered once",
                "The full produce list at market prices",
                "Most recipes, with amounts and steps",
                "No minimum order",
                "Delivery priced by your area",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[var(--hm-ink-3)]" /> {t}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link href="/start" className={`${solid} mt-7 bg-[var(--hm-tint)] hover:bg-[var(--hm-tint-2)]`}>
                Get started
              </Link>
            ) : !currentSlug ? (
              <p className={`${solid} mt-7 bg-[var(--hm-tint)] text-[var(--hm-ink-2)]`}>Where you are now</p>
            ) : null}
          </article>

          {tiers.map((tier) => {
            const featured = tier.slug === featuredSlug;
            const isCurrent = tier.slug === currentSlug;
            const button = featured ? "bg-paper-white text-carbon" : "bg-[var(--hm-tint)] hover:bg-[var(--hm-tint-2)]";
            return (
              <article
                key={tier.id}
                className={`relative flex flex-col rounded-[28px] p-7 ${featured ? "bg-carbon text-paper-white lg:-my-3 lg:py-10" : "bg-paper-white shadow-[0_0_0_1px_var(--hm-line)]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[17px] font-semibold">{tier.name}</h2>
                  {featured && <span className="rounded-full bg-mint-pop px-3 py-1 text-[12px] font-semibold text-carbon">Most popular</span>}
                </div>
                <p className="mt-3 text-[2.4rem] leading-none font-semibold tracking-[-0.045em] tabular-nums">
                  {formatNaira(tier.monthlyFee)}
                  <span className={`text-[15px] font-normal ${featured ? "text-paper-white/60" : "text-[var(--hm-ink-2)]"}`}> a month</span>
                </p>
                <p className={`mt-1.5 text-[14px] ${featured ? "text-paper-white/70" : "text-[var(--hm-ink-2)]"}`}>
                  Paid once a month. {tier.tagline}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${featured ? "text-mint-pop" : "text-[var(--hm-basket-ink)]"}`} />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  {isCurrent ? (
                    <p className={`${solid} ${featured ? "bg-paper-white/12" : "bg-[var(--hm-tint)]"}`}>Your plan</p>
                  ) : pending?.tierId === tier.id ? (
                    <p className={`${solid} ${featured ? "bg-paper-white/12" : "bg-[var(--hm-tint)]"}`}>Requested</p>
                  ) : !user ? (
                    <Link href={joinHref} className={`${solid} ${button}`}>
                      Join as {tier.name === "Member" ? "a member" : tier.name}
                    </Link>
                  ) : currentSlug ? (
                    <SwitchPlanButton slug={tier.slug} name={tier.name} className={`${solid} ${button}`} />
                  ) : (
                    <form action={startSubscription} className={`space-y-2 ${featured ? "text-carbon" : ""}`}>
                      <input type="hidden" name="tier" value={tier.slug} />
                      <button className={`${solid} ${featured ? "bg-paper-white text-carbon" : "bg-carbon text-paper-white"}`}>Join {tier.name}</button>
                      <p className={`text-center text-[12px] ${featured ? "text-paper-white/60" : "text-[var(--hm-ink-2)]"}`}>
                        We&apos;ll send payment details, and your plan starts once it arrives. Your baskets keep their days.
                      </p>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* The same three columns, line by line, for anyone deciding. */}
      <section className="hm-wrap mt-20" aria-labelledby="compare-plans">
        <h2 id="compare-plans" className="hm-h3 text-[1.6rem]!">
          Everything, side by side
        </h2>
        <div className="mt-5 overflow-hidden rounded-[24px] shadow-[0_0_0_1px_var(--hm-line)]">
          <table className="w-full table-fixed text-left text-[14px] sm:text-[15px]">
            <thead className="bg-[var(--hm-tint)] text-[12px] text-[var(--hm-ink-2)] sm:text-[13px]">
              <tr>
                <th scope="col" className="w-[34%] px-3 py-3 font-semibold sm:w-[40%] sm:px-5">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="px-2 py-3 text-center font-semibold sm:px-4">
                  Trial
                </th>
                {tiers.map((t) => (
                  <th key={t.id} scope="col" className="px-2 py-3 text-center font-semibold text-carbon sm:px-4">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison(avgSaving).map((row) => (
                <tr key={row.label} className="border-t border-[var(--hm-line)]">
                  <th scope="row" className="px-3 py-3.5 font-medium sm:px-5">
                    {row.label}
                  </th>
                  {row.cells.slice(0, 1 + tiers.length).map((cell, i) => (
                    <td key={i} className="px-2 py-3.5 text-center text-[13px] sm:px-4 sm:text-[14px]">
                      {cell === true ? (
                        <>
                          <Check className="mx-auto h-5 w-5 text-[var(--hm-basket-ink)]" />
                          <span className="sr-only">Included</span>
                        </>
                      ) : cell === false ? (
                        <>
                          <span aria-hidden className="text-[var(--hm-ink-3)]">–</span>
                          <span className="sr-only">Not included</span>
                        </>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Real numbers from the catalogue, so "member price" means something. */}
      {rows.length > 0 && (
        <section className="hm-wrap mt-20" aria-labelledby="compare-prices">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="compare-prices" className="hm-h3 text-[1.6rem]!">
              What member prices look like
            </h2>
            <Link href="/shop" className="text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
              See every price
            </Link>
          </div>
          <div className="mt-5 overflow-hidden rounded-[24px] shadow-[0_0_0_1px_var(--hm-line)]">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-[var(--hm-tint)] text-[13px] text-[var(--hm-ink-2)]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Market rate
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Member
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--hm-line)]">
                    <th scope="row" className="px-5 py-3.5 font-medium">
                      {shortName(p.name)} <span className="font-normal text-[var(--hm-ink-3)]">{p.unit}</span>
                    </th>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatNaira(p.standardPrice)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-[var(--hm-basket-ink)] tabular-nums">{formatNaira(p.memberPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="hm-wrap mt-20 pb-16 sm:pb-24" aria-labelledby="pricing-faq">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="pricing-faq" className="hm-h3 text-[1.6rem]!">
              Questions about paying
            </h2>
            <p className="mt-2 text-[15px] text-[var(--hm-ink-2)]">
              More in the{" "}
              <Link href="/#faq" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4">
                full questions
              </Link>
              .
            </p>
          </div>
          <div className="divide-y divide-[var(--hm-line)] border-y border-[var(--hm-line)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--hm-tint)] transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-[var(--hm-ink-2)]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
