import type { Metadata } from "next";
import { getLogistics } from "@/lib/delivery-logistics";
import { PageHeader } from "../../../_ui/kit";
import { Calculator } from "./calculator";

export const metadata: Metadata = { title: "Delivery calculator" };

/** What a delivery anywhere would cost, how far and how long: for quotes on the phone, or checking a new area. */
export default async function CalculatorPage() {
  const s = await getLogistics();
  return (
    <>
      <PageHeader title="Delivery calculator" description="Search an address or click anywhere on the map: the road distance from the depot, the time in traffic, and the fee by your pricing rule." />
      <Calculator depot={s.depot} enabled={s.enabled} />
    </>
  );
}
