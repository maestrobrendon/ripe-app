import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { getSiteSettings } from "@/lib/site-settings";
import { SETTING_DEFAULTS } from "@/lib/site-settings-schema";
import { PageHeader } from "../../_ui/kit";
import { when } from "../../_ui/format";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const { staff } = await requireStaffPage("settings.view");
  const [settings, rows] = await Promise.all([getSiteSettings(), prisma.siteSetting.findMany({ select: { key: true, updatedAt: true } })]);
  const changed = Object.fromEntries(rows.map((r) => [r.key, when(r.updatedAt)]));
  return (
    <>
      <PageHeader title="Site settings" description="Things on the customer site you can change without a release. Saving needs a fresh second factor and is recorded." />
      <SettingsView settings={settings} defaults={SETTING_DEFAULTS} changed={changed} canManage={can(staff.role as Role, "settings.manage")} />
    </>
  );
}
