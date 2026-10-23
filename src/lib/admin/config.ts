import "server-only";

/*
 * Where the admin lives. It is only ever served on ADMIN_HOST (src/proxy.ts
 * enforces that), and passkeys are bound to that host (the WebAuthn RP ID),
 * so a passkey made for the admin can't be used anywhere else.
 */

export function adminHost(): string {
  const host = process.env.ADMIN_HOST?.trim().toLowerCase();
  if (!host) throw new Error("ADMIN_HOST is not set");
  return host;
}

/** https in production; http only for a local *.localhost host. */
export function adminOrigin(): string {
  const host = adminHost();
  const local = host.startsWith("localhost") || host.split(":")[0].endsWith(".localhost");
  return `${local ? "http" : "https"}://${host}`;
}

/** The WebAuthn relying party ID: the admin host without a port, unless overridden. */
export function rpId(): string {
  return process.env.WEBAUTHN_RP_ID?.trim().toLowerCase() || adminHost().split(":")[0];
}

export const RP_NAME = "BasketNG Admin";

export const isProduction = () => process.env.NODE_ENV === "production";
