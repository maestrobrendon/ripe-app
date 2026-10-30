/**
 * Issues an Owner invite for the admin: the only way the first staff account
 * comes into being. There are no default credentials anywhere; this prints a
 * single-use link (24 hours) that leads to setting a password and a passkey.
 *
 *   npm run admin:create-owner -- --email=you@example.com --name="Your Name"
 *   npm run admin:create-owner -- --email=… --name=… --prod --host=admin.example.com
 *
 * Without --prod it targets the development database (DATABASE_URL in
 * .env.local) and ADMIN_HOST from there. With --prod it targets
 * PROD_DATABASE_URL, and --host must name the production admin host so the
 * link points at the right place.
 *
 * Refuses when an active Owner already exists (they should invite from the
 * Staff page instead), unless --force is given, e.g. when every Owner has lost
 * their passkeys. Either way the invite is written to the audit log.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const args = process.argv.slice(2);
const flag = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).trim() : undefined;
};
const prod = args.includes("--prod");
const force = args.includes("--force");
const email = flag("email")?.toLowerCase();
const name = flag("name");

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail('Give a valid --email=you@example.com');
if (!name || name.length > 80) fail('Give --name="Your Name" (up to 80 characters)');

if (prod) {
  const url = process.env.PROD_DATABASE_URL;
  const host = flag("host");
  if (!url) fail("PROD_DATABASE_URL isn't set in .env.local.");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host) || host.includes("localhost")) fail("With --prod, give --host=<the production admin host>.");
  process.env.DATABASE_URL = url;
  process.env.ADMIN_HOST = host;
} else if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === "/neondb") {
  fail("DATABASE_URL points at the production database. Use --prod deliberately instead.");
}

async function main() {
  // Imported after the environment is settled: the client reads DATABASE_URL on load.
  const { prisma } = await import("../../src/lib/prisma");
  const { randomToken, sha256Hex } = await import("../../src/lib/admin/crypto");
  const { adminOrigin } = await import("../../src/lib/admin/config");
  const { audit } = await import("../../src/lib/admin/audit");

  const owners = await prisma.staffUser.count({ where: { role: "OWNER", status: "ACTIVE" } });
  if (owners > 0 && !force) {
    fail(`There ${owners === 1 ? "is already an active Owner" : `are already ${owners} active Owners`}. Invite from the admin's Staff page, or pass --force if every Owner is locked out.`);
  }
  const existing = await prisma.staffUser.findUnique({ where: { email: email! } });
  if (existing?.status === "ACTIVE" && !force) fail(`${email} already has an active admin account.`);

  // A locked-out Owner (lost passkeys, or passkeys made for an old admin address):
  // the account waits, suspended and signed out, until the new link is used,
  // which clears its old passkeys and codes and starts sign-in over.
  if (existing?.status === "ACTIVE") {
    await prisma.staffUser.update({ where: { id: existing.id }, data: { status: "SUSPENDED", failedLogins: 0, lockedUntil: null } });
    await prisma.staffSession.deleteMany({ where: { staffId: existing.id } });
  }
  await prisma.staffInvite.updateMany({ where: { email: email!, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = randomToken();
  const invite = await prisma.staffInvite.create({
    data: { tokenHash: sha256Hex(token), email: email!, name: name!, role: "OWNER", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  await audit({
    actorType: "SYSTEM",
    action: "staff.invite.created",
    targetType: "StaffInvite",
    targetId: invite.id,
    summary: `Owner invite for ${email} issued from the command line${force ? " (--force)" : ""}`,
  });

  console.log(`\n${prod ? "PRODUCTION" : "Development"} Owner invite for ${name} <${email}>`);
  console.log("Open this link within 24 hours. It works once and isn't stored anywhere:\n");
  console.log(`  ${adminOrigin()}/invite/${token}\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
