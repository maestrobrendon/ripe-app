import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GOAL_LABEL } from "@/lib/format";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) notFound();

  const ingredients = await prisma.product.findMany({
    where: { id: { in: recipe.ingredientProductIds } },
  });

  const steps = recipe.instructions.split("\n").filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm text-muted">
        <Link href="/recipes" className="hover:underline">Recipes</Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{recipe.title}</h1>
      <p className="mt-2 text-sm text-muted">{recipe.summary}</p>

      {recipe.goalTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.goalTags.map((g) => (
            <Link
              key={g}
              href={`/recipes?goal=${g}`}
              className="rounded-full bg-ripe-green-light px-2 py-0.5 text-xs"
            >
              {GOAL_LABEL[g] ?? g}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-lg font-medium">What you need</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {ingredients.map((p) => (
          <li key={p.id} className="flex justify-between">
            <Link href={`/products/${p.slug}`} className="hover:underline">
              {p.imageEmoji} {p.name}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-medium">How people make it</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-muted">
        This is a food idea, not nutritional or medical advice.
      </p>
    </div>
  );
}
