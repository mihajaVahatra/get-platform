/**
 * Remédiation ponctuelle (audit sécurité 2026-08-10, suite) :
 * AuthService.forgotPassword persistait le lien de réinitialisation — donc
 * le token en clair — dans Notification.body via NotificationService.send(),
 * en plus de le journaliser sur console en l'absence de SendGrid. Corrigé
 * pour passer par sendRawEmail (hors table de notifications) avec le corps
 * masqué dans les logs, mais les lignes déjà écrites avant ce correctif
 * contiennent toujours un token utilisable (si le lien n'a pas encore été
 * consommé ni expiré).
 *
 * Ce script redacte le corps de toute Notification dont le body contient un
 * lien /auth/reset-password?token=... — idempotent (une ligne déjà redactée
 * ne contient plus ce motif, donc ignorée aux exécutions suivantes).
 *
 * Usage : ts-node prisma/remediation/2026-08-10-redact-reset-link-notifications.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const REDACTED_BODY =
  '[Contenu retiré — cette notification contenait un lien de réinitialisation de mot de passe, redacté le 2026-08-10 suite à un audit sécurité]';

async function main() {
  const { count } = await prisma.notification.updateMany({
    where: { body: { contains: '/auth/reset-password?token=' } },
    data: { body: REDACTED_BODY },
  });
  console.log(`Notifications contenant un lien de reset redactées : ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
