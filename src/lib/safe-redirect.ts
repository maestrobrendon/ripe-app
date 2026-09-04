function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Only allow same-origin relative paths as post-auth redirect targets. Anything
 * else (absolute URLs, protocol-relative "//host", backslash tricks, control
 * characters, or "javascript:" style values) falls back to a safe default.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) {
    return fallback;
  }
  if (!next.startsWith("/")) return fallback; // must be a relative path
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback; // not protocol-relative
  if (hasControlChars(next)) return fallback;
  return next;
}
