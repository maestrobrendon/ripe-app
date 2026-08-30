export const metadata = { title: "FAQ. Ripe" };

const FAQS = [
  {
    q: "Do I need a subscription to order?",
    a: "No. Anyone can browse, add to cart and check out with no account and no subscription. A subscription is an optional upgrade for regular customers.",
  },
  {
    q: "What does a subscription add?",
    a: "Member pricing across the catalog, free delivery on your set days, combo pricing on boxes, and a standing weekly basket you edit before you are charged.",
  },
  {
    q: "How does the order minimum work?",
    a: "There is a minimum cart value to check out, and a higher value above which delivery is free. Both are shown in the banner at the top of every page.",
  },
  {
    q: "How is produce priced?",
    a: "Prices are grounded in what the same produce costs at a Lagos supermarket. Sourcing locally from trusted farmers, and cutting out middlemen, is what makes member pricing possible.",
  },
  {
    q: "What is the trained assistant?",
    a: "A guide inside the Recipes section that reads your cart or a stated goal and suggests what to make and what to add. It gives food ideas, not medical or nutritional advice.",
  },
  {
    q: "How is payment handled?",
    a: "Payment is in test mode for now. No real charge is taken. A real payment gateway is planned.",
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
