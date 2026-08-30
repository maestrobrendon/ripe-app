import { prisma } from "@/lib/prisma";
import { DELIVERY_DAY_LABEL } from "@/lib/format";

export const metadata = { title: "Delivery areas. Ripe" };

export default async function DeliveryAreasPage() {
  const zones = await prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" } });
  const served = zones.filter((z) => z.isServed);
  const soon = zones.filter((z) => !z.isServed);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Delivery areas</h1>
      <p className="mt-2 text-sm text-muted">
        We deliver across parts of Lagos on fixed days. Your area sets your delivery days and pricing.
      </p>

      <h2 className="mt-8 text-lg font-medium">Areas we cover now</h2>
      <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
        {served.map((z) => (
          <li key={z.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{z.name}</p>
              <p className="text-sm text-muted">{z.area}</p>
            </div>
            <p className="text-sm text-muted">
              Delivers {z.deliveryDays.map((d) => DELIVERY_DAY_LABEL[d]).join(", ") || "on request"}
            </p>
          </li>
        ))}
      </ul>

      {soon.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-medium">Coming soon</h2>
          <p className="mt-2 text-sm text-muted">
            {soon.map((z) => z.name).join(", ")}. Set your area on any page to join the notify list.
          </p>
        </>
      )}
    </div>
  );
}
