import { requireStaffPage } from "@/lib/admin/guard";
import { can, ROLE_LABEL, type Role } from "@/lib/admin/permissions";
import { IDLE_MS } from "@/lib/admin/session";
import { NAV } from "./nav";
import { StepUpProvider } from "./step-up";
import { Shell } from "./shell";

/** Everything behind sign-in. The guard runs here and again in every page and action. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireStaffPage();
  const role = staff.role as Role;
  const items = NAV.filter((n) => n.permission === null || can(role, n.permission));
  return (
    <StepUpProvider>
      <Shell items={items} name={staff.name} roleLabel={ROLE_LABEL[role]} idleMs={IDLE_MS}>
        {children}
      </Shell>
    </StepUpProvider>
  );
}
