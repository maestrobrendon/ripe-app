"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RadioCard } from "@/components/ui/radio-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RollingNumber } from "@/components/ui/rolling-number";
import { CountUp } from "@/components/motion/count-up";
import { StreakRing } from "@/components/motion/streak-ring";
import { SplitReveal } from "@/components/motion/split-reveal";
import { flyToCart } from "@/components/ui/fly-to-cart";
import { formatNaira } from "@/lib/format";
import { spring } from "@/lib/motion/tokens";

const SWATCHES = [
  { name: "Carbon", hex: "#000000", class: "bg-carbon text-paper-white" },
  { name: "Paper White", hex: "#ffffff", class: "bg-paper-white text-carbon border border-border" },
  { name: "Sky Wash", hex: "#dceeff", class: "bg-sky-wash text-carbon" },
  { name: "Concrete Gray", hex: "#cccccc", class: "bg-concrete-gray text-carbon" },
  { name: "Soft Mist", hex: "#e9e9e9", class: "bg-soft-mist text-carbon" },
  { name: "Electric Blue", hex: "#4da2ff", class: "bg-electric-blue text-carbon" },
  { name: "Mint Pop", hex: "#55db9c", class: "bg-mint-pop text-carbon" },
  { name: "Lavender", hex: "#e9ccff", class: "bg-lavender text-carbon" },
  { name: "Ember", hex: "#fb4903", class: "bg-ember text-carbon" },
  { name: "Sunburst", hex: "#ffd731", class: "bg-sunburst text-carbon" },
  { name: "Voltage Violet", hex: "#5c4ade", class: "bg-voltage-violet text-paper-white" },
];

const DEMO_PRODUCTS = [
  { id: "1", name: "Pineapple", unit: "per pineapple", emoji: "🍍", flavour: "bg-sunburst", min: 1, step: 1, price: 2400, std: 2800 },
  { id: "2", name: "Green spinach (efo tete)", unit: "per 250g", emoji: "🥬", flavour: "bg-mint-pop", min: 250, step: 250, price: 900, std: 1100, grams: true },
  { id: "3", name: "Smoothie starter box", unit: "per box", emoji: "🧺", flavour: "bg-lavender", min: 1, step: 1, price: 9500, std: 11000 },
  { id: "4", name: "African star apple", unit: "per 500g", emoji: "🟠", flavour: "bg-ember", min: 500, step: 250, price: 1800, std: 2100, grams: true },
];

const EASE_ROWS = [
  { key: "snappy", label: "spring.snappy", feel: "0.22s, no bounce", use: "Press, toggles", color: "bg-sunburst" },
  { key: "smooth", label: "spring.smooth", feel: "0.38s, no bounce", use: "Layout, accordions", color: "bg-mint-pop" },
  { key: "indicator", label: "spring.indicator", feel: "0.30s, bounce .18", use: "Dock pill, tabs", color: "bg-electric-blue" },
  { key: "juicy", label: "spring.juicy", feel: "0.42s, bounce .32", use: "Added, milestones", color: "bg-ember" },
] as const;

function fmtQty(grams?: boolean) {
  return (n: number) => (grams ? (n >= 1000 ? `${n / 1000}kg` : `${n}g`) : String(n));
}

export function DesignShowcase() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [purchase, setPurchase] = useState<"one-time" | "subscribe">("one-time");
  const [day, setDay] = useState<"MON" | "WED" | "FRI">("MON");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ballOn, setBallOn] = useState<Record<string, boolean>>({});

  const phoneValid = /^(0|\+234)\d{9,10}$/.test(phone.replace(/\s/g, ""));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="pb-24">
      <p className="border-b border-border bg-carbon px-4 py-2 text-center text-xs font-medium text-paper-white">
        Dev-only preview — not linked from the app, hidden in production.
      </p>

      {/* Hero */}
      <section className="bg-sky-wash px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-carbon">Basket design system · preview</p>
          <SplitReveal className="text-display-xl mt-3 text-carbon">Fresh every week</SplitReveal>
          <p className="mt-6 max-w-lg text-base text-carbon/80 sm:text-lg">
            Carbon and paper white do the structure. Six sticker colours do the joy. Every sticker gets a 1px carbon
            outline, and every fill is flat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">Try the components</Button>
            <Button variant="secondary" size="lg" onClick={() => document.getElementById("dock")?.scrollIntoView({ behavior: "smooth" })}>
              See the floating dock
            </Button>
          </div>
        </div>
      </section>

      {/* Colour */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-heading-lg">Six stickers, used together, on black and white.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Values are verbatim from the Basket doc. Text colour follows the contrast rule per swatch.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-card border border-border bg-surface p-1.5">
                <div className={`flex h-20 items-end rounded-tile p-2.5 text-sm font-bold ${s.class}`}>Aa</div>
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-muted">{s.hex}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="font-semibold">Do</p>
              <p className="mt-1 text-sm text-muted">
                Carbon or white for all text, borders and CTAs. A 1px carbon outline on every interactive element.
                Alternate sky, white and concrete bands.
              </p>
            </div>
            <div className="rounded-card border border-border bg-soft-mist p-4">
              <p className="font-semibold">Don&rsquo;t</p>
              <p className="mt-1 text-sm text-muted">
                Electric Blue as a CTA or link. Mint as success. Sunburst behind text. Gradients, anywhere.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-2">
            <CtaRow demo={<Button>Place order</Button>} title="Primary" body="Black fill, white label: Add, Checkout, Place order, Continue." code='variant="primary"' />
            <CtaRow demo={<Button variant="secondary">View cart</Button>} title="Secondary" body="White fill, black label and outline." code='variant="secondary"' />
            <CtaRow demo={<Button variant="ghost">Skip for now</Button>} title="Quiet" body="Low emphasis, underlined text." code='variant="ghost"' />
            <CtaRow demo={<Button variant="danger">Cancel plan</Button>} title="Danger" body="Ember sticker, carbon label. Destructive only." code='variant="danger"' />
          </div>
        </div>
      </section>

      {/* Type */}
      <section className="bg-concrete-gray px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-heading-lg">Ozik is an instrument. Aeonik does everything else.</h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            <TypeRow code="display-xl · Ozik"><span className="text-display-xl">Picked today</span></TypeRow>
            <TypeRow code="heading-lg · 32/500"><span className="text-heading-lg">Your standing basket</span></TypeRow>
            <TypeRow code="heading · 24/500"><span className="text-heading">Delivery window</span></TypeRow>
            <TypeRow code="label-lg · 18/600"><span className="text-label-lg">Wednesday, 9am–5pm</span></TypeRow>
            <TypeRow code="body-lg · 18/400"><span className="text-body-lg">Sourced locally from trusted farmers, delivered across Lagos.</span></TypeRow>
            <TypeRow code="tabular · prices"><span className="text-sm tabular-nums">₦2,400 · ₦12,850 · ₦118,000</span></TypeRow>
          </div>
        </div>
      </section>

      {/* Components */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-heading-lg">Tap Add. Watch it fly to the cart.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Each category gets its sticker wash via <code className="font-mono">flavourFor()</code>, so a mixed grid
            shows the whole set together. Add morphs into a stepper; minus becomes a trash icon before removal.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span id="flight-cart" data-flight-target="cart" className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold">
              <Icon name="cart" size={18} />
              Cart
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-ember px-1.5 text-xs font-bold">
                <RollingNumber value={Object.values(qty).filter(Boolean).length} />
              </span>
            </span>
            <span className="text-xs text-muted">← the flight target for the Add buttons below</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DEMO_PRODUCTS.map((p) => {
              const q = qty[p.id] ?? 0;
              return (
                <div key={p.id} className="flex flex-col rounded-card border border-border bg-surface p-1.5">
                  <div className={`flex aspect-4/3 items-center justify-center rounded-tile text-5xl ${p.flavour}`}>{p.emoji}</div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <p className="text-sm font-medium leading-snug">{p.name}</p>
                    <p className="text-xs text-muted">{p.unit}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-semibold">{formatNaira(p.price)}</span>
                      <span className="text-xs text-muted line-through">{formatNaira(p.std)}</span>
                    </div>
                    <div className="mt-2">
                      <QuantityStepper
                        quantity={q}
                        min={p.min}
                        step={p.step}
                        label={p.name}
                        suffix="in cart"
                        formatQuantity={fmtQty(p.grams)}
                        onAddFrom={(el) => flyToCart(el, p.emoji)}
                        onChange={(next) => setQty((s) => ({ ...s, [p.id]: next }))}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <Card>
              <p className="text-sm font-semibold">Segmented control</p>
              <div className="mt-3">
                <SegmentedControl
                  groupId="purchase-mode"
                  ariaLabel="Purchase type"
                  value={purchase}
                  onChange={setPurchase}
                  options={[
                    { value: "one-time", label: "One-time" },
                    { value: "subscribe", label: "Subscribe & save" },
                  ]}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="flex h-7 items-center rounded-full border border-border bg-ember px-2.5 text-xs font-semibold">Off-season</span>
                <span className="flex h-7 items-center rounded-full border border-border bg-lavender px-2.5 text-xs font-semibold">Members save ₦400</span>
                <span className="flex h-7 items-center rounded-full border border-border bg-voltage-violet px-2.5 text-xs font-semibold text-paper-white">Most popular</span>
              </div>
            </Card>

            <Card>
              <p className="text-sm font-semibold">Radio cards · delivery window</p>
              <div className="mt-3 space-y-2">
                {(["MON", "WED", "FRI"] as const).map((d) => (
                  <RadioCard key={d} groupId="design-preview-day" selected={day === d} onSelect={() => setDay(d)}>
                    {d === "MON" ? "Monday" : d === "WED" ? "Wednesday · free for members" : "Friday"} · 9am–5pm
                  </RadioCard>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-sm font-semibold">Input · validate on blur</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-muted">Phone number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="080…"
                  className="w-full rounded-input border border-border px-3 py-2 text-sm"
                />
                {phoneTouched && !phoneValid && phone && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
                    transition={{ x: { duration: 0.36 } }}
                    className="mt-1.5 block text-xs text-carbon"
                  >
                    Enter a phone number starting with 0 or +234.
                  </motion.span>
                )}
              </label>
              <Button
                className="mt-3"
                loading={saving}
                onClick={() => {
                  setSaving(true);
                  setTimeout(() => {
                    setSaving(false);
                    flash("Changes saved");
                  }, 900);
                }}
              >
                Save changes
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Dock */}
      <section id="dock" className="bg-lavender px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-heading-lg">Floating, fully rounded, and it gets out of the way.</h2>
            <p className="mt-3 text-sm text-muted">
              This is the real component (<code className="font-mono">FloatingDock</code>), live on <code className="font-mono">/basket</code> and{" "}
              <code className="font-mono">/account</code> for signed-in users at phone widths — not a mockup. The
              black pill slides between tabs and the active tab widens to fit its label; the dock hides on scroll
              down and returns on scroll up.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>Paper white, 1px carbon outline. Solid, flat fill — never glass.</li>
              <li>The active pill mirrors the primary CTA. Counts are ember stickers.</li>
              <li>Safe-area aware, floats clear of the home indicator.</li>
            </ul>
          </div>
          <DockPreview />
        </div>
      </section>

      {/* Motion */}
      <section className="bg-sky-wash px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-heading-lg">Stickers that feel physical.</h2>
          <p className="mt-2 text-sm text-muted">Critically damped by default. Bounce only after a flick or on a celebration. Tap a row.</p>
          <div className="mt-6 overflow-hidden rounded-card border border-border">
            <table className="w-full border-collapse bg-surface text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold">
                  <th className="p-3">Token</th>
                  <th className="p-3">Feel</th>
                  <th className="p-3">Use</th>
                  <th className="p-3">Play</th>
                </tr>
              </thead>
              <tbody>
                {EASE_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono text-xs">{row.label}</td>
                    <td className="p-3">{row.feel}</td>
                    <td className="p-3">{row.use}</td>
                    <td className="p-3">
                      <button
                        onClick={() => setBallOn((s) => ({ ...s, [row.key]: !s[row.key] }))}
                        className="relative h-9 w-40 rounded-full border border-border bg-soft-mist"
                      >
                        <motion.span
                          animate={{ x: ballOn[row.key] ? 124 : 4 }}
                          transition={spring[row.key]}
                          className={`absolute top-1 left-0 h-7 w-7 rounded-full border border-border ${row.color}`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-heading-lg">Stats that count up into view.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="flex items-center gap-4">
              <StreakRing progress={0.75} label="9 week streak" />
              <div>
                <p className="text-xs text-muted">Weekly streak</p>
                <p className="text-2xl font-semibold">
                  <CountUp value={9} format="weeks" />
                </p>
              </div>
            </Card>
            <Card>
              <p className="text-xs text-muted">Saved as a member</p>
              <p className="text-2xl font-semibold">
                <CountUp value={18400} format="naira" />
              </p>
            </Card>
          </div>
        </div>
      </section>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-4 z-(--z-toast) mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-carbon px-4 py-3 text-sm text-paper-white shadow-lg sm:inset-x-auto sm:right-6"
          style={{ bottom: "calc(var(--mobile-nav-h) + 16px)" }}
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

function CtaRow({ demo, title, body, code }: { demo: React.ReactNode; title: string; body: string; code: string }) {
  return (
    <div className="grid items-center gap-4 rounded-card border border-border bg-surface p-4 sm:grid-cols-[170px_1fr_auto]">
      <div>{demo}</div>
      <p className="text-sm">
        <b>{title}.</b> <span className="text-muted">{body}</span>
      </p>
      <span className="font-mono text-xs text-muted">{code}</span>
    </div>
  );
}

function TypeRow({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="grid items-baseline gap-2 py-5 sm:grid-cols-[170px_1fr]">
      <code className="font-mono text-xs text-muted">{code}</code>
      {children}
    </div>
  );
}

/** A non-fixed, in-flow stand-in for <FloatingDock/>, contained to the phone frame below. */
function DockPreview() {
  const [active, setActive] = useState<"overview" | "basket" | "orders" | "profile">("overview");
  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "basket" as const, label: "Basket", badge: 4 },
    { id: "orders" as const, label: "Orders" },
    { id: "profile" as const, label: "Profile" },
  ];
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-panel border border-border bg-canvas shadow-sm">
      <div className="relative h-140 overflow-hidden">
        <div className="h-full overflow-y-auto p-4 pb-20">
          <p className="text-xs text-muted">Good morning</p>
          <p className="text-heading">Brendon</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="col-span-2 rounded-card border border-border bg-sky-wash p-4">
              <p className="text-xs text-muted">Next delivery</p>
              <p className="text-title">Wed 12 Mar</p>
            </div>
            <div className="rounded-card border border-border bg-lavender p-4">
              <p className="text-xs text-muted">Saved as a member</p>
              <p className="text-title tabular-nums">₦18,400</p>
            </div>
            <div className="flex items-center rounded-card border border-border p-3">
              <StreakRing progress={0.5} label="6 week streak" />
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex h-14 w-[min(100%-1.5rem,20rem)] items-stretch justify-between gap-1 rounded-full border border-border bg-surface p-1.5">
            {tabs.map((t) => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={`relative flex items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors ${
                    isActive ? "flex-[1.7] text-paper-white" : "flex-1 text-muted"
                  }`}
                >
                  {isActive && (
                    <motion.span layoutId="preview-dock-pill" transition={spring.indicator} className="absolute inset-0 -z-10 rounded-full bg-carbon" />
                  )}
                  {!isActive && t.badge ? (
                    <span className="absolute -top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-ember px-1 text-[10px]">
                      {t.badge}
                    </span>
                  ) : null}
                  {isActive ? t.label : <span className="text-xs">●</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
