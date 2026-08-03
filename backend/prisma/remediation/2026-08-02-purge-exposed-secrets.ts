/**
 * Remédiation ponctuelle (audit sécurité 2026-08-02) :
 * l'intercepteur d'audit journalisait le corps complet des réponses HTTP,
 * y compris les secrets MFA (QR code + secret TOTP en clair renvoyés par
 * POST /auth/mfa/enable) et les objets User complets renvoyés par l'API
 * paiement (password hash, refreshToken, mfaSecret chiffré).
 *
 * Ce script :
 *   1. Supprime le contenu des colonnes before/after de tous les logs
 *      d'audit existants (les métadonnées action/resource/status/ip sont
 *      conservées).
 *   2. Force la réinitialisation du MFA pour tout utilisateur ayant un
 *      mfaSecret enregistré, puisque ce secret a pu transiter par un log
 *      d'audit lisible par les rôles ADMIN_GET / MINISTRY.
 *
 * Usage : ts-node prisma/remediation/2026-08-02-purge-exposed-secrets.ts
 * (à exécuter une seule fois, après le déploiement du correctif de
 * l'intercepteur d'audit)
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const purged = await prisma.auditLog.updateMany({
    data: { before: Prisma.DbNull, after: Prisma.DbNull },
  });
  console.log(`Logs d'audit purgés (before/after retirés) : ${purged.count}`);

  const exposedMfaUsers = await prisma.user.findMany({
    where: { mfaSecret: { not: null } },
    select: { id: true, email: true },
  });

  if (exposedMfaUsers.length > 0) {
    await prisma.user.updateMany({
      where: { mfaSecret: { not: null } },
      data: { mfaSecret: null, mfaEnabled: false },
    });
  }

  console.log(
    `MFA réinitialisé pour ${exposedMfaUsers.length} compte(s) : ` +
      exposedMfaUsers.map((u) => u.email).join(', '),
  );
  console.log(
    'Ces utilisateurs devront réactiver le MFA (POST /auth/mfa/enable) et seront notifiés.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
