import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold">Why Ripe exists</h1>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          A lot of what&rsquo;s grown in Ogun, Oyo and Ondo states never makes it to a Lagos plate in good
          condition. Produce changes hands several times between the farm and the market — each stop
          adds time, handling, and cost, and a meaningful share of it spoils before it&rsquo;s sold. Farmers
          absorb some of that loss, buyers absorb the rest of it in price, and the produce that does
          arrive is often already a few days past its best.
        </p>

        <p>
          Ripe sources directly from farmers in those three states and moves produce into a customer&rsquo;s
          basket on a fixed weekly schedule, rather than through a chain of middlemen. Cutting out those
          steps is what makes member pricing possible — it&rsquo;s not a discount funded by volume, it&rsquo;s the
          result of a shorter, more direct supply chain.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">What Ripe is for</h2>
        <p>
          Ripe is built for people who already want to eat more fruits and vegetables and want a service
          that makes that consistent — a standing basket that shows up on the same day every week, at a
          price that&rsquo;s grounded in what the same produce costs at a Lagos supermarket, not made up.
        </p>

        <h2 className="pt-4 text-2xl font-semibold">What Ripe is not</h2>
        <p>
          Ripe is not trying to replace Chowdeck, the roadside seller on your street, or the supermarket
          down the road. Those all serve real, different needs — instant food, convenience, one-stop
          shopping. Ripe is a narrower thing: a subscription and a basket, built specifically around
          fresh produce, for people who&rsquo;ve already decided that&rsquo;s worth planning around.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/subscribe" className="rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark">
          Choose your subscription
        </Link>
        <Link href="/shop" className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-ripe-green-light">
          Browse the shop
        </Link>
      </div>
    </div>
  );
}
