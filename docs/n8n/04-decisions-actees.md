# Phase de décision — les 4 points en attente sont tranchés

- **Date :** 2026-08-06
- **Fait suite à :** [03-connecteurs-get.md](03-connecteurs-get.md)

Les 4 points laissés en attente à la fin de la Phase 4 ont été tranchés.
Les 3 workflows du MVP sont maintenant **actifs** (plus de déclencheur
laissé désactivé par précaution).

## 1. Idempotence de la relance — migration Prisma

Décision : ajouter `Application.lastReminderSentAt` plutôt que de gérer la
déduplication côté n8n.

Fait :
- Migration `20260806065942_add_application_last_reminder_sent_at`
  (`ALTER TABLE "applications" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3);`).
- `IntegrationService.listApplicationsPendingReminder` exclut désormais les
  candidatures relancées il y a moins de `staleDays` (même fenêtre que le
  critère "pas de mise à jour depuis N jours" — un rappel par période de
  silence observée, pas un par exécution du cron).
- `IntegrationService.sendReminder` met à jour `lastReminderSentAt` juste
  après l'envoi.

Vérifié avec de vraies données seed : une candidature relancée disparaît
immédiatement de la liste `pending-reminder` suivante (2292 → 2291
candidatures, la candidature relancée absente).

Note technique : la base de dev locale n'a pas d'historique de migrations
Prisma (`_prisma_migrations` inexistante — gérée jusqu'ici via `db push`,
pas `migrate dev/deploy`). Le SQL a donc été appliqué directement en local
(identique à ce que `prisma migrate diff` a généré) ; le fichier de
migration créé est correct et s'appliquera normalement via
`prisma migrate deploy` sur un environnement qui a un vrai historique
(Neon/QA, voir DEPLOYMENT.md).

## 2. Destinataires du rapport hebdomadaire — tous les comptes ADMIN_GET

Décision : pas de liste d'emails à maintenir à part, la source de vérité
reste les rôles applicatifs.

Fait :
- `IntegrationService.sendWeeklyReport()` calcule le rapport puis l'envoie,
  via `NotificationService.send` (canal EMAIL existant), à tous les
  utilisateurs `role.name === 'ADMIN_GET'` et `isActive`.
- Nouvelle route `POST /api/integration/reports/weekly/send`. L'ancienne
  `GET /api/integration/reports/weekly` (données brutes, sans envoi) reste
  disponible pour du débogage ou un futur usage.
- Le workflow `GET-WEEKLY-REPORT` appelle maintenant cette route POST.

Testé : exécution manuelle → 2 destinataires (`admin@get.mg`,
`admin.national@demo.get.test`) → `status: SENT` pour chacun, appel confirmé
reçu côté backend depuis le conteneur n8n.

## 3. Isolation école — déjà corrigée, backlog non à jour

Ce n'était pas une décision technique à prendre : en creusant le code avant
d'écrire quoi que ce soit, `ensureApplicationInCallerSchool` et
`ensureOfferInCallerSchool` existaient déjà dans
`notification.controller.ts`, ajoutés par le commit `ad261a3` (2026-08-03,
correctifs de sécurité) — **après** la rédaction de
`security-audit-backlog.md` (28 juillet), qui n'a jamais été mis à jour pour
refléter ce correctif.

Re-vérifié avec un vrai compte `SCHOOL_ADMIN`, dans les deux sens, sur les
deux endpoints cités par le constat (`status-update`, `reminder`) : offre ou
candidature de son école → `201` ; offre ou candidature d'une autre école →
`403 Forbidden`. Aucun code modifié, seul `docs/security-audit-backlog.md`
a été mis à jour (l'item déplacé vers "Constats corrigés" avec les preuves).

## 4. Hébergement persistant — rien pour l'instant

Décision confirmée : pas de dépense engagée, l'instance reste locale
(`127.0.0.1`) le temps de prouver la valeur des 3 workflows maintenant
actifs. Les options restent posées dans
[02-preparation-infrastructure.md](02-preparation-infrastructure.md) pour
quand la décision sera reprise.

## État final des 3 workflows MVP

| Workflow | Déclencheur | État |
| --- | --- | --- |
| `GET-APPLICATION-INCOMPLETE-REMINDER` | Cron quotidien 7h | **Actif** |
| `GET-WEEKLY-REPORT` | Cron hebdomadaire, lundi 8h | **Actif** |
| `GET-STUDENT-WELCOME-EMAIL` | Webhook `student.created` | **Actif** |

Les crons tournent tant que le conteneur `get-n8n` local reste allumé sur
cette machine — ils ne s'exécutent pas "dans le cloud" pour l'instant,
conformément à la décision du point 4.

## Validation en live contre le backend QA (Render)

Le 2026-08-06, les 3 workflows ont été testés contre le vrai backend QA
déployé (`https://get-poc-backend.onrender.com`, base Neon), pas seulement
en local :

- **`GET-APPLICATION-INCOMPLETE-REMINDER` et `GET-WEEKLY-REPORT`** :
  fonctionnent tels quels — c'est n8n qui appelle le backend, aucune
  exposition n'est nécessaire. Testés avec succès en pointant temporairement
  `GET_BACKEND_URL`/`INTEGRATION_API_KEY` de n8n vers le QA, puis reconfiguré
  en local juste après (pas laissé pointé sur le QA sans surveillance).
- **`GET-STUDENT-WELCOME-EMAIL`** : sens inverse (le backend appelle n8n),
  donc n8n devait être temporairement joignable depuis Render. Un tunnel
  ngrok (`ngrok http --url=<domaine fixe gratuit> 5678`) lancé sur la
  machine locale a permis de valider la chaîne complète : inscription réelle
  sur le QA → webhook via le tunnel → n8n local → vérification du secret →
  rappel vers le QA → email envoyé. Deux tunnels gratuits testés avant ngrok
  (`cloudflared`, `localhost.run`) se sont révélés indisponibles/instables
  pour ce genre de trafic serveur-à-serveur.

Effet de bord découvert et corrigé au passage (commit `983ee48`) : le
premier déploiement manuel sur Render a échoué — `app.controller.ts` ne
répondait qu'au `GET /`, pas au `HEAD /`, et la sonde de démarrage de Render
fait un `HEAD /`. Correctif à deux niveaux (`AppController` + middleware
Express dans `main.ts` pour la racine hors du préfixe `/api`), pré-existant
à ce chantier, juste jamais remarqué faute de déploiement manuel antérieur.

Ce test a nécessité d'ajouter `INTEGRATION_API_KEY`, `N8N_WEBHOOK_BASE_URL`
et `N8N_WEBHOOK_SECRET` aux variables d'environnement Render (documentées
dans `backend/render.yaml`, valeurs saisies manuellement dans le dashboard).
Le tunnel ngrok a été fermé après le test ; `N8N_WEBHOOK_BASE_URL` sur
Render pointe donc de nouveau vers une URL qui ne répond plus — sans risque
(l'appel reste best-effort, échoue silencieusement en logs, ne bloque
jamais une inscription), mais à garder en tête si une vraie décision
d'hébergement (point 4) doit remplacer cette valeur.
