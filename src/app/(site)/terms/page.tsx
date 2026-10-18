import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { SupportEmail } from "@/components/support-links";

export const metadata = {
  title: "Terms of service. Basket",
  description:
    "The terms for using Basket: accounts, orders, delivery, subscriptions, payment, Kachi and recipes.",
};

const SUMMARY = [
  "Shopping is free. A subscription is optional, and you can cancel it any time from your account.",
  "You pay only for what we deliver. Anything missing or spoiled, tell us within 24 hours.",
  "Kachi and our recipes give food ideas, not medical advice.",
  "We never sell your data, and you can ask us to delete it at any time.",
];

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These terms cover your use of Basket: the website, your account, the shop, recipes, the meal
          planner, Kachi, and every order and subscription you place with us. &ldquo;Basket&rdquo;,
          &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the business that runs this service. &ldquo;You&rdquo;
          means the person using it.
        </p>
        <p>
          By creating an account or placing an order, you agree to these terms. If you don&rsquo;t agree,
          please don&rsquo;t use Basket. Nothing here takes away your rights under Nigerian consumer
          protection law, including the Federal Competition and Consumer Protection Act 2018.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <p>
          Accounts are free. You need to be 18 or older to create one. Give us your real name and an
          email address or phone number you actually use, because that&rsquo;s how we reach you about
          orders and password resets.
        </p>
        <p>
          Keep your password to yourself. You&rsquo;re responsible for what happens on your account, so
          tell us at once if you think someone else has used it. We may suspend or close an account that
          breaks these terms, is used for fraud, or abuses our team or delivery riders.
        </p>
      </>
    ),
  },
  {
    id: "orders",
    title: "Orders and prices",
    body: (
      <>
        <p>
          All prices are in Naira and include everything shown at checkout. Prices can change from week
          to week with the season and the market. The price you pay is the one confirmed when you check
          out.
        </p>
        <p>
          Each product is sold in a set pack size, for example greens by weight and oranges in pairs.
          There is no minimum order. Fresh produce is natural, so sizes and weights can vary slightly
          from the photos and descriptions.
        </p>
        <p>
          If an item is out of stock or not good enough to send on packing day, we&rsquo;ll leave it out
          and you won&rsquo;t pay for it. We never swap in a different product without asking you first.
        </p>
        <p>
          We may refuse or cancel an order if a price was clearly shown in error, we can&rsquo;t deliver
          to your address, or we suspect fraud. If that happens after you&rsquo;ve paid, you get a full
          refund.
        </p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "Delivery",
    body: (
      <>
        <p>
          We deliver to <Link href="/delivery-areas">selected areas of Lagos</Link> on fixed days. Your
          area decides which days you can choose. Each delivery day has an ordering cutoff, shown when
          you pick your day. Orders placed after it go out on the next available day.
        </p>
        <p>
          Delivery is charged per order. The fee depends on your delivery area and is shown before you
          pay. Member Plus subscribers get free delivery.
        </p>
        <p>
          Please give us a complete address and a phone number the rider can reach. If no one is
          available to receive an order and the rider can&rsquo;t reach you, we&rsquo;ll try to arrange
          another time. Because produce is perishable, we can&rsquo;t refund an order that was missed
          because of a wrong address or because no one could be reached.
        </p>
      </>
    ),
  },
  {
    id: "freshness",
    title: "Freshness promise",
    body: (
      <>
        <p>
          If anything arrives damaged, spoiled or missing, tell us within 7 days of delivery from the
          order page (&ldquo;Something wrong?&rdquo;), or email <SupportEmail /> with your order number and a photo.
          We&rsquo;ll replace the item on your next delivery or refund it, whichever you prefer.
        </p>
        <p>
          Once produce is delivered, storing it is up to you. Each product page has storage tips to help
          it last.
        </p>
      </>
    ),
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    body: (
      <>
        <p>
          You never need a subscription to shop. It&rsquo;s an optional upgrade that adds every recipe,
          member pricing, up to three deliveries and a weekly meal plan, and on Member Plus, free
          delivery. The perks and monthly fee of
          each plan are on the <Link href="/subscribe">pricing page</Link>.
        </p>
        <ul>
          <li>
            <strong>Billing.</strong> The membership fee is due monthly from the day you join, until
            you cancel. It&rsquo;s paid by transfer; nothing is charged automatically.
          </li>
          <li>
            <strong>Your weekly order.</strong> Nothing is ordered on its own. You confirm each
            week&rsquo;s order, and can change it, cancel it or skip the week until its cutoff, the day
            before delivery. After the cutoff it&rsquo;s packed.
          </li>
          <li>
            <strong>Cancelling.</strong> Cancel any time from your account. You won&rsquo;t pay any more
            membership fees, and member pricing and free delivery end straight away. Fees already paid
            aren&rsquo;t refunded for the rest of the month. An order past its cutoff is still
            delivered.
          </li>
          <li>
            <strong>Changing plans.</strong> You can move to another plan from your account. The new
            fee applies from your next billing date.
          </li>
        </ul>
        <p>
          Without a membership you can have one delivery at standard prices. Members can have more.
        </p>
      </>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    body: (
      <>
        <p>
          You pay when your order arrives, by transfer or card to the rider, or by bank transfer before
          it&rsquo;s packed, using your order number as the reference. Account credit (from invites or
          to put a problem right) comes off your next order. We&rsquo;ll update these terms before card
          payments online start.
        </p>
      </>
    ),
  },
  {
    id: "kachi",
    title: "Kachi, recipes and meal plans",
    body: (
      <>
        <p>
          Kachi, our guide, and our recipes and meal plans are here to help you cook and eat well.
          They&rsquo;re food ideas, not medical, dietary or nutritional advice. If you have a health
          condition, are pregnant, or are following a diet set by a professional, check with your doctor
          or dietitian first.
        </p>
        <p>
          Kachi is an automated assistant. Her suggestions are written by software and can sometimes be
          wrong or incomplete. Always read ingredient lists yourself, especially if you have an allergy.
          We can&rsquo;t guarantee any item is free from a particular allergen.
        </p>
        <p>
          Most of each recipe&rsquo;s ingredients come from Basket. Anything we don&rsquo;t stock is
          marked &ldquo;grab it elsewhere&rdquo;, and we don&rsquo;t supply it.
        </p>
      </>
    ),
  },
  {
    id: "streaks",
    title: "Streaks and rewards",
    body: (
      <p>
        Weekly streaks and the rewards for reaching milestones, such as delivery credit or vouchers, are
        a thank-you. They have no cash value, can&rsquo;t be transferred, and may change or end. A reward
        we&rsquo;ve already given you will stay valid until its stated expiry.
      </p>
    ),
  },
  {
    id: "use",
    title: "Using Basket fairly",
    body: (
      <>
        <p>Please don&rsquo;t:</p>
        <ul>
          <li>use Basket for anything illegal or fraudulent, or open accounts to claim invite credit more than once</li>
          <li>try to break, overload, or get around the security of the site</li>
          <li>scrape or copy our catalogue, recipes or content in bulk</li>
          <li>use Kachi to produce content that is harmful, abusive or unrelated to food</li>
        </ul>
        <p>
          The Basket name, logo, recipes, photos, illustrations and copy belong to us or the people who
          license them to us. You&rsquo;re welcome to cook the recipes and share them with friends, but
          not to republish them or use them commercially.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    body: (
      <>
        <p>
          We work hard to keep Basket running and accurate, but we can&rsquo;t promise it will always be
          available or error-free. Delivery days may move for things outside our control, like severe
          weather, road closures, public holidays or supply problems. When that happens, we&rsquo;ll tell
          you and offer a new day or a refund.
        </p>
        <p>
          As far as the law allows, our liability for any order is limited to the amount you paid for
          it, and we aren&rsquo;t liable for indirect losses. None of this limits our liability for
          death or personal injury caused by our negligence, for fraud, or for anything else the law
          doesn&rsquo;t let us exclude.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Your data and privacy",
    body: (
      <p>
        We collect only what we need to run Basket, never sell your data, and keep it in line with the
        Nigeria Data Protection Act 2023. Our <Link href="/privacy">privacy policy</Link> explains what we
        collect, who we share it with, how long we keep it, and how to see, correct or delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We&rsquo;ll update these terms as Basket grows. When we make a change that matters, such as to
        pricing rules, subscriptions or how we use your data, we&rsquo;ll tell you by email or in the app
        before it takes effect. The date at the top shows when they last changed. If you keep using Basket
        after a change, you accept the new terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. If something goes wrong,
        talk to us first; most problems can be fixed with one email. If we can&rsquo;t resolve it, the
        courts of Lagos State will decide.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about these terms, an order or your data? Email{" "}
        <SupportEmail /> and a real person will get back to you.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of service" lastUpdated="11 October 2026" summary={SUMMARY} sections={SECTIONS} />;
}
