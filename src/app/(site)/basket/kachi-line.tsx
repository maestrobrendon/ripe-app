import { kachiHomeLine } from "@/lib/kachi-home";

/**
 * Kachi's line above "what to add next", rendered on the server and streamed
 * in (Home wraps it in Suspense), so the page never waits for it. Nothing
 * shows if she has nothing to say.
 */
export async function KachiLine({ userId, picks }: { userId: string; picks: { name: string; reason: string }[] }) {
  const line = await kachiHomeLine(userId, picks);
  if (!line) return null;
  return <p className="mt-1 text-[15px] leading-snug text-carbon/75">{line}</p>;
}
