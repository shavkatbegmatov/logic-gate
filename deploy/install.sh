#!/usr/bin/env bash
# Serverda ishlaydi: yuklangan release'ni /opt/logicgate ga o'rnatadi va xizmatni qayta ishga tushiradi.
#   sudo bash /tmp/logicgate-release/deploy/install.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/opt/logicgate

if [ "$(id -u)" -ne 0 ]; then
  echo "root sifatida ishga tushiring" >&2
  exit 1
fi
if [ ! -f /etc/systemd/system/logicgate.service ]; then
  echo "Server hali sozlanmagan: avval setup.sh ni ishga tushiring" >&2
  exit 1
fi

echo "==> Fayllarni o'rnatish"
install -m 755 "$SRC/bin/logicgate" "$DEST/bin/logicgate.new"
mv -f "$DEST/bin/logicgate.new" "$DEST/bin/logicgate"

rm -rf "$DEST/web.new" "$DEST/web.old"
cp -r "$SRC/web" "$DEST/web.new"
find "$DEST/web.new" -type d -exec chmod 755 {} + && find "$DEST/web.new" -type f -exec chmod 644 {} +
if [ -d "$DEST/web" ]; then mv "$DEST/web" "$DEST/web.old"; fi
mv "$DEST/web.new" "$DEST/web"
rm -rf "$DEST/web.old"

install -m 755 "$SRC/deploy/backup.sh" "$DEST/backup.sh"

echo "==> Xizmatni qayta ishga tushirish"
systemctl restart logicgate
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    echo "OK — versiya: $("$DEST/bin/logicgate" version)"
    systemctl --no-pager --lines=0 status logicgate | grep -E 'Active|Memory' || true
    exit 0
  fi
  sleep 1
done
echo "Server javob bermayapti. Loglar: journalctl -u logicgate -n 50" >&2
exit 1
