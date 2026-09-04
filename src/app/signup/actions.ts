"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hashPassword, normalizeContact } from "@/lib/auth";
import { ZONE_COOKIE } from "@/lib/zone";
import { safeNextPath } from "@/lib/safe-redirect";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  const safeNext = safeNextPath(String(formData.get("next") ?? ""), "");
  const nextParam = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";

  const ip = await clientIp();
  if (!rateLimit(`signup:ip:${ip}`, 5, HOUR).ok) {
    redirect(`/signup?error=throttled${nextParam}`);
  }

  if (!name || !contact || password.length < 8 || password.length > 200) {
    redirect(`/signup?error=missing${nextParam}`);
  }

  const { email, phone } = normalizeContact(contact);

  // Always hash, so the "already exists" path costs the same as a real signup.
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });
  if (existing) {
    // Generic response: do not confirm that the account exists.
    redirect(`/signup?error=failed${nextParam}`);
  }

  const store = await cookies();
  const zoneSlug = store.get(ZONE_COOKIE)?.value;
  const zone = zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: zoneSlug } }) : null;

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        deliveryZoneId: zone?.id ?? null,
      },
    });
  } catch {
    // Unique-constraint race, or bad input. Stay generic.
    redirect(`/signup?error=failed${nextParam}`);
  }

  await createSession(user.id);
  redirect(`/onboarding${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`);
}
