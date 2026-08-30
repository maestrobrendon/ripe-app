"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type OnboardingInput = {
  primaryGoal?: string;
  householdSize?: number;
  dietaryNotes?: string;
  favoriteProductIds: string[];
  shoppingStyle?: string;
};

export async function saveOnboarding(input: OnboardingInput | null) {
  const user = await requireUser();

  if (input) {
    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        primaryGoal: input.primaryGoal ?? null,
        householdSize: input.householdSize ?? null,
        dietaryNotes: input.dietaryNotes ?? null,
        favoriteProductIds: input.favoriteProductIds,
        shoppingStyle: input.shoppingStyle ?? null,
      },
      update: {
        primaryGoal: input.primaryGoal ?? null,
        householdSize: input.householdSize ?? null,
        dietaryNotes: input.dietaryNotes ?? null,
        favoriteProductIds: input.favoriteProductIds,
        shoppingStyle: input.shoppingStyle ?? null,
      },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingCompleted: true },
  });
}
