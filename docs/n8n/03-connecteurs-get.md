# Phase 4 — Connecteurs GET (workflows réels)

- **Statut :** les 3 workflows du MVP (Phase 1) sont fonctionnels **et actifs**
  en local — voir [04-decisions-actees.md](04-decisions-actees.md) pour la
  résolution des points laissés ouverts ci-dessous (idempotence, destinataires,
  isolation école)
- **Date :** 2026-08-05 (mis à jour le 2026-08-06)
- **Fait suite à :** [02-preparation-infrastructure.md](02-preparation-infrastructure.md)

## Ce qui a été construit

Le workflow `GET-APPLICATION-INCOMPLETE-REMINDER`
(`n8n/workflows/get-application-incomplete-reminder.json`) appelle deux
routes backend nouvelles, sous `backend/src/modules/integration/` :

- `GET /api/integration/applications/pending-reminder?staleDays=N` — liste
  les candidatures encore ouvertes (`PENDING`/`UNDER_REVIEW`) non mises à
  jour depuis `N` jours. Retourne uniquement les IDs et dates nécessaires
  (pas de PII étudiant — l'email est résolu côté backend au moment de
  l'envoi, pas exposé à n8n).
- `POST /api/integration/applications/:id/reminder` — appelle directement
  `NotificationService.sendDeadlineReminder(...)`, **le même code** que
  l'action manuelle admin. Aucune logique de notification dupliquée.

Authentification : `ServiceApiKeyGuard`
(`backend/src/modules/integration/guards/service-api-key.guard.ts`), clé
statique dans l'en-tête `x-api-key`, comparaison en temps constant. Ces deux
routes sont marquées `@Public()` pour lever le `JwtAuthGuard` global (voir
commentaire dans `app.module.ts`) — c'est la seule façon prévue par le code
existant de créer une route sans JWT utilisateur, et `ServiceApiKeyGuard`
devient alors la seule porte d'entrée, jamais une absence de garde.

Testé de bout en bout : exécution manuelle du workflow via
`POST /rest/workflows/:id/run`, le backend a bien reçu l'appel `GET` de
listing puis (sur un test avec `staleDays=1`) un `POST .../reminder` qui a
renvoyé `{"status":"SENT"}` — logs backend confirmant l'origine réseau
`172.18.0.5` (le conteneur n8n).

## Ce qui n'est PAS résolu — bloquant avant d'activer le déclencheur planifié

**Idempotence.** `POST .../reminder` n'écrit aucune trace de "dernier rappel
envoyé" nulle part — ni sur `Application`, ni ailleurs. Si le workflow
planifié (`Tous les jours à 7h`, actuellement présent mais **laissé inactif**
dans le JSON importé) tournait tel quel, une candidature resterait éligible
au filtre `pending-reminder` indéfiniment tant qu'elle reste `PENDING` : elle
recevrait un rappel identique chaque jour jusqu'à changement de statut. Le
plan initial (Phase 5, workflow 3) prévoyait explicitement une "vérification
de la date de dernière relance" — ce n'est pas fait.

Deux options pour la suite, à trancher avant d'activer le cron :
1. Ajouter un champ `Application.lastReminderSentAt` (migration Prisma) et
   filtrer dessus côté `IntegrationService.listApplicationsPendingReminder`
   — le plus robuste, mais c'est une vraie migration de schéma à valider.
2. Faire porter la déduplication par n8n (nœud "Remove Duplicates" ou
   stockage dans les `staticData` du workflow) — plus rapide, mais moins
   fiable (perdu si le workflow est réimporté, pas visible depuis le
   backend/l'audit).

Recommandation : option 1, mais seulement si ce workflow particulier est
retenu après la période d'essai — pas de migration de schéma pour un
workflow qui reste désactivé.

## Deuxième workflow : `GET-WEEKLY-REPORT`

`n8n/workflows/get-weekly-report.json` appelle
`GET /api/integration/reports/weekly`
(`IntegrationService.getWeeklyReport`, `integration.service.ts`), qui
**réutilise `MinistryService.getDashboard({ from, to })`** — déjà purgé de
toute identité étudiante par construction — pour les candidatures,
inscriptions, écoles, taux d'acceptation et répartition par établissement.
Deux indicateurs ont dû être écrits car ils n'existaient nulle part :
nouveaux comptes sur 7 jours (`User.count`) et délai moyen entre
`submittedAt` et `decisionDate` sur les décisions de la semaine.

Testé de bout en bout par exécution manuelle (`POST /rest/workflows/:id/run`)
— appel `GET` reçu côté backend depuis l'IP du conteneur n8n, réponse avec
les vrais indicateurs seed (`totalApplications: 57`, `acceptanceRate: 16`,
etc.). Deux chiffres sont à ignorer sur les données de seed actuelles :
`newAccounts` (~19 500) et `averageProcessingDays` (~0) reflètent un import
en masse récent et des décisions injectées avec `decisionDate` ≈
`submittedAt` — pas un bug de la requête, juste un artefact du jeu de données
de test.

**Volontairement laissé incomplet : pas de destinataire.** Le workflow
s'arrête après avoir récupéré les indicateurs — il n'envoie rien à personne.
Le plan initial suppose un envoi automatique "aux utilisateurs autorisés",
mais cette liste (qui, par quel canal — email, Slack ?) est une décision
produit que je n'ai pas prise à votre place. Ajouter un nœud d'envoi une fois
la liste connue est trivial ; inventer des destinataires ne l'est pas.

## Troisième workflow : `GET-STUDENT-WELCOME-EMAIL` (premier événement poussé, pas interrogé)

Contrairement aux deux workflows précédents (n8n interroge le backend à
intervalle régulier), celui-ci inverse le sens : le backend pousse un
événement vers n8n au moment de l'inscription. C'est le seul des trois
workflows du MVP qui a nécessité de toucher un flux métier existant
(`AuthService.register`, `backend/src/modules/auth/auth.service.ts`).

- `AuthService.notifyN8n()` (nouvelle méthode privée) envoie un `POST` vers
  `${N8N_WEBHOOK_BASE_URL}/webhook/student-created` juste après la création
  du compte, avec `{ eventId, eventType: "student.created", occurredAt,
  entityId: user.id, source: "get-backend" }` — le format d'événement défini
  en Phase 1. **Jamais attendu (`await`)** : un timeout de 3s
  (`AbortSignal.timeout`) et un `.catch()` qui se contente de logger
  garantissent qu'un n8n indisponible ne peut pas faire échouer une
  inscription. `N8N_WEBHOOK_BASE_URL` non défini = no-op silencieux (safe par
  défaut en prod tant que l'hébergement n'est pas décidé).
- Le workflow `GET-STUDENT-WELCOME-EMAIL`
  (`n8n/workflows/get-student-welcome-email.json`) reçoit cet événement sur
  un nœud Webhook (`responseMode: onReceived` — accuse réception
  immédiatement, n'oblige pas le backend à attendre la suite), puis appelle
  `POST /api/integration/students/:userId/welcome-email`
  (`IntegrationService.sendWelcomeEmail` → délègue à
  `NotificationService.sendWelcomeEmail`, déjà existant et jusqu'ici jamais
  appelé automatiquement).

**Testé avec une vraie inscription**, pas juste un déclenchement manuel :
`POST /api/auth/register` avec un compte de test → exécution n8n `success`
horodatée à la même seconde → `POST /api/integration/students/<le vrai
userId>/welcome-email` reçu côté backend depuis l'IP du conteneur n8n. Deux
comptes de test (`n8n-e2e-test...@get-poc.local`) restent dans la base de
dev locale suite à ces essais — à purger si besoin, aucun impact au-delà du
local.

**Contrairement à la relance planifiée, ce workflow est laissé actif** :
un déclencheur webhook ne tourne qu'à la réception d'un vrai événement, il
n'y a pas de risque de répétition non maîtrisée comme avec un cron.
L'idempotence reste théoriquement absente ici aussi (`sendWelcomeEmail`
n'a pas de garde-fou anti-doublon), mais le seul déclencheur possible est une
inscription — qui ne se produit qu'une fois par compte dans le flux normal.

**Webhook entrant authentifié (corrigé).** `AuthService.notifyN8n` envoie
désormais un en-tête `x-webhook-secret` (nouveau `N8N_WEBHOOK_SECRET`,
distinct de `INTEGRATION_API_KEY` — sens inverse, backend → n8n) et le
workflow vérifie cet en-tête via un nœud IF ("Secret webhook valide ?") avant
d'appeler le backend. Choix délibéré face à l'authentification native du
nœud Webhook (`authentication: headerAuth`) : celle-ci exige une Credential
n8n chiffrée à créer via `import:credentials`, plus de surface pour se
tromper sans pouvoir déboguer visuellement ; le nœud IF est entièrement en
JSON versionné, testable par API, et donne le même résultat pour du local.
Vérifié dans les deux sens : un appel forgé sans le secret s'arrête au nœud
IF (`lastNodeExecuted: "Secret webhook valide ?"`, l'appel vers le backend
n'a jamais lieu) ; une vraie inscription passe et déclenche bien l'email.

## Écart de sécurité assumé, à corriger avant tout usage réel

`docs/security-audit-backlog.md` a été vérifié : le correctif d'isolation
école n'a pas été touché par ce chantier (les endpoints `/notifications/*`
concernés n'ont pas été modifiés). Les quatre routes `/integration/*`
ajoutées ici sont volontairement **transverses à toutes les écoles** — c'est
cohérent avec des jobs d'automatisation globaux (relance quotidienne, rapport
plateforme, bienvenue à l'inscription), mais ça veut dire que la clé API
`INTEGRATION_API_KEY` donne accès à l'ensemble des candidatures et des
indicateurs, sans notion de scope par école. Tant que cette clé reste
uniquement utilisée par n8n en local (`127.0.0.1`), le risque est contenu ;
il redevient pertinent le jour où l'hébergement persistant (Phase 2) est
décidé.

## Détail technique notable

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` a été activé dans
`docker-compose.n8n.yml` pour que les nœuds HTTP Request du workflow
puissent lire `$env.GET_BACKEND_URL` et `$env.INTEGRATION_API_KEY`. Correct
sur une instance strictement locale ; une instance partagée devrait plutôt
stocker `INTEGRATION_API_KEY` comme **Credential n8n** (type
`httpHeaderAuth`, chiffré par n8n) référencée dans les nœuds, au lieu d'une
expression `$env` visible dans l'export JSON du workflow.

## Critère de sortie

Les 3 workflows du MVP défini en Phase 1 sont construits, testés de bout en
bout en local, et **actifs**. Les 4 points ci-dessous sont tous tranchés —
détail dans [04-decisions-actees.md](04-decisions-actees.md) :
1. ✅ Idempotence de la relance — migration `lastReminderSentAt`.
2. ✅ Destinataires du rapport hebdomadaire — tous les comptes `ADMIN_GET`.
3. ✅ Authentification du webhook entrant `student-created`.
4. ✅ Isolation école — déjà corrigée par un commit antérieur, backlog mis à jour.

Reste ouvert, non traité ici : la décision d'hébergement persistant
(Phase 2), volontairement différée.

Conformément au backlog de la Phase 1 (item 7) : décider, sur la base de
l'usage réel de ces 3 workflows, si les 5 workflows restants du plan initial
apportent une valeur suffisante pour être construits — pas avant.
