/**
 * Remédiation ponctuelle (audit sécurité 2026-08-10) :
 * l'inscription (AuthService.register) stockait le numéro de téléphone en
 * clair dans PendingRegistration puis le recopiait tel quel dans
 * Student.phone à la vérification d'email, alors que la mise à jour de
 * profil (StudentService.updateProfile) chiffre bien phone/cin depuis le
 * départ. Résultat : des lignes Student.phone/cin en clair coexistaient
 * avec des lignes chiffrées, et StudentService.getProfile masquait le
 * problème avec un fallback silencieux vers la valeur brute en cas d'échec
 * de déchiffrement (retiré dans le même correctif).
 *
 * Ce script chiffre, de façon idempotente, tout Student.phone / Student.cin
 * qui n'est pas déjà au format `iv:authTag:cipher` produit par
 * EncryptionService (16 octets IV + 16 octets authTag GCM, tout en hex) —
 * les lignes déjà chiffrées sont détectées et laissées intactes, donc ce
 * script peut être relancé sans risque.
 *
 * Usage : ts-node prisma/remediation/2026-08-10-encrypt-plaintext-pii.ts
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
    where: { OR: [{ phone: { not: null } }, { cin: { not: null } }] },
    select: { id: true, phone: true, cin: true },
  });

  let phoneCount = 0;
  let cinCount = 0;

  for (const student of students) {
    const data: { phone?: string; cin?: string } = {};

    if (student.phone && !looksAlreadyEncrypted(student.phone)) {
      data.phone = encrypt(key, student.phone);
      phoneCount++;
    }
    if (student.cin && !looksAlreadyEncrypted(student.cin)) {
      data.cin = encrypt(key, student.cin);
      cinCount++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.student.update({ where: { id: student.id }, data });
    }
  }

  console.log(
    `Chiffrement terminé : ${phoneCount} téléphone(s) et ${cinCount} CIN passés du clair au chiffré (sur ${students.length} étudiant(s) avec au moins un des deux champs renseigné).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
