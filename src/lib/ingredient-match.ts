import type { Product } from "@/generated/prisma/client";

/** Lowercased, trimmed, and de-pluralized just enough to match "tomatoes" to "tomato". */
export function normalizeTerm(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.endsWith("oes")) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/**
 * A free-text ingredient (typed into an own meal) against the real product
 * catalog: exact name match after normalization, so "Tomatoes" and "tomato"
 * both find the same row. No fuzzy scoring — a near-miss is meant to fall
 * into "get elsewhere" and surface as demand, not silently mismatch.
 */
export function matchProductByName(term: string, products: Product[]): Product | null {
  const needle = normalizeTerm(term);
  if (!needle) return null;
  return products.find((p) => normalizeTerm(p.name) === needle) ?? null;
}
