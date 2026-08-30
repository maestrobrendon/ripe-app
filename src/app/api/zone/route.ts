import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { setZoneCookie, resolveZoneByCoords } from "@/lib/zone";

export async function GET() {
  const zones = await prisma.deliveryZone.findMany({
    where: { isServed: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, area: true },
  });
  return NextResponse.json({ zones });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    slug?: string;
    lat?: number;
    lng?: number;
  };

  let zone = null;

  if (body.slug) {
    zone = await prisma.deliveryZone.findUnique({ where: { slug: body.slug } });
  } else if (typeof body.lat === "number" && typeof body.lng === "number") {
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
