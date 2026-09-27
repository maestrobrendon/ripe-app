import Link from "next/link";

export const metadata = { title: "About. Basket" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold">Why Basket exists</h1>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          A lot of the produce grown around Lagos never makes it to a plate in good condition. It changes
          hands several times between the farm and the market. Each stop adds time, handling, and cost, and
          a meaningful share of it spoils before it is sold. Farmers absorb some of that loss, buyers absorb
          the rest of it in price, and the produce that does arrive is often already a few days past its
          best.
        </p>

        <p>
          Basket sources locally from trusted farmers and moves produce into a customer's basket on a fixed
          weekly schedule, rather than through a chain of middlemen. Cutting out those steps is what makes
          member pricing possible. It is not a discount funded by volume, it is the result of a shorter,
          more direct supply chain.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">What Basket is for</h2>
        <p>
          Basket is for people who&rsquo;ve decided eating better is worth planning around. Shop with no
          commitment, whenever you want. Or set a standing basket that shows up on the same day every week,
          priced fairly against what the same produce actually costs, member pricing included.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">Who it&rsquo;s for</h2>
        <p>
          You already know fruit and vegetables belong in your week, that&rsquo;s not new information.
          Basket exists for whatever comes after knowing: training for something, working toward a goal
          weight, going vegan, or just trying to eat properly instead of meaning to. The basket, the
          guidance, and the sourcing are built to make showing up for that the easy part.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/shop" className="rounded-full bg-carbon px-6 py-3 text-sm font-medium text-white hover:bg-carbon/85">
          Browse the shop
        </Link>
        <Link href="/subscribe" className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-sky-wash">
          See subscription perks
        </Link>
      </div>
    </div>
  );
}
