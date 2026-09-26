import Link from "next/link";
import { Icon } from "@/components/ui/icon";
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
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <h2 className="text-heading-lg">Before you order</h2>

      <div className="mt-10 max-w-3xl border-t border-border">
        {FAQS.map((f) => (
          <details key={f.q} className="group border-b border-border py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
              {f.q}
              <span className="shrink-0 text-muted transition-transform group-open:rotate-45">
                <Icon name="plus" size={22} />
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-base text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
