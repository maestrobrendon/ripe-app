import "server-only";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

/*
 * The model behind Kachi, shared by the signed-in agent (api/assistant) and
 * the guest bubble (api/kachi). Moved here unchanged from api/assistant.
 */

// Verified at ai.google.dev on 2026-09-27 as the current fast/cheap model
// that's free-tier eligible and supports function calling. Model names on
// the free tier shift; override with ASSISTANT_MODEL_ID rather than editing
// this file when Google moves on again.
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "gemini-3.8-flash";
// Free-tier quotas are counted per model, so when one runs dry for the day
// the next one usually still has room. Comma-separated, tried in order.
const FALLBACK_MODEL_IDS = (process.env.ASSISTANT_FALLBACK_MODEL_IDS ?? "gemini-3.7-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL_ID);

/** The provider is overloaded ("high demand", 503): another model usually isn't. */
function isOverloaded(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /high demand|overloaded|unavailable|503/i.test(detail);
}

/**
 * A provider "too many requests", quota or overload error, from any layer of
 * wrapping: the turns where "I'm a little busy, try again" is the honest reply.
 */
export function isRateLimited(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|quota|resource.?exhausted/i.test(detail) || isOverloaded(err);
}

/**
 * generateText that rides out Gemini's free-tier limits. Its 429 says how
 * long to wait: a short wait (the per-minute limit) is waited out once on
 * the same model; a long one (the daily quota) moves to the next model.
 * A retry re-runs the whole turn, so `canRetry` says no once a tool has
 * changed something, rather than risk making the change twice.
 */
/** Per server instance: when each model's daily quota should be back. */
const exhaustedUntil = new Map<string, number>();

export async function generate(
  opts: Omit<Parameters<typeof generateText>[0], "model">,
  canRetry: () => boolean | Promise<boolean> = () => true,
) {
  const run = (modelId: string) =>
    generateText({
      ...opts,
      model: google(modelId),
      maxRetries: 1,
    } as Parameters<typeof generateText>[0]);
  let lastErr: unknown;
  const models = [MODEL_ID, ...FALLBACK_MODEL_IDS];
  // Skip models known to be out of quota, unless that would leave none.
  const ready = models.filter((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now());
  for (const modelId of ready.length ? ready : models) {
    try {
      return await run(modelId);
    } catch (err) {
      if (!isRateLimited(err) || !(await canRetry())) throw err;
      lastErr = err;
      // Overloaded: no wait to sit out, just try the next model.
      if (isOverloaded(err)) continue;
      const wait = retryDelayMs(err);
      console.warn(JSON.stringify({ scope: "kachi-rate-limit", model: modelId, waitMs: wait }));
      if (wait > 15_000) {
        exhaustedUntil.set(modelId, Date.now() + wait);
        continue;
      }
      await new Promise((r) => setTimeout(r, wait));
      try {
        return await run(modelId);
      } catch (again) {
        if (!isRateLimited(again) || !(await canRetry())) throw again;
        lastErr = again;
      }
    }
  }
  throw lastErr;
}

/** Gemini puts the wait in the error body, as "retryDelay": "23s". */
function retryDelayMs(err: unknown) {
  const seen = new Set<unknown>();
  let e: unknown = err;
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    const body = (e as { responseBody?: unknown }).responseBody;
    const m = typeof body === "string" ? body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/) : null;
    if (m) return Math.ceil(Number(m[1]) * 1000) + 250;
    e = (e as { lastError?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
  }
  return 5_000;
}
