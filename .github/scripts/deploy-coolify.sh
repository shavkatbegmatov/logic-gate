#!/usr/bin/env bash
# Coolify'da deploy qilish va sayt aynan shu commit versiyasini qaytarguncha kutish.
#
# Webhook qabul qilingani deploy muvaffaqiyatli degani emas: Coolify image'ni tortolmasa
# (serverdan ghcr.io ga ulanishlarning bir qismi timeout bo'ladi), eski konteyner ishlashda
# davom etadi va 200 qaytaradi. Shuning uchun /api/version tekshiriladi va yangi versiya
# ko'rinmaguncha deploy har RETRY_EVERY urinishda qayta chaqiriladi (jami MAX_DEPLOYS marta).
# Muvaffaqiyatsiz urinish arzon: Coolify ~16 soniyada voz kechadi va eski konteynerni qoldiradi.
#
# Muhit: COOLIFY_WEBHOOK, COOLIFY_TOKEN, SITE_URL, GITHUB_SHA.
# Sinov uchun: VERIFY_ATTEMPTS (40), RETRY_EVERY (8), MAX_DEPLOYS (4), VERIFY_SLEEP (10 s).
set -euo pipefail

if [ -z "${COOLIFY_WEBHOOK:-}" ] || [ -z "${COOLIFY_TOKEN:-}" ]; then
  echo "COOLIFY_WEBHOOK yoki COOLIFY_TOKEN yo'q — Coolify'da qo'lda Redeploy qiling."
  exit 0
fi

attempts=${VERIFY_ATTEMPTS:-40}
retry_every=${RETRY_EVERY:-8}
max_deploys=${MAX_DEPLOYS:-4}
pause=${VERIFY_SLEEP:-10}

# Coolify 4.6: /api/v1/deploy faqat POST qabul qiladi (GET → 405).
deploy() {
  curl -sS --fail-with-body --retry 2 --max-time 30 -X POST \
    -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_WEBHOOK"
  echo
}

if ! deploy; then
  echo "Coolify chaqiruvi muvaffaqiyatsiz — ${pause} soniyadan keyin yana urinaman"
  sleep "$pause"
  deploy
fi
deploys=1

for i in $(seq 1 "$attempts"); do
  v=$(curl -fsS --max-time 10 "$SITE_URL/api/version" 2>/dev/null | jq -r '.version' 2>/dev/null || true)
  # Diqqat: "${v:-...}" ichida apostrof ishlatmang — bash uni ochiq qo'shtirnoq deb o'qiydi.
  echo "urinish $i: ${v:-javob kelmadi}"
  if [ "$v" = "$GITHUB_SHA" ]; then
    echo "Yangi versiya ishlayapti: $SITE_URL (deploy chaqiruvlari: $deploys)"
    exit 0
  fi
  if [ $((i % retry_every)) -eq 0 ] && [ "$deploys" -lt "$max_deploys" ]; then
    deploys=$((deploys + 1))
    echo "::warning::Yangi versiya hali ko'rinmadi — Coolify deploy qayta chaqirilmoqda ($deploys/$max_deploys; ghcr.io bilan aloqa uzilgan bo'lishi mumkin)"
    deploy || echo "::warning::Qayta chaqiruv muvaffaqiyatsiz"
  fi
  sleep "$pause"
done

echo "::error::Yangi versiya ($GITHUB_SHA) ishga tushmadi ($deploys marta deploy qilindi) — Coolify Deployment Logs'ni tekshiring"
exit 1
