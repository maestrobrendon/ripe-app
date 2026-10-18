import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

/*
 * Saved delivery addresses. Lagos addresses work by landmark as much as by
 * street, so each one carries the estate or building, the nearest bus stop or
 * landmark, gate notes, and a second number the rider can call. The default
 * address decides the customer's area, and so their delivery days.
 */

export type AddressInput = {
  id?: string | null;
  label: string;
  line1: string;
  estate?: string;
  landmark?: string;
  instructions?: string;
  altPhone?: string;
  zoneId: string;
  isDefault?: boolean;
};

const schema = z.object({
  label: z.string().trim().min(1, "Give it a name, like Home").max(30),
  line1: z.string().trim().min(5, "Add the house number and street").max(200),
  estate: z.string().trim().max(120).optional().default(""),
  landmark: z.string().trim().max(120).optional().default(""),
  instructions: z.string().trim().max(300).optional().default(""),
  altPhone: z.string().trim().max(32).optional().default(""),
  zoneId: z.string().min(1, "Pick your area"),
});

export const ADDRESS_SELECT = {
  id: true,
  label: true,
  line1: true,
  estate: true,
  landmark: true,
  instructions: true,
  altPhone: true,
  isDefault: true,
  zone: { select: { id: true, slug: true, name: true, area: true, isServed: true, deliveryDays: true, cutoffHour: true, deliveryFee: true } },
} as const;

export function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: ADDRESS_SELECT });
}

/** "12 Admiralty Way, Lekki Gardens". */
export const addressLine = (a: { line1: string; estate: string | null }) => [a.line1, a.estate].filter(Boolean).join(", ");

/** Create or update one of the customer's addresses. The first one, or one marked default, becomes the default. */
export async function saveAddress(userId: string, input: AddressInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the address." };
  const a = parsed.data;

  let altPhone: string | null = null;
  if (a.altPhone) {
    altPhone = normalizePhone(a.altPhone);
    if (!altPhone) return { ok: false, error: "That second number doesn't look right. Try 0803 123 4567." };
  }
  const zone = await prisma.deliveryZone.findUnique({ where: { id: a.zoneId }, select: { id: true } });
  if (!zone) return { ok: false, error: "Pick your area from the list." };

  const existing = input.id ? await prisma.address.findFirst({ where: { id: input.id, userId }, select: { id: true } }) : null;
  if (input.id && !existing) return { ok: false, error: "We couldn't find that address." };
  const count = await prisma.address.count({ where: { userId } });
  const makeDefault = Boolean(input.isDefault) || count === 0;

  const data = {
    label: a.label,
    line1: a.line1,
    estate: a.estate || null,
    landmark: a.landmark || null,
    instructions: a.instructions || null,
    altPhone,
    zoneId: zone.id,
  };

  const id = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const row = existing
      ? await tx.address.update({ where: { id: existing.id }, data: { ...data, ...(makeDefault ? { isDefault: true } : {}) } })
      : await tx.address.create({ data: { ...data, userId, isDefault: makeDefault } });
    // The account's area follows its default address.
    if (makeDefault) await tx.user.update({ where: { id: userId }, data: { deliveryZoneId: zone.id, address: addressLine({ line1: a.line1, estate: a.estate || null }) } });
    return row.id;
  });
  return { ok: true, id };
}

export async function setDefaultAddress(userId: string, id: string) {
  const a = await prisma.address.findFirst({ where: { id, userId }, select: { id: true, zoneId: true, line1: true, estate: true } });
  if (!a) return false;
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: a.id }, data: { isDefault: true } }),
    prisma.user.update({ where: { id: userId }, data: { deliveryZoneId: a.zoneId, address: addressLine(a) } }),
  ]);
  return true;
}

/** Remove an address; if it was the default, the most recent other one takes over. */
export async function deleteAddress(userId: string, id: string) {
  const a = await prisma.address.findFirst({ where: { id, userId }, select: { id: true, isDefault: true } });
  if (!a) return false;
  await prisma.address.delete({ where: { id: a.id } });
  if (a.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (next) await setDefaultAddress(userId, next.id);
  }
  return true;
}
