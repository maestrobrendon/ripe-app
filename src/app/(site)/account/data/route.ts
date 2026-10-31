import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * "Download my data": everything Basket holds about the signed-in customer,
 * as one JSON file. Session tokens and the password hash are never included.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to download your data." }, { status: 401 });

  const [addresses, deliveries, orders, credit, notifications, memories, chats] = await Promise.all([
    prisma.address.findMany({ where: { userId: user.id }, select: { label: true, line1: true, estate: true, landmark: true, instructions: true, altPhone: true, isDefault: true, zone: { select: { name: true } }, createdAt: true } }),
    prisma.basket.findMany({ where: { userId: user.id }, select: { name: true, deliveryDay: true, isStanding: true, createdAt: true, items: { select: { quantity: true, product: { select: { name: true } } } } } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, deliveryDate: true, address: true, zoneName: true, landmark: true, deliveryNote: true, subtotal: true, deliveryFee: true, creditApplied: true, total: true, paymentMethod: true, paidAt: true, createdAt: true, items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } } } }, issues: { select: { kind: true, items: true, note: true, photos: true, status: true, resolution: true, createdAt: true } } },
    }),
    prisma.creditRecord.findMany({ where: { userId: user.id }, select: { kind: true, amount: true, reason: true, createdAt: true } }),
    prisma.notificationLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 500, select: { channel: true, kind: true, body: true, status: true, createdAt: true } }),
    prisma.kachiMemory.findMany({ where: { userId: user.id }, select: { kind: true, text: true, createdAt: true } }),
    prisma.assistantThread.findMany({ where: { userId: user.id }, select: { title: true, createdAt: true, messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } } } }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      household: { adults: user.householdAdults, kids: user.householdKids },
      preferences: user.preferences ? { goal: user.preferences.primaryGoal, usuallyBuys: user.preferences.producePreferences, dietaryNotes: user.preferences.dietaryNotes, favourites: user.preferences.favoriteProductIds } : null,
      membership: user.subscriptionTier ? { plan: user.subscriptionTier.name, since: user.subscribedAt } : null,
      notifications: { whatsapp: user.notifyWhatsApp, email: user.notifyEmail },
      kachiReviewConsent: Boolean(user.kachiReviewConsentAt),
      referralCode: user.referralCode,
      deletionRequestedAt: user.deletionRequestedAt,
    },
    addresses,
    deliveries,
    orders,
    credit,
    messagesWeSent: notifications,
    kachiChats: chats,
    kachiRemembers: memories,
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="basket-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
