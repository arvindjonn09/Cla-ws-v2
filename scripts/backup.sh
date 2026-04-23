#!/usr/bin/env bash
set -euo pipefail

# Financial Command Center — daily PostgreSQL backup
# Usage: ./scripts/backup.sh
# Recommended: add to cron — 0 2 * * * /home/shiva/kosa/scripts/backup.sh

BACKUP_DIR="/var/backups/fcc"
DB_NAME="${FCC_DB_NAME:-fcc_db}"
DB_USER="${FCC_DB_USER:-fcc_user}"
KEEP_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_DIR/fcc_${TIMESTAMP}.sql.gz"

echo "Backup written: $BACKUP_DIR/fcc_${TIMESTAMP}.sql.gz"

# Remove backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "fcc_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "Old backups pruned (kept last ${KEEP_DAYS} days)"
