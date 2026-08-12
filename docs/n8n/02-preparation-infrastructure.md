# Phase 2 — Préparation de l'infrastructure

- **Statut :** partiellement fait (local), décision d'hébergement persistant en attente
- **Date :** 2026-08-05
- **Fait suite à :** [01-cadrage-et-conception.md](01-cadrage-et-conception.md)

## Ce qui a été fait (local, sans coût, réversible)

n8n tourne maintenant en local sur PostgreSQL au lieu de SQLite, en réutilisant
le conteneur `get-db` déjà provisionné par le `docker-compose.yml` principal,
plutôt que d'opérer un second moteur de base de données :

- Base dédiée `n8n` créée dans `get-db`.
- Rôle Postgres dédié `n8n_service`, propriétaire de cette seule base — **pas**
  de réutilisation du rôle applicatif `get_user`, pour rester isolé du reste
  des données GET même si un jour cette base est exposée au-delà du poste local.
- `docker-compose.n8n.yml` rejoint le réseau docker `get-poc_default` déjà créé
  par le stack principal, sans le modifier.
- Identifiants n8n (`N8N_DB_PASSWORD`, compte owner) dans `.env.n8n`, gitignored.

Vérifié de bout en bout après bascule : import + activation du workflow
`GET-TEST-WEBHOOK`, appel `curl` reçu et traité (voir historique du test
précédent, rejoué à l'identique sur cette nouvelle instance). Ce workflow —
un webhook d'écho sans authentification, actif par défaut à l'import — a
depuis été retiré du dépôt (`n8n/workflows/get-test-webhook.json`) une fois
sa preuve de fonctionnement actée : le laisser versionné indéfiniment
aurait signifié rejouer un webhook non authentifié à chaque import sur une
nouvelle instance (voir [Durcissement sécurité](#durcissement-sécurité-2026-08-11) ci-dessous).

### Constat annexe : dérive de mot de passe sur `get_user`

En branchant n8n sur `get-db`, le mot de passe `POSTGRES_PASSWORD` du `.env`
racine **et** celui de `DATABASE_URL` dans `backend/.env` ont tous les deux
échoué en authentification réseau (`scram-sha-256`) contre le rôle `get_user`
du conteneur `get-db` actuellement en cours d'exécution — seule
l'authentification locale par socket Unix (qui ignore le mot de passe,
`trust` dans `pg_hba.conf`) fonctionne, ce qui masquait le problème.

Cause probable : le volume `postgres_data` du conteneur n'a pas été
réinitialisé après une rotation de secrets (le script
`npm run remediate:purge-exposed-secrets` existe dans `backend/package.json`,
ce qui suggère un précédent). Je n'ai pas touché à `get_user` ni à son mot de
passe — ce n'est pas dans le périmètre de ce chantier n8n et une correction
mal faite pourrait casser un backend qui, lui, fonctionne peut-être très bien
aujourd'hui via un canal ou un identifiant que je n'ai pas sous les yeux (une
connexion déjà ouverte, une valeur différente en local chez chacun, etc.). À
vérifier par l'équipe backend : `docker exec -e PGPASSWORD=<valeur de
backend/.env DATABASE_URL> get-db psql -h <IP docker de get-db> -U get_user`.

## Décision à trancher : hébergement persistant

Ce que fait tourner ce chantier aujourd'hui (conteneur local, `127.0.0.1`
uniquement) ne peut pas recevoir de webhook réel du backend GET déployé sur
Render/Vercel — il faut une instance n8n joignable en permanence depuis
Internet. C'est un choix d'infra qui engage un coût récurrent ou une
dépendance ; je ne le prends pas à votre place.

| Option | Coût approximatif | Compromis |
| --- | --- | --- |
| n8n Cloud (hébergé par n8n) | ~20 €/mois (offre Starter) | Zéro ops, mais moins de contrôle et un service tiers de plus à gérer côté RGPD/audit |
| VPS dédié (Hetzner, OVH...) | ~5-6 €/mois | Correspond au plan initial (Docker + reverse proxy + HTTPS), mais introduit un serveur à patcher/surveiller |
| Render payant (Starter, comme le backend) | ~7 $/mois | Cohérent avec le reste du stack QA déjà sur Render, mais Render n'est pas pensé pour un service à état persistant (volume) — à vérifier avant de s'engager |
| Rien pour l'instant | 0 € | On garde n8n en local, on prouve la valeur des 3 workflows du MVP avant d'engager une dépense récurrente |

Recommandation : partir sur "rien pour l'instant". Les 3 workflows du MVP
(relance, rapport, bienvenue) peuvent être développés et testés en local avec
des données de test, sans instance publique — l'hébergement persistant ne
devient nécessaire qu'au moment de vouloir les déclencher par de vrais
événements du backend déployé. Décision à reprendre en fin de Phase 5.

## Environnements

Un seul environnement pour l'instant : local. Le plan initial (dev/uat/prod)
est différé — pas d'équipe UAT distincte à ce stade, et la séparation
dev/uat proposée par le plan pour rester léger ("peuvent temporairement
partager la même infrastructure") s'applique encore plus à un environnement
qui n'existe pas encore.

## Sécurité — fait vs différé

Fait, applicable dès maintenant :
- Instance liée à `127.0.0.1` uniquement, aucune exposition réseau.
- Secrets (mot de passe DB n8n, identifiants owner) dans `.env.n8n`, hors git.
- Rôle Postgres dédié, scope limité à la base `n8n`.

Différé, à traiter seulement au moment de l'hébergement persistant :
- HTTPS / certificat.
- Restriction IP, désactivation des inscriptions publiques.
- Sauvegarde automatique (aucune sauvegarde locale aujourd'hui — acceptable
  tant que l'instance ne contient que des workflows de test reproductibles
  depuis `n8n/workflows/`).
- Rotation des secrets.

## Durcissement sécurité (2026-08-11)

Suite à l'audit sécurité, complète la liste "fait" ci-dessus (US-07 du
backlog) — objectif : la compromission d'un poste ou d'un compte n8n (pas
nécessairement le conteneur/l'hôte lui-même) ne doit pas donner accès aux
secrets de la plateforme.

- **Image épinglée sur un digest**, pas `n8nio/n8n:latest`
  (`docker-compose.n8n.yml`) — un tag flottant peut pointer vers un binaire
  différent du jour au lendemain sans que rien ne le signale.
- **`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`** (était `false`) : aucune expression
  de nœud ($env.*, y compris hors nœud Code) ne peut plus lire les variables
  d'environnement du conteneur. Conséquence directe : les 4 nœuds HTTP
  Request sortants des 3 workflows utilisent désormais une **Credential n8n
  chiffrée** (`httpHeaderAuth`) au lieu d'une expression `$env` pour l'en-tête
  `x-api-key`, et le webhook entrant (`GET-STUDENT-WELCOME-EMAIL`) utilise
  l'authentification "Header Auth" native du nœud Webhook au lieu du nœud IF
  comparant à `$env.N8N_WEBHOOK_SECRET` — détail dans
  [03-connecteurs-get.md](03-connecteurs-get.md). Ces Credentials sont une
  étape manuelle (UI n8n, Settings → Credentials) : leurs valeurs ne sont
  jamais dans un fichier versionné, voir `.env.n8n.example`.
- **`NODES_EXCLUDE`** retire le nœud "Execute Command" : `N8N_BLOCK_ENV_ACCESS_IN_NODE`
  ne bloque que l'expression `$env`, pas une commande shell arbitraire qui
  lirait les variables d'environnement autrement.
- **Webhook de test retiré** (`get-test-webhook.json`) — voir plus haut.
- **`chmod 600`** sur les fichiers de secrets réels (`.env`, `backend/.env`,
  `.env.n8n`) — non versionné par nature (permissions fichier), donc à
  refaire sur chaque poste ; documenté en tête de `.env.example` et
  `.env.n8n.example`.

## Critère de sortie

Cette phase est considérée close pour le MVP quand : le choix d'hébergement
persistant est explicitement acté (même si c'est "aucun pour l'instant",
comme recommandé ci-dessus) et que la dérive `get_user` a été portée à la
connaissance de l'équipe backend.
