/**
 * The pg driver treats sslmode=prefer/require/verify-ca as aliases for
 * verify-full and prints a deprecation warning about it on every connection.
 * We make it explicit so the warning stops. Behaviour is unchanged.
 */
export function dbConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(\b|$)/i, "$1verify-full");
}
