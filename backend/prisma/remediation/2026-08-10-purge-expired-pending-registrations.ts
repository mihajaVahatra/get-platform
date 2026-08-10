/**
 * Remédiation ponctuelle (audit sécurité 2026-08-10) :
 * une PendingRegistration n'est supprimée que lorsqu'un utilisateur revient
 * consommer son lien/code après expiration (voir AuthService.register /
 * verifyEmailByCode) — une inscription abandonnée avant expiration reste
 * donc indéfiniment en base, avec un mot de passe haché et un téléphone
 * chiffré appartenant à une personne qui n'a jamais activé de compte.
 *
 * Ce script supprime toute PendingRegistration dont expiresAt est déjà
 * dépassé. Idempotent (une exécution répétée ne trouve simplement plus
 * rien à purger) — destiné à tourner régulièrement (cron externe) tant
 * qu'aucune tâche planifiée équivalente n'existe côté application.
 *
 * Usage : ts-node prisma/remediation/2026-08-10-purge-expired-pending-registrations.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const { count } = await prisma.pendingRegistration.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.log(`Inscriptions en attente expirées purgées : ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
