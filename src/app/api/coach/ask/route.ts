import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  matchCoachAnswer,
  productSearchTerms,
  isStrongProductMatch,
  wordForms,
} from "@/lib/coach-answers";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { CoachProduct, CoachReply } from "../route";

const MINUTE = 60 * 1000;

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`coach:ask:${ip}`, 30, MINUTE).ok) {
    return NextResponse.json(
      { id: "throttled", question: "", answer: "That is a lot of questions at once. Give it a moment and try again." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const question = typeof body?.q === "string" ? body.q.trim().slice(0, 200) : "";
  if (question.length < 2) {
    return NextResponse.json({ id: "empty", question, answer: "Ask me a question and I will do my best." });
  }

  const user = await getCurrentUser();
  const isSubscriber = Boolean(user?.subscriptionTierId);

  // A named product is a high-confidence hit, so the catalogue is checked
  // before the topic list: "how much is mango" is about mangoes, not pricing.
  // Plural spellings are expanded because the catalogue is singular.
  const terms = productSearchTerms(question);
  const searchForms = [...new Set(terms.flatMap(wordForms))];
  const candidates = searchForms.length
    ? await prisma.product.findMany({
        where: { OR: searchForms.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) },
        select: {
          slug: true,
          name: true,
          unit: true,
          imageEmoji: true,
          cloudinaryPublicId: true,
          memberPrice: true,
          standardPrice: true,
          inSeason: true,
        },
        orderBy: { name: "asc" },
        take: 8,
      })
    : [];

  const matches = candidates.filter((p) => isStrongProductMatch(p.name, terms)).slice(0, 4);

  const products: CoachProduct[] = matches.map((p) => ({
    slug: p.slug,
    name: p.name,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    price: isSubscriber ? p.memberPrice : p.standardPrice,
  }));

  const topic = matchCoachAnswer(question);

  let reply: CoachReply;
  if (products.length > 0) {
    const outOfSeason = matches.filter((p) => !p.inSeason).map((p) => p.name);
    reply = {
      id: "product",
      question,
      answer:
        `We stock ${matches.map((p) => p.name).join(", ")}.` +
        (outOfSeason.length > 0 ? ` ${outOfSeason.join(" and ")} is out of season right now.` : ""),
      products,
      link: { label: "Browse the shop", href: "/shop" },
    };
  } else if (topic) {
    reply = { id: topic.id, question, answer: topic.answer, link: topic.link };
  } else {
    // Saying so plainly beats guessing: this is a rule set, not a chat model.
    reply = {
      id: "human",
      question,
      answer:
        "I do not have an answer for that one. I can help with delivery, pricing, subscriptions, rewards and what we stock. For anything else a person on the team can pick it up on WhatsApp.",
    };
  }

  return NextResponse.json(reply);
}
