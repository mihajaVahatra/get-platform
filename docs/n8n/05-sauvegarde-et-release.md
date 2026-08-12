# Phase 5 — Rendre n8n reproductible et sauvegardé

- **Date :** 2026-08-11
- **Fait suite à :** [04-decisions-actees.md](04-decisions-actees.md)

## Constat de départ

L'instance n8n locale (conteneur `get-n8n`, voir
[02-preparation-infrastructure.md](02-preparation-infrastructure.md)) portait
deux risques non couverts jusqu'ici :

1. **Reconstruction** : les workflows sont versionnés en JSON
   (`n8n/workflows/*.json`), donc reproductibles par réimport — mais rien ne
   documentait la procédure, ni comment retrouver la clé de chiffrement des
   Credentials (`N8N_ENCRYPTION_KEY`, dans `.env.n8n`, jamais committée) en
   cas de perte du poste.
2. **Sauvegarde** : la base Postgres dédiée (rôle `n8n_service`, base `n8n`
   dans le conteneur `get-db` partagé avec le backend) et le volume de
   configuration n8n (`/home/node/.n8n` — historique d'exécutions,
   Credentials chiffrées, `staticData`) n'avaient aucune sauvegarde. Une
   perte du volume Docker aurait fait perdre l'historique d'exécution et
   obligé à recréer les Credentials à la main.

Vérification faite au passage : les 3 workflows du MVP sont **actifs à
raison** (`"active": true` dans les 3 fichiers JSON) — voir
[04-decisions-actees.md](04-decisions-actees.md), qui documente pourquoi
chacun l'est (cron d'idempotence posé pour la relance, destinataires
`ADMIN_GET` posés pour le rapport hebdomadaire, webhook authentifié pour la
bienvenue). Aucun des 3 n'est un déclencheur laissé actif "par erreur" ; il
n'y a pas de 4e workflow superflu à désactiver.

## Ce qui a été ajouté

### `n8n/scripts/backup.sh`

Sauvegarde en un appel :
- un `pg_dump --format=custom` de la base `n8n` (rôle `n8n_service`, via
  `docker exec` sur `get-db` — pas d'accès direct au port Postgres depuis
  l'hôte nécessaire) ;
- une archive `tar.gz` du volume Docker monté sur `/home/node/.n8n` du
  conteneur `get-n8n` (Credentials chiffrées, historique d'exécutions,
  `staticData`), produite par un conteneur `alpine` jetable montant le
  volume en lecture seule.

Le nom du volume n'est jamais supposé fixe (il est préfixé par le nom du
projet Compose, ex. `get-poc_n8n_config`) : résolu dynamiquement via
`docker inspect get-n8n`.

```bash
n8n/scripts/backup.sh [dossier-de-sortie]   # défaut : n8n/backups/
```

Sortie : `n8n-db-<horodatage>.dump` + `n8n-config-<horodatage>.tar.gz`.
`n8n/backups/` est ignoré par git (`n8n/backups/.gitignore`) — ces fichiers
contiennent des Credentials déchiffrables avec `N8N_ENCRYPTION_KEY`, jamais
committés.

**Testé de bout en bout** contre les conteneurs `get-db`/`get-n8n` réellement
démarrés en local : dump Postgres valide (420 Ko, vérifié via
`file` → `PostgreSQL custom database dump`) et archive de configuration
valide (vérifiée via `tar tzf`, contient bien `config`, `nodes/`,
`n8nEventLog*.log`, etc.).

Note plateforme : sur un hôte SELinux enforcing (ex. Fedora), le montage
bind du dossier de sortie dans le conteneur `alpine` nécessite le label
`:z` (`-v "$OUT_DIR":/backup:z`) — sans lui, `docker run` échoue avec
`Permission denied` en écriture. Sans effet sur un hôte sans SELinux.

### `n8n/scripts/restore.sh`

Contrepartie destructive, à usage explicite (reconstruction après perte du
poste, migration de machine) :

```bash
n8n/scripts/restore.sh <n8n-db-XXXXXXXX-XXXXXX.dump> <n8n-config-XXXXXXXX-XXXXXX.tar.gz>
```

- Demande une confirmation interactive avant toute action destructive.
- Arrête `get-n8n` (la configuration ne doit pas être modifiée pendant la
  restauration).
- `DROP SCHEMA public CASCADE` puis `CREATE SCHEMA public` sur la base `n8n`,
  suivi d'un `pg_restore --no-owner` du dump fourni.
- Vide puis restaure le volume de configuration (`tar xzf` dans un
  conteneur `alpine` jetable).
- Redémarre `get-n8n`.

**Non exécuté contre l'instance réelle dans cette session** (opération
destructive bloquée par les garde-fous automatiques de l'environnement
d'exécution utilisé pour ce chantier) : relu ligne à ligne à la place,
logique croisée avec `backup.sh` (même résolution de volume, mêmes noms de
rôle/base). Reste à valider manuellement au moins une fois avant de s'y fier
en situation réelle — voir section suivante.

## Procédure de reconstruction complète (poste perdu ou nouvelle machine)

1. Cloner le dépôt, `cp .env.n8n.example .env.n8n` puis renseigner
   `N8N_DB_PASSWORD` (et `N8N_ENCRYPTION_KEY` si une sauvegarde de
   configuration est disponible — voir point 4).
2. Démarrer la stack principale (`docker-compose.yml`, fournit `get-db`)
   puis n8n (`docker-compose.n8n.yml`, fournit `get-n8n`).
3. **Sans sauvegarde de configuration disponible** (perte totale, ou
   première installation) : réimporter les workflows versionnés depuis
   `n8n/workflows/*.json` via l'éditeur n8n (`http://localhost:5678` →
   Import from File) ou l'API REST (`POST /rest/workflows/import`). Les
   Credentials (`httpHeaderAuth` pour `INTEGRATION_API_KEY` si utilisé, voir
   [04-decisions-actees.md](04-decisions-actees.md)) doivent être recréées à
   la main — elles ne sont pas versionnées (secrets).
4. **Avec une sauvegarde disponible** (`n8n/scripts/backup.sh` exécuté
   avant l'incident) : `N8N_ENCRYPTION_KEY` dans le nouveau `.env.n8n`
   **doit être identique** à celle utilisée au moment de la sauvegarde,
   sinon les Credentials restaurées restent chiffrées et illisibles par la
   nouvelle instance — c'est le seul secret qui n'est récupérable par
   aucun autre moyen que d'avoir été conservé à part (gestionnaire de
   secrets de l'équipe, jamais dans le dépôt). Puis
   `n8n/scripts/restore.sh <dump> <archive>`.
5. Dans les deux cas, vérifier après coup : accès à l'éditeur n8n, les 3
   workflows du MVP présents et `active: true`, une exécution manuelle de
   chacun réussit (voir les preuves de bout en bout dans
   [03-connecteurs-get.md](03-connecteurs-get.md) et
   [04-decisions-actees.md](04-decisions-actees.md) pour la marche à suivre).

## Fréquence de sauvegarde recommandée

Tant que l'instance reste locale et à usage de développement/essai (aucun
hébergement persistant décidé — point 4 de
[04-decisions-actees.md](04-decisions-actees.md)), il n'y a pas
d'automatisation (cron machine, CI) mise en place pour `backup.sh` : l'appeler
manuellement avant toute opération risquée sur la machine (mise à jour
système, réinstallation) suffit. À revoir si l'hébergement persistant est
décidé : la sauvegarde régulière devient alors un prérequis, pas une option.

## Limite connue

`restore.sh` n'a pas encore été exécuté contre une instance réelle dans le
cadre de ce chantier (voir ci-dessus). À valider manuellement dès que
possible, idéalement contre une instance de test dédiée plutôt que
l'instance de développement courante, pour confirmer le comportement de bout
en bout sans risque sur les données locales en cours d'usage.
