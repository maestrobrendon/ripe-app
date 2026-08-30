const STEPS = [
  {
    n: "01",
    title: "Selected for quality",
    body: "We choose for freshness, flavour, and condition, not just appearance.",
  },
  {
    n: "02",
    title: "Packed with care",
    body: "Your produce is protected and packed to arrive in the condition we selected it.",
  },
  {
    n: "03",
    title: "Delivered on your schedule",
    body: "Choose the delivery window that works for your day and shop with confidence.",
  },
];

/** Dark brand-story band shown on every product page. */
export function BrandStoryBand() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid overflow-hidden rounded-3xl bg-ripe-green text-white md:grid-cols-[1fr_1.1fr]">
        <div className="p-8 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-wide text-white/60">The Ripe standard</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Better produce, from selection to your door.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-white/70">
            Every order is handled with the care you would expect from a trusted neighbourhood
            greengrocer, made faster, easier, and more dependable.
          </p>
        </div>
        <div className="space-y-3 bg-ripe-green-light/10 p-6 sm:p-8">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white/5 p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ripe-terracotta text-xs font-semibold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm text-white/70">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
