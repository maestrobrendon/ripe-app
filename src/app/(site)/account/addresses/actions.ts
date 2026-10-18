"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { deleteAddress, saveAddress, setDefaultAddress, type AddressInput } from "@/lib/addresses";

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

export async function removeAddress(id: string): Promise<AddressResult> {
  const user = await requireUser();
  if (!(await deleteAddress(user.id, id))) return { ok: false, error: "We couldn't find that address." };
  refresh();
  return { ok: true };
}
