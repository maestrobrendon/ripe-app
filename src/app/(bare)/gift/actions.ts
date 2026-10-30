"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { claimGift, newGiftCode } from "@/lib/gifts";
import { GIFT_DESIGNS, GIFT_VALUES } from "@/lib/gift-config";
import { startGiftPayment, type StartResult } from "@/lib/payments";
import { rememberGiftClaim } from "@/lib/pending-claims";

export type GiftDraft = { amount: number; recipientName: string; recipientContact: string; message: string; design: string; fromName: string };

/**
 * Saves the gift as it stands and opens its payment. The value must be one of
 * GIFT_VALUES: the amount is never the page's to choose freely.
 */
export async function startGift(d: GiftDraft): Promise<StartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to send a gift." };
  const ip = await clientIp();
  if (!rateLimit(`gift:ip:${ip}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Too many tries. Give it a few minutes." };

  const value = GIFT_VALUES.find((v) => v.amount === d.amount);
  const recipientName = d.recipientName.trim().slice(0, 80);
  if (!value) return { ok: false, error: "Pick how big a basket to send." };
  if (!recipientName) return { ok: false, error: "Add who it's for." };
  const design = GIFT_DESIGNS.some((x) => x.id === d.design) ? d.design : "mint";

  const gift = await prisma.gift.create({
    data: {
      code: newGiftCode(),
      amount: value.amount,
      senderId: user.id,
      fromName: (d.fromName.trim() || user.name.trim().split(/\s+/)[0] || "A friend").slice(0, 60),
      recipientName,
      recipientContact: d.recipientContact.trim().slice(0, 120) || null,
      message: d.message.trim().slice(0, 300) || null,
      design,
    },
  });
  return startGiftPayment(user.id, gift.id);
}

export type OpenResult = { ok: true; amount: number } | { ok: false; error: string } | { ok: false; needsAccount: true };

/** Opens a gift into the signed-in customer's credit; signed out, it waits for them to sign in. */
export async function openGift(code: string): Promise<OpenResult> {
  const c = String(code).slice(0, 20);
  const user = await getCurrentUser();
  if (!user) {
    await rememberGiftClaim(c);
    return { ok: false, needsAccount: true };
  }
  return claimGift(user.id, c);
}
