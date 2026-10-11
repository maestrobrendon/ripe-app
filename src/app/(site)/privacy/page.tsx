import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { SupportEmail } from "@/components/support-links";

export const metadata = {
  title: "Privacy policy. Basket",
  description:
    "What personal data Basket collects, why we use it, who we share it with, how long we keep it, and your rights under the Nigeria Data Protection Act.",
};

const email = <SupportEmail />;

const SUMMARY = [
  "We collect what we need to deliver your food and plan your meals, and nothing more.",
  "We never sell your data or share it with advertisers.",
  "There are no ads or tracking cookies, only the cookies that keep you signed in and remember your cart.",
  "You can see, fix, download or delete your data by emailing us.",
];

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          Basket is a better-eating service in Lagos. We turn your goals into recipes, meal plans and a
          basket of fresh produce delivered to your door. &ldquo;Basket&rdquo;, &ldquo;we&rdquo; and
          &ldquo;us&rdquo; mean the business that runs this service. We are the data controller for the
          personal data described here.
        </p>
        <p>
          This policy explains how we handle personal data under the Nigeria Data Protection Act 2023
          (NDPA). It applies to the Basket website and to everything you do with your account. Read it
          together with our <Link href="/terms">terms</Link>.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>
          <strong>What you give us.</strong>
        </p>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address or phone number, and a password.
            We store your password only in scrambled (hashed) form, so no one at Basket can read it.
          </li>
          <li>
            <strong>Delivery details:</strong> your address, delivery area and chosen delivery day.
          </li>
          <li>
            <strong>How you eat:</strong> your goal, household size, weekly budget, cooking time, meal
            formats, produce you like or avoid, favourite products, and any dietary notes you add.
          </li>
          <li>
            <strong>Your plans:</strong> saved recipes, weekly meal plans, produce plans, meals you add
            yourself, and the items you tick off as bought elsewhere.
          </li>
          <li>
            <strong>Your conversations with Kachi:</strong> the messages you send her and her replies.
          </li>
          <li>
            <strong>Messages to us:</strong> anything you send us by email or WhatsApp, and your email if
            you join the waitlist for an area we don&rsquo;t serve yet.
          </li>
        </ul>
        <p>
          <strong>What we record as you use Basket.</strong>
        </p>
        <ul>
          <li>
            <strong>Orders and baskets:</strong> what you ordered, when, the price, delivery fee and
            delivery day, and whether you edited or skipped a week.
          </li>
          <li>
            <strong>Subscription and streaks:</strong> your plan, when you joined, your weekly streak and
            any rewards.
          </li>
          <li>
            <strong>Payment card:</strong> only the card brand, last four digits and expiry date. We never
            see or store your full card number.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address, browser and device type, kept briefly in
            server logs and to block abuse, such as floods of automated requests.
          </li>
        </ul>
        <p>
          <strong>Location.</strong> If you tap &ldquo;use my location&rdquo; to find your delivery area,
          your browser asks your permission first. We use your coordinates once to match you to an area,
          then discard them. Only the area is saved.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it, and why",
    body: (
      <>
        <p>The NDPA requires a lawful reason for each use. Ours are:</p>
        <ul>
          <li>
            <strong>To provide the service you asked for</strong> (performing our contract with you):
            running your account, taking and delivering orders, managing your subscription and weekly
            basket, and sending order and password-reset emails.
          </li>
          <li>
            <strong>To personalise Basket</strong> (performing our contract, and your consent for dietary
            notes): building recipes, meal plans, starter baskets and Kachi&rsquo;s suggestions around your
            goal, household and preferences.
          </li>
          <li>
            <strong>To keep Basket safe and working</strong> (our legitimate interests): preventing fraud
            and abuse, fixing bugs, and understanding which features and ingredients people want. For
            example, we count requests for ingredients we don&rsquo;t stock yet, without linking them to
            you.
          </li>
          <li>
            <strong>To meet legal duties</strong> (legal obligation): keeping tax and accounting records,
            and responding to lawful requests from authorities.
          </li>
          <li>
            <strong>To tell you about new features, recipes or offers</strong> (consent): only if you opt
            in. You can opt out at any time.
          </li>
        </ul>
        <p>
          We don&rsquo;t make decisions about you based only on automated processing that have legal or
          similarly significant effects. Kachi&rsquo;s suggestions are ideas you can take or leave.
        </p>
      </>
    ),
  },
  {
    id: "health",
    title: "Dietary and health information",
    body: (
      <>
        <p>
          Some things you tell us, like dietary notes, allergies or a goal to manage your weight, can
          reveal information about your health. The NDPA treats this as sensitive personal data, so we
          only process it with your consent and only to tailor your food suggestions. You can remove it
          from your preferences at any time.
        </p>
        <p>
          Kachi is a food guide, not a medical service. Please don&rsquo;t send her medical records, test
          results, or details about health conditions she doesn&rsquo;t need in order to suggest a meal.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          We don&rsquo;t sell your personal data, and we don&rsquo;t share it with advertisers or data
          brokers. We share it only with companies that help us run Basket. Each one gets only what it
          needs and may use it only to provide its service to us:
        </p>
        <ul>
          <li>
            <strong>Hosting and database:</strong> Vercel, which runs the website, and Neon, which stores
            our database.
          </li>
          <li>
            <strong>Email:</strong> Resend, which sends account and order emails such as password resets.
          </li>
          <li>
            <strong>Kachi:</strong> Google, whose Gemini AI models power Kachi. When you chat with her, your
            messages and the context she needs to reply (such as your goal, preferences and basket) are
            sent to Google for processing.
          </li>
          <li>
            <strong>Delivery:</strong> our riders and delivery partners, who receive your name, address,
            phone number and order so they can deliver it.
          </li>
          <li>
            <strong>Payments:</strong> once live payments start, a licensed payment provider will process
            your card. We&rsquo;ll update this policy to name it before then.
          </li>
        </ul>
        <p>
          We may also disclose data if the law requires it, to protect someone&rsquo;s safety, or as part
          of a sale or merger of the business. In a sale or merger, this policy would continue to protect
          your data.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Data stored outside Nigeria",
    body: (
      <p>
        Our hosting, database, email and AI providers run their services on servers outside Nigeria,
        mainly in the United States. When we transfer data abroad, we rely on safeguards the NDPA
        recognises, such as contractual commitments from those providers to protect it. Your data is
        encrypted in transit and stored with providers that meet recognised security standards.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and similar storage",
    body: (
      <>
        <p>
          Basket uses only the cookies it needs to work. We don&rsquo;t use advertising, analytics or
          cross-site tracking cookies.
        </p>
        <ul>
          <li>
            <strong>Sign-in</strong> (<code>ripe_session</code>): keeps you signed in for up to 30 days.
          </li>
          <li>
            <strong>Cart</strong> (<code>ripe_cart</code>): remembers your cart for up to 30 days, even
            before you sign up.
          </li>
          <li>
            <strong>Delivery area</strong> (<code>ripe_zone</code>): remembers the area you picked for up
            to 180 days, so we show the right prices and days.
          </li>
          <li>
            <strong>Planner allowance</strong> (<code>planner_uses_today</code>): counts free planner uses
            for visitors who aren&rsquo;t signed in. It resets daily.
          </li>
        </ul>
        <p>
          We also keep a couple of small settings in your browser&rsquo;s session storage, such as whether
          you closed the delivery-area prompt. These clear when you close the tab. Blocking cookies will
          sign you out and empty your cart.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Account and preference data:</strong> for as long as your account is open.
        </li>
        <li>
          <strong>Kachi conversations, meal plans and saved recipes:</strong> until you delete them or
          close your account.
        </li>
        <li>
          <strong>Order and payment records:</strong> for six years after the order, to meet tax and
          accounting rules.
        </li>
        <li>
          <strong>Sign-in sessions:</strong> up to 30 days. Password-reset links expire 30 minutes after
          they&rsquo;re sent.
        </li>
        <li>
          <strong>Waitlist emails:</strong> until we launch in your area and let you know, or until you
          ask us to remove you.
        </li>
        <li>
          <strong>Server logs:</strong> a short period, normally no more than 30 days.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        We encrypt data in transit, store passwords only as hashes, keep sign-in tokens in secure cookies
        that scripts can&rsquo;t read, limit repeated password-reset requests and automated traffic, and restrict internal
        access to the people who need it. No online service can promise perfect security. If a breach
        puts your rights at risk, we&rsquo;ll notify the Nigeria Data Protection Commission within 72
        hours, as the NDPA requires, and tell you without delay.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the NDPA you have the right to:</p>
        <ul>
          <li>know what personal data we hold about you and get a copy of it</li>
          <li>have inaccurate data corrected. You can edit most of it yourself in your account.</li>
          <li>have your data deleted, including by closing your account</li>
          <li>receive your data in a common, machine-readable format, or have it sent to another service</li>
          <li>object to processing based on our legitimate interests, or ask us to restrict it</li>
          <li>withdraw consent at any time, for example by removing dietary notes or opting out of updates</li>
        </ul>
        <p>
          To use any of these rights, email {email} from the email address or phone number on your
          account. We may ask you to confirm it&rsquo;s you. We&rsquo;ll reply within 30 days, free of
          charge.
        </p>
        <p>
          If you&rsquo;re unhappy with how we&rsquo;ve handled your data, please tell us first so we can
          put it right. You also have the right to complain to the{" "}
          <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer">
            Nigeria Data Protection Commission
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        You need to be 18 or older to open a Basket account. We don&rsquo;t knowingly collect personal data
        from children. Household details like &ldquo;two kids&rdquo; are only numbers we use to size
        portions. If you think a child has given us personal data, email us and we&rsquo;ll delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We&rsquo;ll update this policy as Basket grows, for example when live payments start. If a change
        affects how we use your data, we&rsquo;ll tell you by email or in the app before it takes effect.
        The date at the top shows when it last changed.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about your data or this policy? Email {email} and a real person will get back to you.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" lastUpdated="11 October 2026" summary={SUMMARY} sections={SECTIONS} />;
}
