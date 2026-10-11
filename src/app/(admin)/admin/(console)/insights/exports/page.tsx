import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/admin/guard";
import { lagosDate, ymd } from "@/lib/delivery-dates";
import { PageHeader } from "../../../_ui/kit";
import { ExportCards } from "./export-cards";

export const metadata: Metadata = { title: "Exports" };

export default async function ExportsPage() {
  await requireStaffPage("reports.export");
  const today = lagosDate(new Date());
  return (
    <>
      <PageHeader
        title="Exports"
        description="Spreadsheets for the accounts. Each download needs a fresh second factor and is recorded. Orders and refunds carry no phone numbers, emails or addresses."
      />
      <ExportCards defaultFrom={ymd(new Date(today.getTime() - 29 * 86_400_000))} defaultTo={ymd(today)} />
    </>
  );
}
