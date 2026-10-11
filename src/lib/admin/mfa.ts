import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, sha256Hex } from "./crypto";
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { adminOrigin, RP_NAME, rpId } from "./config";
import { setChallenge, takeChallenge } from "./session";
import type { StaffUser } from "@/generated/prisma/client";

/* ------------------------------- overview -------------------------------- */

export type MfaMethods = { passkeys: number; totp: boolean; recoveryLeft: number };

export async function mfaMethods(staffId: string): Promise<MfaMethods> {
  const [passkeys, staff, recoveryLeft] = await Promise.all([
    prisma.staffPasskey.count({ where: { staffId } }),
    prisma.staffUser.findUnique({ where: { id: staffId }, select: { totpEnabledAt: true } }),
    prisma.staffRecoveryCode.count({ where: { staffId, usedAt: null } }),
  ]);
  return { passkeys, totp: Boolean(staff?.totpEnabledAt), recoveryLeft };
}

/** Owners must hold a passkey (phishing-resistant); everyone else needs at least one factor. */
export function mfaSatisfied(role: string, m: MfaMethods): boolean {
  if (role === "OWNER") return m.passkeys > 0;
  return m.passkeys > 0 || m.totp;
}

/* --------------------------------- TOTP ---------------------------------- */

/** Starts (or restarts) authenticator setup: a new secret, stored encrypted, not active until confirmed. */
export async function beginTotp(staff: Pick<StaffUser, "id" | "email">): Promise<{ secret: string; qrSvg: string; uri: string }> {
  const secret = generateTotpSecret();
  await prisma.staffUser.update({ where: { id: staff.id }, data: { totpSecretEnc: encrypt(secret), totpEnabledAt: null, totpLastCounter: null } });
  const uri = otpauthUri(secret, staff.email);
  const qrSvg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { secret, qrSvg, uri };
}

/** The first correct code switches the authenticator on. */
export async function confirmTotp(staffId: string, code: string): Promise<boolean> {
  const staff = await prisma.staffUser.findUnique({ where: { id: staffId } });
  if (!staff?.totpSecretEnc) return false;
  const counter = verifyTotp(decrypt(staff.totpSecretEnc), code.trim());
  if (counter === null) return false;
  await prisma.staffUser.update({ where: { id: staffId }, data: { totpEnabledAt: new Date(), totpLastCounter: counter } });
  return true;
}

/** A sign-in or step-up code. Each 30-second code works once (the counter only moves forward). */
export async function checkTotp(staffId: string, code: string): Promise<boolean> {
  const staff = await prisma.staffUser.findUnique({ where: { id: staffId } });
  if (!staff?.totpSecretEnc || !staff.totpEnabledAt) return false;
  const counter = verifyTotp(decrypt(staff.totpSecretEnc), code.trim(), { lastUsedCounter: staff.totpLastCounter ?? -1 });
  if (counter === null) return false;
  // Conditional update: if another request used this same code a moment ago, this one loses.
  const { count } = await prisma.staffUser.updateMany({
    where: { id: staffId, OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }] },
    data: { totpLastCounter: counter },
  });
  return count === 1;
}

export async function disableTotp(staffId: string): Promise<void> {
  await prisma.staffUser.update({ where: { id: staffId }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastCounter: null } });
}

/* ---------------------------- recovery codes ----------------------------- */

const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z2-7]/g, "");

/** Ten fresh one-time codes; any previous set stops working. Shown once, stored hashed. */
export async function newRecoveryCodes(staffId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  await prisma.$transaction([
    prisma.staffRecoveryCode.deleteMany({ where: { staffId } }),
    prisma.staffRecoveryCode.createMany({ data: codes.map((c) => ({ staffId, codeHash: sha256Hex(`${staffId}:${normalizeCode(c)}`) })) }),
  ]);
  return codes;
}

/** Spends a recovery code. Atomic: two simultaneous uses of one code can't both succeed. */
export async function redeemRecoveryCode(staffId: string, code: string): Promise<boolean> {
  const n = normalizeCode(code);
  if (n.length !== 10) return false;
  const { count } = await prisma.staffRecoveryCode.updateMany({
    where: { staffId, codeHash: sha256Hex(`${staffId}:${n}`), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

/* ------------------------------- passkeys -------------------------------- */

export async function passkeyRegistrationOptions(sessionId: string, staff: Pick<StaffUser, "id" | "email" | "name">) {
  const existing = await prisma.staffPasskey.findMany({ where: { staffId: staff.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(),
    userName: staff.email,
    userDisplayName: staff.name,
    userID: new TextEncoder().encode(staff.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  await setChallenge(sessionId, options.challenge);
  return options;
}

export async function finishPasskeyRegistration(sessionId: string, staffId: string, response: RegistrationResponseJSON, name: string): Promise<boolean> {
  const expectedChallenge = await takeChallenge(sessionId);
  if (!expectedChallenge) return false;
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: adminOrigin(),
    expectedRPID: rpId(),
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return false;
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  await prisma.staffPasskey.create({
    data: {
      staffId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name.trim().slice(0, 60) || "Passkey",
    },
  });
  return true;
}

export async function passkeyAuthenticationOptions(sessionId: string, staffId: string) {
  const creds = await prisma.staffPasskey.findMany({ where: { staffId }, select: { credentialId: true, transports: true } });
  if (creds.length === 0) return null;
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports })),
    userVerification: "required",
  });
  await setChallenge(sessionId, options.challenge);
  return options;
}

export async function finishPasskeyAuthentication(sessionId: string, staffId: string, response: AuthenticationResponseJSON): Promise<boolean> {
  const expectedChallenge = await takeChallenge(sessionId);
  if (!expectedChallenge) return false;
  // Only this staff member's own credentials count.
  const cred = await prisma.staffPasskey.findFirst({ where: { staffId, credentialId: response.id } });
  if (!cred) return false;
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: adminOrigin(),
    expectedRPID: rpId(),
    credential: { id: cred.credentialId, publicKey: new Uint8Array(cred.publicKey), counter: Number(cred.counter), transports: cred.transports },
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return false;
  const next = BigInt(result.authenticationInfo.newCounter);
  // A counter that goes backwards means a cloned authenticator: refuse it.
  if (next !== BigInt(0) && next <= cred.counter) return false;
  await prisma.staffPasskey.update({ where: { id: cred.id }, data: { counter: next, lastUsedAt: new Date() } });
  return true;
}
