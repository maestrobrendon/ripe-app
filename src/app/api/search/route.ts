import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ],
    },
    orderBy: { name: "asc" },
    take: 8,
  });

  return NextResponse.json({
    results: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      unit: p.unit,
      imageEmoji: p.imageEmoji,
      price: p.standardPrice,
    })),
  });
}
