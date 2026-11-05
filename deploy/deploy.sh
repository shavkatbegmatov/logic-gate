#!/usr/bin/env bash
# Kompyuterdan (Git Bash, Linux yoki macOS) serverga joylash.
#
#   bash deploy/deploy.sh root@SERVER_IP                            — yangilash
#   bash deploy/deploy.sh root@SERVER_IP --setup                    — birinchi marta, IP orqali HTTP
#   bash deploy/deploy.sh root@SERVER_IP --setup game.uz you@mail.uz — birinchi marta, domen va HTTPS
#
# SSH kalit orqali kirish tavsiya etiladi. Foydalanuvchi root bo'lmasa, unga sudo huquqi kerak.
set -euo pipefail

TARGET="${1:?foydalanish: bash deploy/deploy.sh user@host [--setup [domen] [email]]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REL="$ROOT/dist/release"
SSH=(ssh -o ServerAliveInterval=15)

bash "$ROOT/scripts/build.sh"

echo "==> Serverga yuklash: $TARGET"
tar -C "$REL" -czf - . | "${SSH[@]}" "$TARGET" \
  'rm -rf /tmp/logicgate-release && mkdir -p /tmp/logicgate-release && tar -xzf - -C /tmp/logicgate-release'

if [ "${2:-}" = "--setup" ]; then
  "${SSH[@]}" -t "$TARGET" "sudo bash /tmp/logicgate-release/deploy/setup.sh '${3:-}' '${4:-}'"
fi

"${SSH[@]}" -t "$TARGET" 'sudo bash /tmp/logicgate-release/deploy/install.sh && rm -rf /tmp/logicgate-release'
echo "==> Tayyor."
