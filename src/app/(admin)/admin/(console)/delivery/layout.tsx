import { requireStaffPage } from "@/lib/admin/guard";
import { SubNav } from "../../_ui/subnav";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage("delivery.view");
  return (
    <>
      <SubNav
        items={[
          { href: "/delivery", label: "Runs" },
          { href: "/delivery/riders", label: "Riders" },
        ]}
      />
      {children}
    </>
  );
}
