import { BackButton } from "@/components/ui/back-button";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { listAddresses, addressLine } from "@/lib/addresses";
import { safeNextPath } from "@/lib/safe-redirect";
import { formatPhone } from "@/lib/phone";
import { AddressBook } from "./address-book";

export const metadata = { title: "Addresses" };

/** Saved delivery addresses. The default one sets your area, and so your delivery days. */
export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");
  const { next } = await searchParams;

  const [addresses, zones] = await Promise.all([
    listAddresses(user.id),
    prisma.deliveryZone.findMany({ orderBy: [{ isServed: "desc" }, { sortOrder: "asc" }], select: { id: true, name: true, area: true, isServed: true } }),
  ]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
      <BackButton fallback="/account" label="Me" />
      <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Addresses</h1>
      <p className="mt-1 text-[15px] text-muted">Your default address decides which days we come to you.</p>
      <AddressBook
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          line1: a.line1,
          estate: a.estate ?? "",
          landmark: a.landmark ?? "",
          instructions: a.instructions ?? "",
          altPhone: a.altPhone ? formatPhone(a.altPhone) : "",
          zoneId: a.zone.id,
          zoneName: a.zone.name,
          served: a.zone.isServed,
          isDefault: a.isDefault,
          line: addressLine(a),
        }))}
        zones={zones}
        next={next ? safeNextPath(next, "/account") : null}
      />
    </div>
    </div>
  );
}
