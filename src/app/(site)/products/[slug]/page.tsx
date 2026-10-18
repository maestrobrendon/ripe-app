import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { toAddable, toCardData } from "@/lib/product";
import { CATEGORY_LABEL } from "@/lib/format";
import { BuyBox } from "@/components/buy-box";
import { ProductAccordion } from "@/components/product-accordion";
import { BrandStoryBand } from "@/components/brand-story-band";
import { CompleteYourBasket } from "@/components/complete-your-basket";
import { ProductImage } from "@/components/product-image";
import { flavourFor } from "@/lib/flavour";
import { FRESH_CUTS_TAG, OFFERED } from "@/lib/product";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, user] = await Promise.all([
    prisma.product.findUnique({ where: { slug } }),
    getCurrentUser(),
  ]);
  if (!product || product.tags.includes(FRESH_CUTS_TAG)) notFound();

  const relatedIds = product.relatedProductIds;
  let related = relatedIds.length
    ? await prisma.product.findMany({ where: { id: { in: relatedIds }, ...OFFERED } })
    : [];
  if (related.length === 0) {
    related = await prisma.product.findMany({
      where: { category: product.category, id: { not: product.id }, ...OFFERED },
      take: 4,
      orderBy: { name: "asc" },
    });
  }
  // Preserve the curated order.
  if (relatedIds.length) {
    related.sort((a, b) => relatedIds.indexOf(a.id) - relatedIds.indexOf(b.id));
  }

  const hasRecipes =
    (await prisma.recipe.count({ where: { ingredientProductIds: { has: product.id } } })) > 0;

  const crossSell = related.map(toCardData);

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <BackButton fallback="/shop" />
        </div>
        <p className="mt-1 hidden text-sm text-muted sm:block">
          <Link href="/shop" className="hover:underline">Shop</Link> / {CATEGORY_LABEL[product.category]} / {product.name}
        </p>

        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductImage
              publicId={product.cloudinaryPublicId}
              alt={product.name}
              emoji={product.imageEmoji}
              flavour={flavourFor(product.category, product.tags)}
              rounded="rounded-3xl"
              sizes="(min-width: 1024px) 480px, 90vw"
              className="aspect-square w-full border border-border"
              emojiClassName="text-[9rem]"
            />
          </div>

          {/* Buy + copy */}
          <div>
            <BuyBox
              product={toAddable(product)}
              name={product.name}
              inSeason={product.inSeason}
              isSubscriber={Boolean(user?.subscriptionTierId)}
            />

            <div className="mt-6 space-y-3 text-sm">
              {product.description && <p className="font-medium">{product.description}</p>}
              {product.blurb && <p className="text-muted">{product.blurb}</p>}
              {product.sourcingLine && (
                <p className="text-muted">{product.sourcingLine}</p>
              )}
            </div>

            <div className="mt-6">
              <ProductAccordion
                sections={[
                  { title: "Why you'll love them", body: product.educationCopy },
                  { title: "Health Benefits", body: product.benefitsCopy },
                  {
                    title: "How to Enjoy",
                    body: product.howToEnjoyCopy,
                    link: hasRecipes
                      ? { href: `/recipes?ingredient=${product.slug}`, label: `Recipes with ${product.name}` }
                      : undefined,
                  },
                  { title: "Storage Tips", body: product.storageTips },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <BrandStoryBand />

      <CompleteYourBasket products={crossSell} />
    </div>
  );
}
