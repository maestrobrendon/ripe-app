import "server-only";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

/*
 * The model behind Kachi, shared by the signed-in agent (api/assistant) and
 * the guest bubble (api/kachi). Moved here unchanged from api/assistant.
 */

// Flash-Lite, not Flash. Measured on 2026-10-31 from this key: the free
// tier queues the bigger Flash models behind paying traffic, so a one-line
// question took 2 to 4.5 minutes on gemini-3.8-flash and 3.7-flash, while
// 3.5-flash-lite answered Kachi's full prompt, tools included, in 1 to 3
// seconds. Override with ASSISTANT_MODEL_ID rather than editing this file.
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "gemini-3.5-flash-lite";
// Free-tier quotas are counted per model, so when one runs dry for the day
// the next one usually still has room. Comma-separated, tried in order.
const FALLBACK_MODEL_IDS = (process.env.ASSISTANT_FALLBACK_MODEL_IDS ?? "gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL_ID);

/** How long one model gets before the turn moves on to the next. Nobody waits minutes for a reply. */
const ATTEMPT_MS = 15_000;

/** An attempt that ran out of time (ATTEMPT_MS). */
function isTimeout(err: unknown) {
  const detail = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /timeout|aborted/i.test(detail);
}

/** The provider is overloaded ("high demand", 503): another model usually isn't. */
function isOverloaded(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /high demand|overloaded|unavailable|503/i.test(detail) || isTimeout(err);
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
      abortSignal: AbortSignal.timeout(ATTEMPT_MS),
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
      // Overloaded or too slow: no wait to sit out, just try the next model.
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
