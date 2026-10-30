import { prisma } from "@/lib/prisma";
import { DELIVERY_WINDOW, daysPhrase } from "@/lib/delivery-labels";
import { AreasExplorer, type ExplorerZone } from "./areas-explorer";

export const metadata = {
  title: "Delivery areas. BasketNG",
  description: "Where BasketNG delivers in Lagos, on which days, and how to check your address.",
};

/** "6pm" for an hour of the day. */
const hourLabel = (h: number) => (h === 0 ? "midnight" : h === 12 ? "noon" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`);

/**
 * Where we deliver, answered three ways, most direct first: "Check my
 * address" finds you; the map shows every area at a glance; the list gives
 * each area's neighbourhoods and days. The areas coming next end the list,
 * with a way to hear when they open.
 */
export default async function DeliveryAreasPage() {
  const zones = await prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, area: true, isServed: true, deliveryDays: true, centerLat: true, centerLng: true, radiusKm: true, cutoffHour: true },
  });
  const served = zones.filter((z) => z.isServed);
  const days = daysPhrase([...new Set(served.flatMap((z) => z.deliveryDays))]);
  const cutoffs = [...new Set(served.map((z) => z.cutoffHour))];

  const toExplorer = (z: (typeof zones)[number]): ExplorerZone => ({
    slug: z.slug,
    name: z.name,
    neighbourhoods: z.area.split(",").map((s) => s.trim()).filter(Boolean),
    days: z.deliveryDays,
    cutoff: hourLabel(z.cutoffHour),
    at: z.centerLat != null && z.centerLng != null ? { lat: z.centerLat, lng: z.centerLng, radiusKm: z.radiusKm ?? 4 } : null,
  });

  const facts = [
    { title: DELIVERY_WINDOW.charAt(0).toUpperCase() + DELIVERY_WINDOW.slice(1), body: "on the day you pick" },
    { title: cutoffs.length === 1 ? `Order by ${hourLabel(cutoffs[0])}` : "Order by the evening", body: "the day before" },
    { title: "Fee shown first", body: "priced from your address" },
  ];

  return (
    <div className="mx-auto w-[min(1120px,calc(100%-32px))] pt-10 pb-20 sm:pt-16 sm:pb-28">
      <header className="max-w-[40rem]">
        <p className="text-[15px] font-semibold text-[#0f7a48]">Delivery areas</p>
        <h1 className="mt-3 text-[clamp(2.4rem,6vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.045em]">Where we deliver.</h1>
        <p className="mt-4 text-[clamp(1.05rem,1.6vw,1.2rem)] leading-relaxed text-carbon/65">
          {served.length} {served.length === 1 ? "area" : "areas"} across Lagos{days ? <>, {days}</> : null}.
        </p>
      </header>

      <ul className="mt-8 grid grid-cols-3 gap-2 sm:max-w-[40rem] sm:gap-3" aria-label="How delivery works">
        {facts.map((f) => (
          <li key={f.title} className="rounded-[18px] bg-[#f3f5f0] px-3 py-3 sm:px-4 sm:py-4">
            <b className="block text-[14px] leading-tight font-semibold tracking-[-0.01em] sm:text-[15px]">{f.title}</b>
            <span className="mt-1 block text-[12px] leading-snug text-carbon/60 sm:text-[13px]">{f.body}</span>
          </li>
        ))}
      </ul>

      <AreasExplorer served={served.map(toExplorer)} soon={zones.filter((z) => !z.isServed).map(toExplorer)} />
    </div>
  );
}
