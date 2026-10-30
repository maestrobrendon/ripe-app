"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { rewardFeedback } from "@/lib/feedback";
import { rememberFeedbackClaim } from "@/lib/pending-claims";

export type FeedbackInput = {
  mood: number | null;
  nps: number | null;
  loves: string[];
  improve: string[];
  weeklyDriver: string | null;
  recipeWish: string;
  message: string;
  contactOk: boolean;
  contact: string;
};

export type FeedbackResult =
  | { ok: true; reward: "credited" | "already" | "claim-by-signing-in"; amount: number }
  | { ok: false; error: string };

const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n) || null;
const list = (a: unknown, n = 12) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, n) : []);

/**
 * Saves one set of answers. Signed in, the reward is credited now (once per
 * account); as a guest it's remembered and credited when they sign in.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const ip = await clientIp();
  if (!rateLimit(`feedback:ip:${ip}`, 5, 60 * 60 * 1000).ok) return { ok: false, error: "Thanks, we have your answers already. Try again in a little while." };

  const user = await getCurrentUser();
  const mood = Number.isInteger(input.mood) && input.mood! >= 1 && input.mood! <= 5 ? input.mood : null;
  const nps = Number.isInteger(input.nps) && input.nps! >= 0 && input.nps! <= 10 ? input.nps : null;
  const fb = await prisma.feedback.create({
    data: {
      userId: user?.id ?? null,
      mood,
      nps,
      loves: list(input.loves),
      improve: list(input.improve),
      weeklyDriver: clip(input.weeklyDriver, 80),
      recipeWish: clip(input.recipeWish, 300),
      message: clip(input.message, 3000),
      contactOk: Boolean(input.contactOk),
      contact: input.contactOk ? clip(input.contact, 120) ?? clip(user?.phone ?? user?.email, 120) : null,
    },
  });

  if (!user) {
    await rememberFeedbackClaim(fb.id);
    return { ok: true, reward: "claim-by-signing-in", amount: 0 };
  }
  const r = await rewardFeedback(user.id, fb.id);
  return r.ok ? { ok: true, reward: "credited", amount: r.amount } : { ok: true, reward: "already", amount: 0 };
}
