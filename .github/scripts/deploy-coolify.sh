#!/usr/bin/env bash
# Coolify'da deploy qilish va sayt aynan shu commit versiyasini qaytarguncha kutish.
#
# Webhook qabul qilingani deploy muvaffaqiyatli degani emas: Coolify image'ni tortolmasa
# (masalan, serverdan ghcr.io ga TLS timeout), eski konteyner ishlashda davom etadi va 200 qaytaradi.
# Shuning uchun /api/version tekshiriladi; RETRY_AT urinishda ham yangi versiya bo'lmasa, deploy
# bir marta qayta chaqiriladi.
#
# Muhit: COOLIFY_WEBHOOK, COOLIFY_TOKEN, SITE_URL, GITHUB_SHA.
# Sinov uchun: VERIFY_ATTEMPTS (36), RETRY_AT (15), VERIFY_SLEEP (10 s).
set -euo pipefail

if [ -z "${COOLIFY_WEBHOOK:-}" ] || [ -z "${COOLIFY_TOKEN:-}" ]; then
  echo "COOLIFY_WEBHOOK yoki COOLIFY_TOKEN yo'q — Coolify'da qo'lda Redeploy qiling."
  exit 0
fi

attempts=${VERIFY_ATTEMPTS:-36}
retry_at=${RETRY_AT:-15}
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

for i in $(seq 1 "$attempts"); do
  v=$(curl -fsS --max-time 10 "$SITE_URL/api/version" 2>/dev/null | jq -r '.version' 2>/dev/null || true)
  # Diqqat: "${v:-...}" ichida apostrof ishlatmang — bash uni ochiq qo'shtirnoq deb o'qiydi.
  echo "urinish $i: ${v:-javob kelmadi}"
  if [ "$v" = "$GITHUB_SHA" ]; then
    echo "Yangi versiya ishlayapti: $SITE_URL"
    exit 0
  fi
  if [ "$i" -eq "$retry_at" ]; then
    echo "::warning::Yangi versiya hali ko'rinmadi — Coolify deploy qayta chaqirilmoqda (ghcr.io bilan aloqa uzilgan bo'lishi mumkin)"
    deploy || echo "::warning::Qayta chaqiruv ham muvaffaqiyatsiz"
  fi
  sleep "$pause"
done

echo "::error::Yangi versiya ($GITHUB_SHA) ishga tushmadi — Coolify Deployment Logs'ni tekshiring"
exit 1
