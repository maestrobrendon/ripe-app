"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type OnboardingInput = {
  primaryGoal?: string;
  householdType?: string;
  weeklyBudgetBand?: string;
  cookTimeAvailable?: string;
  dietaryNotes?: string;
  favoriteProductIds: string[];
  mealFormatPreference: string[];
  shoppingStyle?: string;
};

export async function saveOnboarding(input: OnboardingInput | null) {
  const user = await requireUser();

  if (input) {
    const data = {
      primaryGoal: input.primaryGoal ?? null,
      householdType: input.householdType ?? null,
      weeklyBudgetBand: input.weeklyBudgetBand ?? null,
      cookTimeAvailable: input.cookTimeAvailable ?? null,
      dietaryNotes: input.dietaryNotes?.slice(0, 400) ?? null,
      favoriteProductIds: input.favoriteProductIds.slice(0, 40),
      mealFormatPreference: input.mealFormatPreference.slice(0, 8),
      shoppingStyle: input.shoppingStyle ?? null,
    };
    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingCompleted: true },
  });
}
