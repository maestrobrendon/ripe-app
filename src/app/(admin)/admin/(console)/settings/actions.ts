"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { SETTING_KEYS, SETTING_SCHEMAS, type SettingKey } from "@/lib/site-settings-schema";
import { getSiteSettings } from "@/lib/site-settings";

/* Site settings and membership plans: both change what every customer sees, so both need a fresh second factor. */

export async function saveSetting(input: { key: string; value: unknown }): Promise<ActionResult> {
  return staffAction("settings.manage", async (ctx) => {
    const key = z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]).safeParse(input.key);
    if (!key.success) return { ok: false, code: "INVALID", error: "Unknown setting." };
    const parsed = SETTING_SCHEMAS[key.data].safeParse(input.value);
    if (!parsed.success) return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Check the values." };
    const before = (await getSiteSettings())[key.data];
    await prisma.siteSetting.upsert({
      where: { key: key.data },
      create: { key: key.data, value: parsed.data, updatedById: ctx.staff.id },
      update: { value: parsed.data, updatedById: ctx.staff.id },
    });
    await auditStaff(ctx, { action: "settings.changed", targetType: "SiteSetting", targetId: key.data, summary: `Changed ${key.data}`, diff: { before, after: parsed.data } });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  });
}

const tierSchema = z.object({
  name: z.string().trim().min(2).max(40),
  monthlyFee: z.number().int().min(0).max(1_000_000),
  tagline: z.string().trim().min(5).max(200),
  perks: z.array(z.string().trim().min(2).max(120)).min(1).max(12),
});

export async function saveTier(input: { slug: string; confirmLargeChange?: boolean } & z.input<typeof tierSchema>): Promise<ActionResult> {
  return staffAction("subscriptions.manage", async (ctx) => {
    const parsed = tierSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Check the plan." };
    const before = await prisma.subscriptionTier.findUnique({ where: { slug: String(input.slug).slice(0, 40) } });
    if (!before) return { ok: false, code: "INVALID", error: "That plan doesn't exist." };
    const p = parsed.data;
    // A fee swing of more than half is almost always a typo (an extra zero): make it a deliberate second step.
    const large = before.monthlyFee > 0 && (p.monthlyFee > before.monthlyFee * 1.5 || p.monthlyFee < before.monthlyFee * 0.5);
    if (large && !input.confirmLargeChange) {
      return { ok: false, code: "CONFLICT", error: `The fee would go from ₦${before.monthlyFee.toLocaleString("en-NG")} to ₦${p.monthlyFee.toLocaleString("en-NG")}.` };
    }
    await prisma.subscriptionTier.update({ where: { id: before.id }, data: p });
    await auditStaff(ctx, {
      action: "subscriptions.plan_edited",
      targetType: "SubscriptionTier",
      targetId: before.id,
      summary: `${before.name}${before.monthlyFee !== p.monthlyFee ? `: fee ₦${before.monthlyFee.toLocaleString("en-NG")} → ₦${p.monthlyFee.toLocaleString("en-NG")}` : " edited"}`,
      diff: { before: { name: before.name, monthlyFee: before.monthlyFee, tagline: before.tagline, perks: before.perks }, after: p },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  });
}
