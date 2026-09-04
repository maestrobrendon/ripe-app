import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { setZoneCookie, resolveZoneByCoords } from "@/lib/zone";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  const zones = await prisma.deliveryZone.findMany({
    where: { isServed: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, area: true },
  });
  return NextResponse.json({ zones });
}

export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`zone:ip:${ip}`, 30, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { slug?: unknown; lat?: unknown; lng?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let zone = null;

  if (typeof body.slug === "string" && body.slug) {
    zone = await prisma.deliveryZone.findUnique({ where: { slug: body.slug.slice(0, 100) } });
  } else if (
    typeof body.lat === "number" &&
    typeof body.lng === "number" &&
    Number.isFinite(body.lat) &&
    Number.isFinite(body.lng)
  ) {
    zone = await resolveZoneByCoords(body.lat, body.lng);
  }

  if (!zone) {
    return NextResponse.json({ outOfArea: true });
  }

  if (!zone.isServed) {
    return NextResponse.json({ outOfArea: true, zoneName: zone.name });
  }

  await setZoneCookie(zone.slug);

  const userId = await getCurrentUserId();
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { deliveryZoneId: zone.id } });
  }

  return NextResponse.json({
    zone: { slug: zone.slug, name: zone.name, area: zone.area, deliveryDays: zone.deliveryDays },
  });
}
