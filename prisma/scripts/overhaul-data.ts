/**
 * One-off data changes for the signed-in overhaul (Oct 2026). Safe to re-run.
 *
 * - Phones stored the way they were typed become +234XXXXXXXXXX.
 * - Each account's single address becomes a saved "Home" address.
 * - Every delivery runs on a day its area actually serves.
 * - Everyone gets an invite code.
 * - Drinks and archived lines leave the shelves: the smoothie box is hidden,
 *   and recipes built on Fresh Cuts are unpublished.
 *
 *   npx tsx --conditions=react-server prisma/scripts/overhaul-data.ts [--prod]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const prod = process.argv.includes("--prod");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL isn't set in .env.local.");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  throw new Error("DATABASE_URL points at production. Use --prod deliberately.");
}

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { normalizePhone } = await import("../../src/lib/phone");
  const { newReferralCode } = await import("../../src/lib/referrals");

  let phones = 0;
  let phoneClashes = 0;
  for (const u of await prisma.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })) {
    const n = normalizePhone(u.phone);
    if (!n || n === u.phone) continue;
    const clash = await prisma.user.findFirst({ where: { phone: n, id: { not: u.id } }, select: { id: true } });
    if (clash) {
      phoneClashes++;
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { phone: n } });
    phones++;
  }

  let addresses = 0;
  for (const u of await prisma.user.findMany({ where: { address: { not: null }, deliveryZoneId: { not: null }, addresses: { none: {} } }, select: { id: true, address: true, deliveryZoneId: true } })) {
    await prisma.address.create({ data: { userId: u.id, label: "Home", line1: u.address!.slice(0, 200), zoneId: u.deliveryZoneId!, isDefault: true } });
    addresses++;
  }

  let days = 0;
  for (const b of await prisma.basket.findMany({ select: { id: true, deliveryDay: true, user: { select: { deliveryZone: { select: { deliveryDays: true } } } } } })) {
    const zoneDays = b.user.deliveryZone?.deliveryDays ?? [];
    if (zoneDays.length && !zoneDays.includes(b.deliveryDay)) {
      await prisma.basket.update({ where: { id: b.id }, data: { deliveryDay: zoneDays[0] } });
      days++;
    }
  }

  let codes = 0;
  for (const u of await prisma.user.findMany({ where: { referralCode: null }, select: { id: true, name: true } })) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.user.update({ where: { id: u.id }, data: { referralCode: newReferralCode(u.name) } });
        codes++;
        break;
      } catch {
        // Code taken: try another.
      }
    }
  }

  // An older version stored weighed produce in grams (500 for 500g of ugu);
  // a line now counts packs (1 = one 250g bag). Lines still in grams become
  // the nearest number of packs. Past orders are left as they were.
  let weighed = 0;
  const gramLines = await prisma.basketItem.findMany({ where: { quantity: { gte: 50 }, product: { soldAs: "WEIGHT" } }, select: { id: true, quantity: true, product: { select: { referenceWeightG: true } } } });
  for (const line of gramLines) {
    const packG = line.product.referenceWeightG;
    if (!packG || line.quantity % 50 !== 0) continue;
    await prisma.basketItem.update({ where: { id: line.id }, data: { quantity: Math.max(1, Math.round(line.quantity / packG)) } });
    weighed++;
  }

  const hidden = await prisma.product.updateMany({ where: { slug: "smoothie-box", availability: { not: "HIDDEN" } }, data: { availability: "HIDDEN", inSeason: false } });
  const freshCutRecipes = await prisma.recipe.updateMany({ where: { slug: { in: ["coleslaw"] }, status: "PUBLISHED" }, data: { status: "DRAFT", onMenu: false } });

  console.log(
    `${prod ? "PRODUCTION" : "Development"}: ${phones} phones normalised (${phoneClashes} left as they were: another account has that number), ${addresses} saved addresses, ${days} deliveries moved to an area day, ${codes} invite codes, ${weighed} weighed lines turned from grams into packs, ${hidden.count} drink box hidden, ${freshCutRecipes.count} Fresh Cuts recipe unpublished.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
