import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { SubNav } from "../../_ui/subnav";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaffPage("insights.view");
  const role = staff.role as Role;
  const items = [
    { href: "/insights", label: "Business", show: true },
    { href: "/insights/demand", label: "Demand", show: true },
    { href: "/insights/kachi", label: "Kachi chats", show: can(role, "insights.kachi_review") },
    { href: "/insights/exports", label: "Exports", show: can(role, "reports.export") },
  ].filter((i) => i.show);
  return (
    <>
      <SubNav items={items} />
      {children}
    </>
  );
}
