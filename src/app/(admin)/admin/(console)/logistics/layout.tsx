import { requireStaffPage } from "@/lib/admin/guard";
import { SubNav } from "../../_ui/subnav";

export default async function LogisticsLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage("delivery.view");
  return (
    <>
      <SubNav
        items={[
          { href: "/logistics", label: "Planner" },
          { href: "/logistics/pricing", label: "Pricing" },
          { href: "/logistics/calculator", label: "Calculator" },
          { href: "/logistics/fleet", label: "Fleet" },
        ]}
      />
      {children}
    </>
  );
}
