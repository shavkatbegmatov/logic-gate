#!/usr/bin/env bash
# Toza Ubuntu (22.04 / 24.04) serverni Logic Gate uchun tayyorlaydi. Qayta ishga tushirish xavfsiz.
#
#   sudo bash setup.sh                     — IP orqali HTTP
#   sudo bash setup.sh game.uz you@mail.uz — domen bilan, Let's Encrypt HTTPS
#
# Muhit o'zgaruvchilari: SKIP_UFW=1 — firewall'ga tegmaslik, SKIP_SWAP=1 — swap yaratmaslik.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "root sifatida ishga tushiring: sudo bash $0 $*" >&2
  exit 1
fi

echo "==> Paketlar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx ufw curl
if [ -n "$DOMAIN" ]; then
  apt-get install -y -q certbot python3-certbot-nginx
fi

if [ "${SKIP_SWAP:-0}" != 1 ] && [ -z "$(swapon --show)" ] && [ ! -f /swapfile ]; then
  echo "==> 1 GB swap (kichik RAM'da apt va build paytida foydali)"
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-logicgate.conf
  sysctl -q -p /etc/sysctl.d/99-logicgate.conf
fi

echo "==> Foydalanuvchi va papkalar"
if ! id logicgate >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/logicgate --shell /usr/sbin/nologin logicgate
fi
install -d -m 755 /opt/logicgate /opt/logicgate/bin /opt/logicgate/web
install -d -o logicgate -g logicgate -m 750 /var/lib/logicgate /var/backups/logicgate
if [ ! -f /etc/logicgate.env ]; then
  install -m 640 -o root -g logicgate "$HERE/.env.example" /etc/logicgate.env
fi

echo "==> systemd xizmati"
install -m 644 "$HERE/logicgate.service" /etc/systemd/system/logicgate.service
systemctl daemon-reload
systemctl enable logicgate >/dev/null
if [ -x /opt/logicgate/bin/logicgate ]; then
  systemctl restart logicgate
fi

echo "==> Kunlik zaxira nusxa (03:30)"
install -m 755 "$HERE/backup.sh" /opt/logicgate/backup.sh
cat > /etc/cron.d/logicgate-backup <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * logicgate /opt/logicgate/backup.sh 2>&1 | logger -t logicgate-backup
CRON

echo "==> Nginx"
sed "s/__SERVER_NAME__/${DOMAIN:-_}/" "$HERE/nginx.conf" > /etc/nginx/sites-available/logicgate
ln -sf /etc/nginx/sites-available/logicgate /etc/nginx/sites-enabled/logicgate
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ "${SKIP_UFW:-0}" != 1 ]; then
  echo "==> Firewall (SSH, 80, 443)"
  # SSH porti nostandart bo'lsa ham o'zingizni bloklab qo'ymaslik uchun sshd sozlamasidan olinadi.
  ports="$(sshd -T 2>/dev/null | awk '/^port /{print $2}')"
  for p in ${ports:-22}; do ufw allow "$p/tcp" >/dev/null; done
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
fi

if [ -n "$DOMAIN" ]; then
  echo "==> HTTPS: $DOMAIN"
  if [ -n "$EMAIL" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect -m "$EMAIL"
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email
  fi
fi

echo "==> Server tayyor."
