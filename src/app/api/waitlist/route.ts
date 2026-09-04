import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`waitlist:ip:${ip}`, 5, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { email?: unknown; zoneRequested?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const zoneRequested =
    typeof body.zoneRequested === "string" ? body.zoneRequested.slice(0, 100) : null;

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  await prisma.waitlistSignup.create({ data: { email, zoneRequested } });

  return NextResponse.json({ ok: true });
}
