# Phase 4 — Connecteurs GET (workflows réels)

- **Statut :** deux workflows fonctionnels en local (relance + rapport hebdomadaire),
  idempotence de la relance non résolue, destinataires du rapport non décidés
- **Date :** 2026-08-05
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

## Écart de sécurité assumé, à corriger avant tout usage réel

`docs/security-audit-backlog.md` a été vérifié : le correctif d'isolation
école n'a pas été touché par ce chantier (les endpoints `/notifications/*`
concernés n'ont pas été modifiés). Les trois routes `/integration/*`
ajoutées ici sont volontairement **transverses à toutes les écoles** — c'est
cohérent avec des jobs d'automatisation globaux (relance quotidienne, rapport
plateforme), mais ça veut dire que la clé API `INTEGRATION_API_KEY` donne
accès à l'ensemble des candidatures et des indicateurs, sans notion de scope
par école. Tant que cette clé reste uniquement utilisée par n8n en local
(`127.0.0.1`), le risque est contenu ; il redevient pertinent le jour où
l'hébergement persistant (Phase 2) est décidé.

## Détail technique notable

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` a été activé dans
`docker-compose.n8n.yml` pour que les nœuds HTTP Request du workflow
puissent lire `$env.GET_BACKEND_URL` et `$env.INTEGRATION_API_KEY`. Correct
sur une instance strictement locale ; une instance partagée devrait plutôt
stocker `INTEGRATION_API_KEY` comme **Credential n8n** (type
`httpHeaderAuth`, chiffré par n8n) référencée dans les nœuds, au lieu d'une
expression `$env` visible dans l'export JSON du workflow.

## Critère de sortie

Cette phase est close pour le MVP quand : la question de l'idempotence de la
relance est tranchée (option 1 ou 2 ci-dessus), et la liste de destinataires
du rapport hebdomadaire est définie — ce sont les deux seules choses qui
empêchent aujourd'hui d'activer les déclencheurs planifiés des deux
workflows.
