import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { email, zoneRequested } = (await request.json()) as {
    email?: string;
    zoneRequested?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  await prisma.waitlistSignup.create({
    data: { email: email.trim().toLowerCase(), zoneRequested: zoneRequested ?? null },
  });

  return NextResponse.json({ ok: true });
}
