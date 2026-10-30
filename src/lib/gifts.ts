import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { grantCredit } from "@/lib/credit";
import { notify } from "@/lib/notify";
import { sendGiftEmail } from "@/lib/customer-emails";
import { appOrigin } from "@/lib/site";
import { formatNaira } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

/*
 * Gift a basket. The sender picks a value and a note and pays through
 * Paystack; the gift is ACTIVE once Paystack confirms it (payments.ts), and
 * the recipient is sent /gift/<code>. Claiming it, signed in, turns it into
 * account credit for a basket they choose themselves. Each gift is claimed
 * once, and never by the person who sent it.
 */

export { GIFT_VALUES, GIFT_DESIGNS, type GiftDesign } from "@/lib/gift-config";

/** "BSK-7KQ2-M9XD": easy to read aloud, no 0/O or 1/I. */
export function newGiftCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `BSK-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function giftLink(code: string) {
  return `${appOrigin()}/gift/${code}`;
}

/** Sends the recipient their gift, by email or WhatsApp, whichever the sender gave. */
export async function deliverGift(giftId: string) {
  const gift = await prisma.gift.findUnique({ where: { id: giftId } });
  if (!gift || gift.status !== "ACTIVE" || !gift.recipientContact) return;
  const link = giftLink(gift.code);
  const contact = gift.recipientContact.trim();
  if (contact.includes("@")) {
    await sendGiftEmail(contact, { fromName: gift.fromName, recipientName: gift.recipientName, amount: gift.amount, message: gift.message, link });
    return;
  }
  const phone = normalizePhone(contact);
  if (!phone) return;
  await notify({
    userId: null,
    kind: "gift.sent",
    dedupeKey: `gift.sent:${gift.id}`,
    essential: true,
    whatsapp: {
      to: phone,
      text: `${gift.recipientName.split(/\s+/)[0]}, ${gift.fromName} sent you ${formatNaira(gift.amount)} of fresh fruit and veg from BasketNG.${gift.message ? ` "${gift.message}"` : ""} Open it here: ${link}`,
    },
  });
}

export type ClaimResult = { ok: true; amount: number } | { ok: false; error: string };

/** Turns a gift into account credit for the signed-in customer. */
export async function claimGift(userId: string, code: string): Promise<ClaimResult> {
  const gift = await prisma.gift.findUnique({ where: { code } });
  if (!gift || gift.status === "PENDING" || gift.status === "CANCELLED") return { ok: false, error: "This gift isn't ready to open." };
  if (gift.status === "CLAIMED") return gift.claimedById === userId ? { ok: true, amount: gift.amount } : { ok: false, error: "This gift has already been opened." };
  if (gift.senderId === userId) return { ok: false, error: "This is a gift you sent. Share the link with the person it's for." };

  // Only the first claim wins, even if two arrive at once.
  const { count } = await prisma.gift.updateMany({ where: { id: gift.id, status: "ACTIVE" }, data: { status: "CLAIMED", claimedById: userId, claimedAt: new Date() } });
  if (count === 0) return { ok: false, error: "This gift has already been opened." };
  await grantCredit({ userId, amount: gift.amount, reason: `Gift basket from ${gift.fromName}`, staffName: "Gift" });
  return { ok: true, amount: gift.amount };
}
