export const metadata = { title: "FAQ. BasketNG" };

const FAQS = [
  {
    q: "How does a basket work?",
    a: "Your basket is the fruit and vegetables you want each week, and it stays as you left it. A few days before each delivery we remind you on WhatsApp, email and the app to confirm it. You pay when it arrives. Nothing is ever charged automatically, and a week you don't confirm simply doesn't come.",
  },
  {
    q: "Do I need a membership?",
    a: "Not to try it. Anyone can browse without an account, and your first basket is a trial: one delivery at market prices. To have your basket every week, or more than one, become a member.",
  },
  {
    q: "What does membership add?",
    a: "Your baskets every week at member prices, up to three of them (one for you, one for your mum), a reminder before each delivery, every recipe, and a weekly meal plan. Member Plus adds free delivery, as many baskets as you need, early access to seasonal produce and priority support on WhatsApp.",
  },
  {
    q: "Can I skip a week or pause?",
    a: "Yes. Skip any week until the evening before, pause a basket while you're away, and change its day or what's in it whenever you like.",
  },
  {
    q: "Is there a minimum order?",
    a: "There is no minimum cart value. Each product is sold in a set pack size, for example greens by weight and oranges in pairs, so you add only what you need. Delivery is charged per order and is free once your cart passes a set value, shown at checkout.",
  },
  {
    q: "How is produce priced?",
    a: "Everyone else pays the market rate. Members pay close to what we pay at the market, because membership is how we make our money. Buying straight from farms and growers, with fewer hands in between, is what makes that possible.",
  },
  {
    q: "Who is Kachi?",
    a: "Kachi is Basket's food friend. Tell her what you're after and she'll suggest exciting ways to eat more fruit and veg, and fill your basket for you. She gives food ideas, not medical or nutritional advice.",
  },
  {
    q: "How is payment handled?",
    a: "You pay when your basket arrives, by transfer or card to the rider. You can also pay by bank transfer before it's packed, using your order number as the reference. Paying by card online is coming.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">FAQ</h1>
      <div className="mt-8 space-y-6">
        {FAQS.map((f) => (
          <div key={f.q}>
            <h2 className="font-medium">{f.q}</h2>
            <p className="mt-1 text-sm text-muted">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
