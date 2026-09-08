import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/safe-redirect";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const safeNext = safeNextPath(next, "/");

  const products = await prisma.product.findMany({
    where: { category: { in: ["FRUIT", "VEGETABLE"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, imageEmoji: true },
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Your preferences</h1>
      <p className="mt-2 text-sm text-muted">
        These fine-tune what the trained assistant suggests. Household size, produce preferences and your
        basket day live on your account page.
      </p>
      <OnboardingFlow products={products} next={safeNext} />
    </div>
  );
}
