import { createHash } from "node:crypto";

/*
 * The audit log's tamper evidence, as pure functions (the database code in
 * audit.ts uses these). Each event's hash covers its own canonical content
 * plus the previous event's hash, so changing, removing or reordering any
 * past row breaks every hash after it.
 */

export const GENESIS = "0".repeat(64);

/** JSON with object keys sorted at every depth, so the same data always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export function chainHash(prevHash: string, body: unknown): string {
  return createHash("sha256").update(prevHash).update("\n").update(canonical(body)).digest("hex");
}

export type ChainRow = { id: string; prevHash: string; hash: string; body: unknown };

/** Walks rows in order; returns the first row that doesn't check out, or null if the chain is intact. */
export function verifyChain(rows: ChainRow[], startPrev = GENESIS): { brokenAt: string; reason: "prev" | "hash" } | null {
  let prev = startPrev;
  for (const row of rows) {
    if (row.prevHash !== prev) return { brokenAt: row.id, reason: "prev" };
    if (chainHash(row.prevHash, row.body) !== row.hash) return { brokenAt: row.id, reason: "hash" };
    prev = row.hash;
  }
  return null;
}

/** Keys whose values never belong in an audit diff, at any depth. */
const SECRET_KEYS = /pass(word)?|secret|token|hash|totp|recovery|card|cvv|otp/i;

export function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v)]),
  );
}
