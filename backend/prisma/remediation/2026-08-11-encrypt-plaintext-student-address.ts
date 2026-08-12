/**
 * Remédiation ponctuelle (audit sécurité — complète 2026-08-10) :
 * `Student.address` n'a jamais été chiffré, contrairement à `phone`/`cin`
 * (voir `2026-08-10-encrypt-plaintext-pii.ts`) — ni côté
 * `StudentService.updateProfile` (corrigé dans le même lot que ce script),
 * ni côté `prisma/seed.ts` (idem). Ce script chiffre, de façon idempotente,
 * tout `Student.address` qui n'est pas déjà au format `iv:authTag:cipher`
 * produit par `EncryptionService` — les lignes déjà chiffrées sont
 * détectées et laissées intactes, donc ce script peut être relancé sans
 * risque.
 *
 * Usage : ts-node prisma/remediation/2026-08-11-encrypt-plaintext-student-address.ts
 * (nécessite ENCRYPTION_KEY dans l'environnement, comme le backend)
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-gcm';

function loadKey(): Buffer {
  const configured = process.env.ENCRYPTION_KEY?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^0x/i, '');
  if (!configured || !/^[a-fA-F0-9]{64}$/.test(configured)) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hexadecimal key');
  }
  return Buffer.from(configured, 'hex');
}

function encrypt(key: Buffer, text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/** Reconnaît le format `iv:authTag:cipher` (32 + 32 + N caractères hex). */
function looksAlreadyEncrypted(value: string): boolean {
  const parts = value.split(':');
  return (
    parts.length === 3 &&
    parts[0].length === 32 &&
    parts[1].length === 32 &&
    parts.every((p) => /^[a-f0-9]+$/i.test(p))
  );
}

async function main() {
  const key = loadKey();
  const students = await prisma.student.findMany({
    where: { address: { not: null } },
    select: { id: true, address: true },
  });

  let addressCount = 0;

  for (const student of students) {
    if (student.address && !looksAlreadyEncrypted(student.address)) {
      await prisma.student.update({
        where: { id: student.id },
        data: { address: encrypt(key, student.address) },
      });
      addressCount++;
    }
  }

  console.log(
    `Chiffrement terminé : ${addressCount} adresse(s) passée(s) du clair au chiffré (sur ${students.length} étudiant(s) avec une adresse renseignée).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
