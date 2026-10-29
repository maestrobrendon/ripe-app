import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { SupportEmail } from "@/components/support-links";
import { PrivacyChoicesButton } from "@/components/analytics/privacy-choices-button";

export const metadata = {
  title: "Cookie policy. BasketNG",
  description: "The cookies and browser storage BasketNG uses, what each one is for, how long it lasts, and how to change your choice.",
};

const SUMMARY = [
  "Essential cookies keep you signed in and remember your basket. They're always on.",
  "Analytics cookies are optional. We only use them if you accept them.",
  "We don't use advertising or cross-site tracking cookies, and we never sell your data.",
  "You can change your choice at any time from Cookie settings at the bottom of every page.",
];

/**
 * One entry per cookie or storage key: its name and how long it lasts on one
 * line, what it's for under it. A list rather than a table, so it reads on a
 * phone without scrolling sideways.
 */
function Table({ rows }: { rows: [name: string, purpose: string, lasts: string][] }) {
  return (
    <dl className="not-prose divide-y divide-hairline rounded-2xl ring-1 ring-hairline">
      {rows.map(([name, purpose, lasts]) => (
        <div key={name} className="px-4 py-3">
          <dt className="flex items-baseline justify-between gap-3">
            <code className="min-w-0 truncate text-[13px] font-semibold">{name}</code>
            <span className="shrink-0 text-[12px] text-muted">{lasts}</span>
          </dt>
          <dd className="mt-1 text-[14px] leading-snug">{purpose}</dd>
        </div>
      ))}
    </dl>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "what",
    title: "What cookies are",
    body: (
      <p>
        Cookies are small files a website stores in your browser. Sites also keep small settings in the browser&rsquo;s
        local and session storage. This policy covers both, and uses &ldquo;cookies&rdquo; for all of them.
      </p>
    ),
  },
  {
    id: "choice",
    title: "Your choice",
    body: (
      <>
        <p>
          The first time you visit, we ask whether you accept analytics cookies. Until you answer, and if you choose
          &ldquo;Reject optional&rdquo;, we use essential cookies only. Your answer is kept in a cookie of its own for 12
          months, then we ask again.
        </p>
        <p>
          <PrivacyChoicesButton className="font-semibold underline underline-offset-2">Open cookie settings</PrivacyChoicesButton> to change it.
          Blocking all cookies in your browser will sign you out and empty your basket.
        </p>
      </>
    ),
  },
  {
    id: "essential",
    title: "Essential cookies",
    body: (
      <>
        <p>These make the site work. They can&rsquo;t be switched off here, and they&rsquo;re never used to track you.</p>
        <Table
          rows={[
            ["ripe_session", "Keeps you signed in.", "30 days"],
            ["ripe_cart", "Remembers your basket, even before you sign up.", "30 days"],
            ["ripe_zone", "Remembers your delivery area, so you see the right prices and days.", "180 days"],
            ["basket_active", "Remembers which of your baskets you're filling.", "180 days"],
            ["planner_uses_today", "Counts free meal-planner uses for visitors who aren't signed in.", "2 days"],
            ["basket_cookie_consent", "Remembers your cookie choice.", "12 months"],
          ]}
        />
        <p>
          We also keep a few small settings in your browser&rsquo;s storage: your chat with Kachi on this tab, whether
          you dismissed a tip, and whether you&rsquo;ve added BasketNG to your home screen. The chat clears when you close
          the tab.
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics cookies (optional)",
    body: (
      <>
        <p>
          We use PostHog to understand how people use BasketNG: which pages and recipes they open, what they tap, how far
          they scroll, where they get stuck, and how fast pages and Kachi respond. If you accept analytics cookies,
          PostHog remembers your device between visits, records your sessions (taps, scrolling and what&rsquo;s on
          screen) and builds heatmaps, and if you&rsquo;re signed in it links this to your account. Anything typed into a
          form, including passwords, payment details and addresses, is never recorded.
        </p>
        <Table
          rows={[
            ["ph_…_posthog", "PostHog: recognises your device between visits.", "12 months"],
            ["ph_… (local storage)", "PostHog: keeps the current session and replay in step.", "Until cleared"],
          ]}
        />
        <p>
          Without analytics cookies, PostHog still counts page views, taps and time on page for this visit only,
          storing nothing on your device, so one visit can&rsquo;t be tied to the next. We also count page views with
          Vercel Web Analytics, which sets no cookies.
        </p>
      </>
    ),
  },
  {
    id: "not-used",
    title: "What we don't use",
    body: (
      <p>
        No advertising cookies, no social-media tracking pixels and no cross-site tracking. We don&rsquo;t sell or share
        cookie data with advertisers.
      </p>
    ),
  },
  {
    id: "more",
    title: "More, and questions",
    body: (
      <p>
        How we handle your data overall is in our{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        . Questions about cookies: <SupportEmail />.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return <LegalPage title="Cookie policy" lastUpdated="29 October 2026" summary={SUMMARY} sections={SECTIONS} />;
}
