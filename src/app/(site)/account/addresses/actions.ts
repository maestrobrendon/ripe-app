"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteAddress, saveAddress, setDefaultAddress, type AddressInput } from "@/lib/addresses";
import { addressFee, getLogistics, pinAddress } from "@/lib/delivery-logistics";

export type AddressResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/basket");
  revalidatePath("/checkout");
}

export async function saveMyAddress(input: AddressInput): Promise<AddressResult> {
  const user = await requireUser();
  const r = await saveAddress(user.id, input);
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

export async function makeDefault(id: string): Promise<AddressResult> {
  const user = await requireUser();
  if (!(await setDefaultAddress(user.id, id))) return { ok: false, error: "We couldn't find that address." };
  refresh();
  return { ok: true };
}

/** Lagos, roughly: a pin outside this is a slip of the finger. */
const LAGOS = { south: 6.2, north: 6.95, west: 2.6, east: 4.4 };

/** The customer put their address on the map: exact, so their delivery fee comes from it. */
export async function pinMyAddress(id: string, p: { lat: number; lng: number }): Promise<{ ok: true; fee: number | null; km: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const inLagos = Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > LAGOS.south && p.lat < LAGOS.north && p.lng > LAGOS.west && p.lng < LAGOS.east;
  if (!inLagos) return { ok: false, error: "That's outside Lagos. Move the pin to your gate." };
  const mine = await prisma.address.findFirst({ where: { id, userId: user.id }, select: { id: true, zone: { select: { id: true, deliveryFee: true } } } });
  if (!mine) return { ok: false, error: "We couldn't find that address." };
  try {
    const saved = await pinAddress(mine.id, p);
    const s = await getLogistics();
    refresh();
    return { ok: true, km: saved.distanceKm ?? 0, fee: s.enabled ? addressFee(saved, mine.zone, s) : null };
  } catch {
    return { ok: false, error: "We couldn't save that spot. Try again in a moment." };
  }
}

export async function removeAddress(id: string): Promise<AddressResult> {
  const user = await requireUser();
  if (!(await deleteAddress(user.id, id))) return { ok: false, error: "We couldn't find that address." };
  refresh();
  return { ok: true };
}
