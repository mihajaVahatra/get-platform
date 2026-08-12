#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde la base Postgres dédiée à n8n (rôle n8n_service, base "n8n"
# dans le conteneur get-db partagé avec le backend — voir
# docs/n8n/02-preparation-infrastructure.md) et la configuration n8n (clé de
# chiffrement des Credentials, volume monté sur /home/node/.n8n) — voir
# docs/n8n/05-sauvegarde-et-release.md pour la procédure de restauration
# complète.
#
# Usage : n8n/scripts/backup.sh [dossier-de-sortie]
#   (par défaut : n8n/backups/, jamais committé — voir n8n/backups/.gitignore)
#
# Prérequis :
#   - Stack principale (docker-compose.yml) et n8n (docker-compose.n8n.yml)
#     démarrées (au moins le conteneur get-db et get-n8n existants).
#   - .env.n8n présent à la racine du dépôt (N8N_DB_PASSWORD).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/n8n/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

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

if ! docker inspect get-db >/dev/null 2>&1; then
  echo "Erreur : conteneur 'get-db' introuvable — démarrer d'abord docker-compose.yml (stack principale)." >&2
  exit 1
fi
if ! docker inspect get-n8n >/dev/null 2>&1; then
  echo "Erreur : conteneur 'get-n8n' introuvable — démarrer d'abord docker-compose.n8n.yml." >&2
  exit 1
fi

# Le nom réel du volume Docker est préfixé par le nom du projet Compose
# (ex. get-poc_n8n_config), qui dépend du nom du dossier ou d'un éventuel
# `-p`/COMPOSE_PROJECT_NAME — jamais supposé fixe, toujours résolu depuis le
# conteneur qui le monte réellement.
N8N_CONFIG_VOLUME="$(docker inspect get-n8n \
  --format '{{ range .Mounts }}{{ if eq .Destination "/home/node/.n8n" }}{{ .Name }}{{ end }}{{ end }}')"
if [ -z "$N8N_CONFIG_VOLUME" ]; then
  echo "Erreur : impossible de résoudre le volume monté sur /home/node/.n8n du conteneur get-n8n." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "→ Sauvegarde de la base Postgres 'n8n' (rôle n8n_service)..."
docker exec -e PGPASSWORD="$N8N_DB_PASSWORD" get-db \
  pg_dump -U n8n_service -d n8n --format=custom \
  > "$OUT_DIR/n8n-db-$TIMESTAMP.dump"

echo "→ Sauvegarde du volume de configuration n8n ($N8N_CONFIG_VOLUME)..."
# `:z` : relabellisation SELinux du montage bind pour un accès partagé
# (nécessaire sur un hôte SELinux enforcing, ex. Fedora — sans ce label,
# `docker run` refuse l'écriture dans $OUT_DIR avec "Permission denied" ;
# sans effet sur un hôte sans SELinux).
docker run --rm \
  -v "$N8N_CONFIG_VOLUME":/data:ro \
  -v "$OUT_DIR":/backup:z \
  alpine tar czf "/backup/n8n-config-$TIMESTAMP.tar.gz" -C /data .

echo "✓ Sauvegarde terminée :"
echo "  - $OUT_DIR/n8n-db-$TIMESTAMP.dump"
echo "  - $OUT_DIR/n8n-config-$TIMESTAMP.tar.gz"
