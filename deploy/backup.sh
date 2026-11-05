#!/usr/bin/env bash
# SQLite bazaning kunlik nusxasi. cron orqali logicgate foydalanuvchisi nomidan ishlaydi.
# Eski nusxalar KEEP_DAYS kundan keyin o'chiriladi.
set -euo pipefail

set -a
# shellcheck disable=SC1091
. /etc/logicgate.env
set +a

DIR=/var/backups/logicgate
KEEP_DAYS="${KEEP_DAYS:-7}"
FILE="$DIR/logicgate-$(date +%F).db"

rm -f "$FILE" "$FILE.gz"
/opt/logicgate/bin/logicgate backup "$FILE"
gzip -f "$FILE"
find "$DIR" -name 'logicgate-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "zaxira nusxa: $FILE.gz ($(du -h "$FILE.gz" | cut -f1))"
