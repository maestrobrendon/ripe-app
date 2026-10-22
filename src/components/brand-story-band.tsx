const STEPS = [
  { n: "01", title: "Picked by hand", body: "We choose for freshness, flavour and condition, not just looks." },
  { n: "02", title: "Packed to arrive as picked", body: "Packed with care so nothing is crushed on the way." },
  { n: "03", title: "On your area's day", body: "9am to 5pm, with a rider you can call. Bruised or wrong? We put it right." },
];

/** The promise behind every product, on one dark panel so every line stays readable. */
export function BrandStoryBand() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 rounded-3xl bg-carbon p-8 text-white sm:p-10 md:grid-cols-[1fr_1.1fr] md:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">The Basket standard</p>
          <h2 className="mt-3 text-3xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-4xl">Better produce, from selection to your door.</h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
            The care of a trusted neighbourhood greengrocer, made faster, easier and more dependable.
          </p>
        </div>
        <ol className="grid gap-2.5">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-start gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lavender text-xs font-semibold text-carbon">{s.n}</span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/70">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
