export const SITE_NAME = "Basket";

/**
 * The customer site's own origin, for links in emails. Never built from the
 * request's Host or X-Forwarded-Host headers, which a client can set (host
 * header poisoning would put an attacker's domain in a reset link). Order:
 * APP_ORIGIN, then Vercel's own production URL, then localhost in development.
 */
export function appOrigin(): string {
  const configured = process.env.APP_ORIGIN?.replace(/\/+$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("APP_ORIGIN is not set");
}
export const SITE_TAGLINE = "Fruits and vegetables, built around your goal.";
export const SUPPORT_EMAIL = "hello@getbasket.ng";
/** Placeholder until the real business line is connected. */
export const SUPPORT_WHATSAPP = "2348000000000";
