import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { giftLink } from "@/lib/gifts";
import { GiftReveal } from "./gift-reveal";
import "../../home-menu/home-menu.css";

export const metadata = { title: "A basket for you. BasketNG", robots: { index: false } };

export default async function GiftCodePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ sent?: string }> }) {
  const [{ code }, { sent }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const gift = await prisma.gift.findUnique({ where: { code: code.slice(0, 20).toUpperCase() } });
  if (!gift || gift.status === "CANCELLED") notFound();

  const role = user?.id === gift.senderId ? "sender" : "recipient";
  return (
    <GiftReveal
      code={gift.code}
      link={giftLink(gift.code)}
      role={role}
      justSent={sent === "1"}
      signedIn={Boolean(user)}
      status={gift.status === "CLAIMED" ? (gift.claimedById === user?.id ? "mine" : "taken") : gift.status === "ACTIVE" ? "ready" : "unpaid"}
      openedOn={gift.claimedAt ? gift.claimedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" }) : null}
      card={{ design: gift.design, amount: gift.amount, to: gift.recipientName, from: gift.fromName, message: gift.message }}
    />
  );
}
