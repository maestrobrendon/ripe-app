"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSiteSettings } from "@/lib/site-settings";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { appOrigin } from "@/lib/site";
import { orderRef } from "@/lib/delivery-labels";
import { ISSUE_KINDS, type IssueKind } from "@/lib/order-copy";

const WINDOW_DAYS = 7;

/**
 * "Something wrong?" on a delivered (or missed) order. It's logged against the
 * order for staff to resolve with credit or a redelivery, and the support
 * inbox hears about it straight away.
 */
export async function reportIssue(input: { orderId: string; kind: IssueKind; items: string[]; note: string; photos?: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to tell us." };
  if (!rateLimit(`issue:${user.id}`, 6, 60 * 60 * 1000).ok) return { ok: false, error: "We've got your reports. Message us if there's more." };

  const kind = ISSUE_KINDS.find((k) => k.id === input.kind);
  if (!kind) return { ok: false, error: "Pick what went wrong." };
  const order = await prisma.order.findFirst({ where: { id: input.orderId, userId: user.id }, include: { items: { include: { product: { select: { name: true } } } } } });
  if (!order) return { ok: false, error: "We couldn't find that order." };
  if (order.status !== "DELIVERED" && order.status !== "FAILED_DELIVERY") return { ok: false, error: "You can tell us about a problem once the order has arrived." };
  const since = order.deliveredAt ?? order.deliveryDate;
  if (Date.now() - since.getTime() > WINDOW_DAYS * 86_400_000) return { ok: false, error: "That's a while ago now. Message us and we'll still help." };

  const names = new Set(order.items.map((i) => i.product.name));
  const items = input.items.filter((n) => names.has(n)).slice(0, 30);
  const note = input.note.trim().slice(0, 1000);
  if (["missing", "damaged", "wrong", "quality"].includes(kind.id) && !items.length && !note) return { ok: false, error: "Tell us which items, or add a note." };

  // Only signed links to our own private uploads (lib/kachi-photos.ts).
  const photos = (input.photos ?? []).filter((u) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/authenticated\/s--/.test(u)).slice(0, 4);
  const issue = await prisma.orderIssue.create({ data: { orderId: order.id, userId: user.id, kind: kind.id, items, note: note || null, photos } });
  await prisma.orderEvent.create({ data: { orderId: order.id, kind: "NOTE", actorName: "Customer", note: `Reported: ${kind.label}${items.length ? ` (${items.join(", ")})` : ""}${note ? `. "${note}"` : ""}` } }).catch(() => {});

  const settings = await getSiteSettings();
  const text = `${user.name ?? "A customer"} reported a problem with order ${orderRef(order.id)}: ${kind.label}.${items.length ? `\nItems: ${items.join(", ")}` : ""}${note ? `\nNote: ${note}` : ""}${photos.length ? `\nPhotos: ${photos.length}, on the order in the admin` : ""}\nPhone: ${order.customerPhone}\n${adminOrderUrl(order.id)}`;
  await notify({ userId: null, kind: "issue.reported", dedupeKey: `issue:${issue.id}`, essential: true, email: { to: settings.support.email, subject: `Problem with ${orderRef(order.id)}: ${kind.label}`, text } }).catch(() => {});

  revalidatePath(`/orders/${order.id}`);
  return { ok: true };
}

/** The order in the admin: its own host in production, /admin locally. */
function adminOrderUrl(id: string) {
  const host = (process.env.ADMIN_HOST ?? "").trim();
  return host ? `https://${host}/orders/${id}` : `${appOrigin()}/admin/orders/${id}`;
}
