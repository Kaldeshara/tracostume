#!/bin/sh
# Builds TRACostume from this checkout and (re)starts it on the VPS.
#   deploy/deploy.sh               build, migrate, restart
#   deploy/deploy.sh tools <cmd>   run a one-off command against production (e.g. the import)
#   deploy/deploy.sh backup        dump the database to deploy/backups/
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "deploy/.env is missing: copy deploy/.env.example and fill it in." >&2; exit 1; }
case "${1:-deploy}" in
  deploy)
    docker compose up -d --build
    docker image prune -f >/dev/null
    ;;
  tools)
    shift
    docker compose run --rm tools "$@"
    ;;
  backup)
    mkdir -p backups
    file="backups/tracostume-$(date +%Y%m%d-%H%M%S).sql.gz"
    docker compose exec -T db pg_dump -U tracostume tracostume | gzip > "$file"
    echo "$file"
    ;;
  *)
    echo "usage: $0 [deploy | tools <cmd> | backup]" >&2
    exit 2
    ;;
esac
docker compose ps
