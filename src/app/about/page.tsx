import Link from "next/link";

export const metadata = { title: "About. Ripe" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold">Why Ripe exists</h1>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          A lot of the produce grown around Lagos never makes it to a Lagos plate in good condition. It
          changes hands several times between the farm and the market. Each stop adds time, handling, and
          cost, and a meaningful share of it spoils before it is sold. Farmers absorb some of that loss,
          buyers absorb the rest of it in price, and the produce that does arrive is often already a few
          days past its best.
        </p>

        <p>
          Ripe sources locally from trusted farmers and moves produce into a customer's basket on a fixed
          weekly schedule, rather than through a chain of middlemen. Cutting out those steps is what makes
          member pricing possible. It is not a discount funded by volume, it is the result of a shorter,
          more direct supply chain.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">What Ripe is for</h2>
        <p>
          Ripe is built for people who already want to eat more fruits and vegetables and want a service
          that makes that consistent. A shop you can use with no commitment, and a standing basket that
          shows up on the same day every week, at a price grounded in what the same produce costs at a
          Lagos supermarket.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">What Ripe is not</h2>
        <p>
          Ripe is not trying to replace Chowdeck, the roadside seller on your street, or the supermarket
          down the road. Those all serve real, different needs: instant food, convenience, one-stop
          shopping. Ripe is a narrower thing: a produce shop, with an optional subscription for regular
          customers, built for people who have already decided eating better is worth planning around.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/shop" className="rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark">
          Browse the shop
        </Link>
        <Link href="/subscribe" className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-ripe-green-light">
          See subscription perks
        </Link>
      </div>
    </div>
  );
}
