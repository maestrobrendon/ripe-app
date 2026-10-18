export const metadata = { title: "FAQ. Basket" };

const FAQS = [
  {
    q: "Do I need a subscription to order?",
    a: "No. Anyone can browse and fill a cart without an account. You sign up, free, to place the order. A subscription is an optional upgrade for regular customers.",
  },
  {
    q: "What does a subscription add?",
    a: "Every recipe, member prices on everything, up to three deliveries (for family or the office), and a weekly meal plan built from the recipes. Member Plus adds free delivery, early access to seasonal produce and priority support on WhatsApp.",
  },
  {
    q: "Is there a minimum order?",
    a: "There is no minimum cart value. Each product is sold in a set pack size, for example greens by weight and oranges in pairs, so you add only what you need. Delivery is charged per order and is free once your cart passes a set value, shown at checkout.",
  },
  {
    q: "How is produce priced?",
    a: "Prices are grounded in what the same produce costs at a Lagos supermarket. Sourcing locally from trusted farmers, and cutting out middlemen, is what makes member pricing possible.",
  },
  {
    q: "Who is Kachi?",
    a: "Kachi is Basket's food assistant. Tell it what you're cooking or what you're after, and it suggests recipes and fills your order. It gives food ideas, not medical or nutritional advice.",
  },
  {
    q: "How is payment handled?",
    a: "You pay when your order arrives, by transfer or card to the rider. You can also pay by bank transfer before it's packed, using your order number as the reference. Paying by card online is coming.",
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
