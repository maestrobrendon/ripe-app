"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** Real write access Recipes has of its own: saving a favorite isn't a basket
 * mutation, so it doesn't go through the Assistant's tool layer the way
 * basket/cart changes do — see the Recipes-by-tier addendum. */
export async function toggleSavedRecipe(recipeId: string) {
  const user = await requireUser();

  const existing = await prisma.savedRecipe.findUnique({
    where: { userId_recipeId: { userId: user.id, recipeId } },
  });

  if (existing) {
    await prisma.savedRecipe.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedRecipe.create({ data: { userId: user.id, recipeId } });
  }

  revalidatePath("/recipes");
}
