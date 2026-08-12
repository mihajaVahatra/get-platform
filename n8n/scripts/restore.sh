#!/usr/bin/env bash
set -euo pipefail

# Restaure une sauvegarde produite par n8n/scripts/backup.sh (dump Postgres
# + volume de configuration n8n). Voir docs/n8n/05-sauvegarde-et-release.md
# pour le contexte complet.
#
# Usage : n8n/scripts/restore.sh <n8n-db-XXXXXXXX-XXXXXX.dump> <n8n-config-XXXXXXXX-XXXXXX.tar.gz>
#
# ATTENTION : écrase le contenu actuel de la base "n8n" et du volume de
# configuration — destructif, à n'utiliser que pour reconstruire une
# instance (perte du poste actuel, migration...), jamais sur une instance
# en production sans confirmation explicite.

if [ $# -ne 2 ]; then
  echo "Usage : $0 <dump-postgres.dump> <config.tar.gz>" >&2
  exit 1
fi

DB_DUMP="$1"
CONFIG_ARCHIVE="$2"

if [ ! -f "$DB_DUMP" ]; then
  echo "Erreur : dump introuvable : $DB_DUMP" >&2
  exit 1
fi
if [ ! -f "$CONFIG_ARCHIVE" ]; then
  echo "Erreur : archive de configuration introuvable : $CONFIG_ARCHIVE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_N8N_FILE="$ROOT_DIR/.env.n8n"
if [ ! -f "$ENV_N8N_FILE" ]; then
  echo "Erreur : $ENV_N8N_FILE introuvable (voir .env.n8n.example à la racine du dépôt)." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_N8N_FILE"
if [ -z "${N8N_DB_PASSWORD:-}" ]; then
  echo "Erreur : N8N_DB_PASSWORD non défini dans $ENV_N8N_FILE." >&2
  exit 1
fi

read -r -p "Ceci va écraser la base 'n8n' et la configuration actuelles. Continuer ? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Annulé."
  exit 1
fi

echo "→ Arrêt de n8n (la configuration ne doit pas être modifiée pendant la restauration)..."
docker stop get-n8n >/dev/null

echo "→ Restauration de la base Postgres 'n8n'..."
docker exec -e PGPASSWORD="$N8N_DB_PASSWORD" get-db \
  psql -U n8n_service -d n8n -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
docker exec -i -e PGPASSWORD="$N8N_DB_PASSWORD" get-db \
  pg_restore -U n8n_service -d n8n --no-owner < "$DB_DUMP"

N8N_CONFIG_VOLUME="$(docker inspect get-n8n \
  --format '{{ range .Mounts }}{{ if eq .Destination "/home/node/.n8n" }}{{ .Name }}{{ end }}{{ end }}')"
if [ -z "$N8N_CONFIG_VOLUME" ]; then
  echo "Erreur : impossible de résoudre le volume monté sur /home/node/.n8n du conteneur get-n8n." >&2
  exit 1
fi

echo "→ Restauration du volume de configuration n8n ($N8N_CONFIG_VOLUME)..."
docker run --rm \
  -v "$N8N_CONFIG_VOLUME":/data \
  -v "$(cd "$(dirname "$CONFIG_ARCHIVE")" && pwd)":/backup:ro \
  alpine sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar xzf /backup/$(basename "$CONFIG_ARCHIVE") -C /data"

echo "→ Redémarrage de n8n..."
docker start get-n8n >/dev/null

echo "✓ Restauration terminée. Vérifier l'accès à l'éditeur n8n (http://localhost:5678) et qu'un workflow s'exécute correctement."
