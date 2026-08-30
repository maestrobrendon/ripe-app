import Link from "next/link";
import { formatNaira } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD, BASE_DELIVERY_FEE } from "@/lib/pricing";

const FAQS = [
  {
    q: "Where do you deliver?",
    a: (
      <>
        We cover selected Lagos zones, including Lekki, Victoria Island, Ikoyi, Ikeja, Yaba, Surulere
        and Gbagada. Set your delivery area on any page to check if we reach you, or see the full list
        on the{" "}
        <Link href="/delivery-areas" className="underline">
          delivery areas
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "How quickly will my order arrive?",
    a: (
      <>
        Each zone has fixed delivery days, with a 9am to 5pm window. You choose the day that works for
        you at checkout.
      </>
    ),
  },
  {
    q: "Is there a minimum order?",
    a: (
      <>
        No cart minimum. Each product is sold in a set pack size, greens by weight, oranges in pairs, and
        so on, so you add only what you need. Delivery is {formatNaira(BASE_DELIVERY_FEE)}, and free once
        your cart passes {formatNaira(FREE_DELIVERY_THRESHOLD)}.
      </>
    ),
  },
  {
    q: "What if something is not fresh?",
    a: (
      <>
        Every order is quality checked before it leaves us. If something is not right, tell us within 24
        hours on WhatsApp or by email and we will replace it or refund it.
      </>
    ),
  },
];

export function FaqBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-8 rounded-3xl bg-ripe-green p-8 text-white sm:p-12 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/60">Good to know</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Before you order.</h2>
          <p className="mt-4 max-w-xs text-sm text-white/70">
            The essentials on delivery, quality, and ordering from Ripe.
          </p>
        </div>

        <div className="divide-y divide-white/15 border-y border-white/15">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="shrink-0 text-lg text-white/60 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-lg text-sm text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
