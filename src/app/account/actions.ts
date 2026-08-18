"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { currentWeekStart } from "@/lib/weeks";

export async function changeSubscriptionTier(tierSlug: string) {
  const user = await requireUser();
  const tier = await prisma.subscriptionTier.findUniqueOrThrow({ where: { slug: tierSlug } });
  await prisma.user.update({ where: { id: user.id }, data: { subscriptionTierId: tier.id } });
  revalidatePath("/account");
}

export async function toggleSkipThisWeek() {
  const user = await requireUser();
  const weekStart = currentWeekStart();

  const existing = await prisma.skippedWeek.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart } },
  });

  if (existing) {
    await prisma.skippedWeek.delete({ where: { id: existing.id } });
  } else {
    await prisma.skippedWeek.create({ data: { userId: user.id, weekStart } });
  }

  revalidatePath("/account");
}
