import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { generate, kachiInstructions } from "@/lib/kachi-model";
import { aboutCustomer, VOICE } from "@/lib/kachi";
import { knownAboutCustomer } from "@/lib/kachi-memory";

/*
 * Kachi's one line on Home, above "what to add next": a sentence in her voice
 * about one or two of today's picks, for this customer. Made at most once a
 * day per customer and set of picks (cached), and streamed in after Home has
 * rendered, so it never slows the page or costs more than a call a day.
 */

const LINE = `Write ONE short sentence (at most 22 words) for the top of this customer's "what to add next" list on their Home screen. Point at one or two of the picks below by name and say why it suits them, using only the reason given for each pick and what you know about them. Don't claim anything else (ripeness, freshness, prices, stock): you don't know it. Warm and specific, no greeting, no question, no exclamation mark, no em dashes, no quotation marks. Never suggest anything they're allergic to or don't eat. Reply with the sentence only.`;

const cachedLine = unstable_cache(
  async (userId: string, _day: string, picks: string[]): Promise<string> => {
    const user = (await prisma.user.findUnique({ where: { id: userId }, include: { subscriptionTier: true, deliveryZone: true, preferences: true } })) as CurrentUser | null;
    if (!user) throw new Error("No such customer");
    const firstName = user.name.trim().split(/\s+/)[0] || "there";
    const result = await generate({
      system: kachiInstructions(`${VOICE}\n\n${LINE}`, `The customer is ${firstName}.\n${aboutCustomer(user)}\n${await knownAboutCustomer(user)}\n\nToday's picks (name: why it's on the list):\n${picks.join("\n")}`),
      prompt: "Write the line.",
      maxOutputTokens: 400,
    });
    const line = result.text
      .split("\n")[0]
      .replace(/^["“']|["”']$/g, "")
      .replace(/\s*—\s*/g, ", ")
      .trim();
    // An empty or runaway answer isn't cached: throwing keeps it out of the cache.
    if (line.length < 8 || line.length > 200) throw new Error("No usable line");
    return line;
  },
  ["kachi-home-line-v2"],
  { revalidate: 86_400 },
);

/** Kachi's line for these picks today, or null if she couldn't write one (Home just goes without). */
export async function kachiHomeLine(userId: string, picks: { name: string; reason: string }[]): Promise<string | null> {
  if (!picks.length) return null;
  const day = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  try {
    return await cachedLine(userId, day, picks.map((p) => `${p.name}: ${p.reason}`));
  } catch (err) {
    console.warn(JSON.stringify({ scope: "kachi-home-line", error: String(err).slice(0, 200) }));
    return null;
  }
}
