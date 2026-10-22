import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { getLogistics } from "@/lib/delivery-logistics";
import { PageHeader } from "../../../_ui/kit";
import { PricingForm } from "./pricing-form";

export const metadata: Metadata = { title: "Delivery pricing" };

/** The naira-per-km rule that prices every delivery from the customer's address. */
export default async function PricingPage() {
  const { staff } = await requireStaffPage("delivery.view");
  const [settings, zones] = await Promise.all([
    getLogistics(),
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { name: "asc" }, select: { id: true, name: true, deliveryFee: true, centerLat: true, centerLng: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Delivery pricing"
        description="Set a price per kilometre and every delivery fee works itself out from the road distance between the depot and the customer: on the site, in the basket and at checkout."
      />
      <PricingForm
        initial={settings}
        canEdit={can(staff.role as Role, "zones.manage")}
        zones={zones.map((z) => ({ id: z.id, name: z.name, flat: z.deliveryFee, located: z.centerLat != null && z.centerLng != null, km: settings.zoneKm[z.id] ?? null }))}
      />
    </>
  );
}
