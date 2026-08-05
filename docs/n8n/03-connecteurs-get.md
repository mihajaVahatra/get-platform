# Phase 4 — Connecteurs GET (premier workflow réel)

- **Statut :** premier connecteur fonctionnel en local, idempotence non résolue
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

## Écart de sécurité assumé, à corriger avant tout usage réel

`docs/security-audit-backlog.md` a été vérifié : le correctif d'isolation
école n'a pas été touché par ce chantier (les endpoints `/notifications/*`
concernés n'ont pas été modifiés). L'endpoint `/integration/.../reminder`
neuf ajouté ici est volontairement **transverse à toutes les écoles** — c'est
cohérent avec un job d'automatisation quotidien, mais ça veut dire que la clé
API `INTEGRATION_API_KEY` donne accès à l'ensemble des candidatures, sans
notion de scope par école. Tant que cette clé reste uniquement utilisée par
n8n en local (`127.0.0.1`), le risque est contenu ; il redevient pertinent le
jour où l'hébergement persistant (Phase 2) est décidé.

## Détail technique notable

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` a été activé dans
`docker-compose.n8n.yml` pour que les nœuds HTTP Request du workflow
puissent lire `$env.GET_BACKEND_URL` et `$env.INTEGRATION_API_KEY`. Correct
sur une instance strictement locale ; une instance partagée devrait plutôt
stocker `INTEGRATION_API_KEY` comme **Credential n8n** (type
`httpHeaderAuth`, chiffré par n8n) référencée dans les nœuds, au lieu d'une
expression `$env` visible dans l'export JSON du workflow.

## Critère de sortie

Cette phase est close pour le MVP quand la question de l'idempotence est
tranchée (option 1 ou 2 ci-dessus) — c'est la seule chose qui empêche
aujourd'hui d'activer le déclencheur planifié sans risque de spam.
