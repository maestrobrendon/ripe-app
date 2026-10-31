import "server-only";
import { generateText, streamText, type SystemModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

/*
 * The model behind Kachi, shared by the signed-in agent (api/assistant) and
 * the guest bubble (api/kachi).
 *
 * Claude Haiku 5.5 first: measured on 2026-10-31 on Kachi's real prompt and
 * tools, it answered in 2 to 5 seconds and costs about $1.50 per 1,000
 * messages. Gemini Flash-Lite (free tier) stands behind it, so Kachi keeps
 * answering if Claude is down, busy or out of credit. Free Gemini Flash (not
 * Lite) is no use: the free tier queues it behind paying traffic, and a
 * one-line question took 2 to 4.5 minutes.
 *
 * Override with ASSISTANT_MODEL_ID / ASSISTANT_FALLBACK_MODEL_IDS rather than
 * editing this file. A "claude-" id goes to Anthropic, anything else to Google.
 */
const MODEL_ID = process.env.ASSISTANT_MODEL_ID || "claude-haiku-5-5";
// Free-tier quotas are counted per model, so when one runs dry for the day
// the next one usually still has room. Comma-separated, tried in order.
const FALLBACK_MODEL_IDS = (process.env.ASSISTANT_FALLBACK_MODEL_IDS ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL_ID);

const isClaude = (modelId: string) => modelId.startsWith("claude-");

/** How long one model gets before the turn moves on to the next. Nobody waits minutes for a reply. */
const ATTEMPT_MS = 15_000;

/*
 * Claude's settings. Short answers and basket changes need little thought,
 * so effort is low; thinking stays on (adaptive), which keeps its tool calls
 * reliable. Gemini ignores these.
 */
const PROVIDER_OPTIONS = { anthropic: { effort: "low" } };

/**
 * Kachi's instructions in two parts. `shared` is the same for every customer
 * (voice, rules, recipes, catalogue) and is cached by Claude, so after the
 * first message it costs a tenth as much and is read faster. `personal` is
 * about this customer and comes after it, so it never breaks the cache.
 */
export function kachiInstructions(shared: string, personal: string): SystemModelMessage[] {
  const parts: SystemModelMessage[] = [
    { role: "system", content: shared, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
  ];
  if (personal.trim()) parts.push({ role: "system", content: personal });
  return parts;
}

/** An attempt that ran out of time (ATTEMPT_MS). */
function isTimeout(err: unknown) {
  const detail = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /timeout|aborted/i.test(detail);
}

/** The provider is overloaded ("high demand", 503, Claude's 529): another model usually isn't. */
function isOverloaded(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /high demand|overloaded|unavailable|503|529/i.test(detail) || isTimeout(err);
}

/**
 * A provider "too many requests", quota or overload error, from any layer of
 * wrapping: the turns where "I'm a little busy, try again" is the honest reply.
 */
export function isRateLimited(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|quota|resource.?exhausted/i.test(detail) || isOverloaded(err);
}

/** Per server instance: when each model's daily quota should be back. */
const exhaustedUntil = new Map<string, number>();

/**
 * generateText across the models, in order. A short wait (a per-minute
 * limit) is waited out once on the same model; a long one (a daily quota)
 * moves to the next. Any failure from Claude (busy, a key problem, credit
 * run out) moves to Gemini. A retry re-runs the whole turn, so `canRetry`
 * says no once a tool has changed something, rather than risk making the
 * change twice.
 */
export async function generate(
  opts: Omit<Parameters<typeof generateText>[0], "model">,
  canRetry: () => boolean | Promise<boolean> = () => true,
) {
  const run = (modelId: string) =>
    generateText({
      ...opts,
      model: isClaude(modelId) ? anthropic(modelId) : google(modelId),
      providerOptions: PROVIDER_OPTIONS,
      // Set, because the SDK predates Haiku 5.5 and would guess. Replies are short; this is only a ceiling.
      maxOutputTokens: opts.maxOutputTokens ?? 16_000,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(ATTEMPT_MS),
    } as Parameters<typeof generateText>[0]);
  let lastErr: unknown;
  // Claude only when there's a key for it.
  const models = [MODEL_ID, ...FALLBACK_MODEL_IDS].filter((m) => !isClaude(m) || process.env.ANTHROPIC_API_KEY);
  // Skip models known to be out of quota, unless that would leave none.
  const ready = models.filter((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now());
  for (const modelId of ready.length ? ready : models) {
    try {
      return await run(modelId);
    } catch (err) {
      const claudeFailed = isClaude(modelId);
      if ((!claudeFailed && !isRateLimited(err)) || !(await canRetry())) throw err;
      lastErr = err;
      if (claudeFailed) {
        console.warn(JSON.stringify({ scope: "kachi-fallback", model: modelId, error: String(err).slice(0, 300) }));
        continue;
      }
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

/**
 * generate(), but the reply's words arrive through onText as they're written,
 * so the chat can show them at once. A model gets ATTEMPT_MS to start; if it
 * fails before writing anything (and canRetry allows), the next model takes
 * over, as with generate(). Once words have gone out there's no switching.
 */
export async function generateStreaming(
  opts: Omit<Parameters<typeof streamText>[0], "model">,
  onText: (delta: string) => void,
  canRetry: () => boolean | Promise<boolean> = () => true,
) {
  const models = [MODEL_ID, ...FALLBACK_MODEL_IDS].filter((m) => !isClaude(m) || process.env.ANTHROPIC_API_KEY);
  const ready = models.filter((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now());
  let lastErr: unknown;
  for (const modelId of ready.length ? ready : models) {
    let wrote = false;
    const started = new AbortController();
    const timer = setTimeout(() => started.abort(new Error("timeout waiting for the first words")), ATTEMPT_MS);
    try {
      const r = streamText({
        ...opts,
        model: isClaude(modelId) ? anthropic(modelId) : google(modelId),
        providerOptions: PROVIDER_OPTIONS,
        maxOutputTokens: opts.maxOutputTokens ?? 16_000,
        maxRetries: 1,
        abortSignal: started.signal,
      } as Parameters<typeof streamText>[0]);
      for await (const part of r.fullStream) {
        // Any sign of life (words, or a tool being called) means this model is answering.
        if (part.type === "text-delta" || part.type === "tool-call") clearTimeout(timer);
        if (part.type === "text-delta" && part.text) {
          wrote = true;
          onText(part.text);
        } else if (part.type === "error") throw part.error;
      }
      return { text: await r.text, steps: await r.steps };
    } catch (err) {
      lastErr = err;
      if (wrote || !(await canRetry())) throw err;
      if (!isClaude(modelId) && !isRateLimited(err)) throw err;
      console.warn(JSON.stringify({ scope: "kachi-fallback", model: modelId, streaming: true, error: String(err).slice(0, 300) }));
    } finally {
      clearTimeout(timer);
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
