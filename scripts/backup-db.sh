#!/usr/bin/env bash
# Nightly Kifaah database backup.
#
# Makes a compressed pg_dump of the database from the running postgres
# container, plus a copy of the uploaded photos, and keeps the last
# $KEEP_DAYS days. Run from cron on the VPS, for example (2:30 am IST daily):
#
#   30 21 * * * /opt/kifaah-matrimony/scripts/backup-db.sh >> /var/log/kifaah-backup.log 2>&1
#
# Restore test (do this once a month into a throwaway database):
#   docker compose exec -T postgres createdb -U postgres kifaah_restore_test
#   docker compose exec -T postgres pg_restore -U postgres -d kifaah_restore_test < /root/backups/<file>.dump
#
# Off-server copy: set BACKUP_REMOTE to an rclone remote (e.g. "gdrive:kifaah-backups")
# once rclone is configured. Until then backups only live on this VPS.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/kifaah-matrimony}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date +%Y-%m-%d-%H%M)"
db_file="$BACKUP_DIR/kifaah-$stamp.dump"
photos_file="$BACKUP_DIR/kifaah-photos-$stamp.tar.gz"

# Database: custom format is compressed and restorable with pg_restore.
docker compose exec -T postgres sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" -Fc "${POSTGRES_DB:-kifaah}"' > "$db_file.part"
mv "$db_file.part" "$db_file"
chmod 600 "$db_file"

# Photos stored on local disk (skipped quietly if the folder is empty).
backend_container="$(docker compose ps -q backend)"
if [ -n "$backend_container" ]; then
  docker exec "$backend_container" sh -c 'cd /app && tar -czf - uploads 2>/dev/null' > "$photos_file" || rm -f "$photos_file"
  [ -f "$photos_file" ] && chmod 600 "$photos_file"
fi

# A dump that is suspiciously small usually means something went wrong.
size="$(stat -c %s "$db_file")"
if [ "$size" -lt 1024 ]; then
  echo "$(date -Is) WARNING: backup $db_file is only $size bytes" >&2
fi

if [ -n "$BACKUP_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$db_file" "$BACKUP_REMOTE/"
  [ -f "$photos_file" ] && rclone copy "$photos_file" "$BACKUP_REMOTE/"
fi

# Keep only the last $KEEP_DAYS days.
find "$BACKUP_DIR" -maxdepth 1 -name 'kifaah-*' -type f -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: $db_file ($size bytes)"
