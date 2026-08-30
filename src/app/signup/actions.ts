"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { setCurrentUserId } from "@/lib/session";
import { hashPassword, normalizeContact } from "@/lib/auth";
import { ZONE_COOKIE } from "@/lib/zone";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!name || !contact || password.length < 8) {
    redirect(`/signup?error=missing${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const { email, phone } = normalizeContact(contact);

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });
  if (existing) {
    redirect(`/signup?error=exists${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const store = await cookies();
  const zoneSlug = store.get(ZONE_COOKIE)?.value;
  const zone = zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: zoneSlug } }) : null;

  const user = await prisma.user.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      passwordHash: await hashPassword(password),
      deliveryZoneId: zone?.id ?? null,
    },
  });

  await setCurrentUserId(user.id);
  redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}
