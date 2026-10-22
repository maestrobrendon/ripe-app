import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { SubNav } from "../../_ui/subnav";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaffPage("inventory.view");
  const role = staff.role as Role;
  const items = [
    { href: "/inventory", label: "Stock", show: true },
    { href: "/inventory/receive", label: "Receive", show: can(role, "inventory.receive") },
    { href: "/inventory/waste", label: "Waste", show: can(role, "inventory.adjust") },
    { href: "/inventory/expiring", label: "Use first", show: true },
    { href: "/inventory/buy-list", label: "Buy list", show: true },
    { href: "/inventory/movements", label: "History", show: true },
    { href: "/inventory/suppliers", label: "Suppliers", show: true },
    { href: "/inventory/import", label: "Import / export", show: true },
  ].filter((i) => i.show);
  return (
    <>
      <SubNav items={items} />
      {children}
    </>
  );
}
