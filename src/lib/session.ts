import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "ripe_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

const USER_INCLUDE = {
  subscriptionTier: true,
  deliveryZone: true,
  preferences: true,
} as const;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Create a fresh server-side session and set the cookie. Only the opaque random
 * token is ever sent to the browser. Call from a Server Action or Route Handler.
 */
export async function createSession(userId: string) {
  // Best-effort cleanup of this user's stale sessions.
  await prisma.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());
}

/** Delete the current session server-side and clear the cookie. */
export async function destroySession() {
  const token = await readToken();
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getCurrentUser() {
  const token = await readToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: USER_INCLUDE } },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not signed in");
  }
  return user;
}
