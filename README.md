# Logic Gate

Mantiqiy elementlardan (NOT, AND, OR, XOR, NAND, NOR, XNOR) sxema yig'ib, boshqotirmalarni yechadigan brauzer o'yini.

- 30 ta daraja, 5 ta bo'lim: asoslardan 2 bitli ko'paytirgichgacha.
- Jonli simulyatsiya: simlar 1/0 holatiga qarab yonadi, haqiqat jadvali har bir o'zgarishda yangilanadi.
- Element sonini tejagan o'yinchiga 3 ★. Keyingi bo'limlar yulduzlar bilan ochiladi.
- Ro'yxatdan o'tmasdan o'ynash mumkin. Taxallus kiritilsa, natijalar reytingga qo'shiladi, progress esa tiklash kodi orqali boshqa qurilmaga o'tkaziladi.
- Qum quti: istalgan sxemani erkin yig'ish.
- Telefon va kompyuterda ishlaydi: sichqoncha, sensorli ekran, pinch-zoom, klaviatura (Delete, Ctrl+Z, Ctrl+Y, Ctrl+Enter). Tik telefonda sxema yuqoridan pastga joylashadi (kirishlar tepada, chiqishlar pastda) — elementlar kattaroq ko'rinadi.

## Stek

| Qatlam | Tanlov | Nega |
|---|---|---|
| Backend | Go + `net/http` + SQLite (`modernc.org/sqlite`, CGO'siz) | Bitta binar fayl, serverga runtime kerak emas, RAM ~15–25 MB |
| Frontend | Vite + TypeScript + Preact + `@preact/signals`, o'yin maydoni SVG | JS gzip'da ~28 KB, hammasi statik fayllar |
| Server | Nginx + certbot, systemd | Statik fayllar oldindan gzip qilingan, `/api` Go'ga proksi qilinadi |

O'yin mantig'i to'liq brauzerda ishlaydi. Server faqat o'yinchi, progress, reyting va yechimni qayta tekshirish bilan shug'ullanadi.

## Resurs hisoboti

O'lchov WSL2 (Ubuntu) da, production Linux binari bilan, 50 o'yinchi × 30 daraja yechimi + 1000 ta reyting/statistika so'rovi (jami 2600 so'rov) yuborib qilindi. Skript: Python, `/proc/<pid>/status` va `/proc/<pid>/stat` dan o'qiydi.

| Ko'rsatkich | Qiymat |
|---|---|
| Backend RAM, ishsiz | 15,2 MB |
| Backend RAM, yukdan keyin | 23,1 MB |
| Backend RAM, eng yuqori (VmHWM) | 24,1 MB |
| CPU bitta so'rovga | ~0,38 ms |
| Bitta mijozdan o'tkazuvchanlik | ~2000 so'rov/s |
| Linux binar hajmi | 11 MB |
| Frontend JS (gzip) | 28,3 KB |
| Frontend CSS (gzip) | 4,3 KB |
| Butun frontend (gzip) | 32,3 KB |

Nginx sarfi o'lchanmagan: odatda 1 ta worker bilan 5–10 MB. systemd unit'da `MemoryHigh=64M`, `MemoryMax=96M`, `.env` da `GOMEMLIMIT=40MiB` o'rnatilgan.

## Loyiha tuzilmasi

```
levels/          darajalar: source.mjs (manba) → build.mjs → levels.json (+ solutions.json testlar uchun)
                 kunlik boshqotirma: daily.mjs → daily.json (+ daily-solutions.json testlar uchun)
server/          Go backend
  cmd/logicgate/   main.go: server, `backup`, `version` buyruqlari
  internal/sim/    sxemani tekshirish (web/src/sim/sim.ts bilan bir xil qoidalar)
  internal/store/  SQLite va migratsiyalar
  internal/api/    HTTP API, rate limit, tiklash kodlari
web/             frontend (Vite + Preact)
  src/sim/         TypeScript simulyatori
  src/board/       SVG sxema muharriri
  src/screens/     ekranlar
deploy/          systemd, Nginx, setup/install/backup/deploy skriptlari, .env.example
scripts/build.sh testlar + release yig'ish (dist/release)
PLAN.md          reja
DECISIONS.md     qabul qilingan qarorlar
```

## Lokal ishga tushirish

Kerak bo'ladi: Node.js 22+, pnpm, Go 1.26+, Git Bash (Windows'da).

```bash
cd web
pnpm install
```

Ikki terminalda:

```bash
go run ./server/cmd/logicgate
```

```bash
cd web
pnpm dev
```

O'yin: http://localhost:5173 (Vite `/api` so'rovlarini 127.0.0.1:8080 ga yo'naltiradi). Ma'lumotlar bazasi `data/logicgate.db` da yaratiladi.

Production build'ni Nginx'siz sinash:

```bash
cd web
pnpm build
```

```bash
go run ./server/cmd/logicgate -static web/dist
```

So'ng http://127.0.0.1:8080 ni oching.

Testlar:

```bash
go test ./...
```

```bash
cd web
pnpm test
```

## Darajalarni tahrirlash

Darajalar `levels/source.mjs` da: har bir daraja uchun maqsad funksiyasi (`fn`), ruxsat etilgan elementlar va mos yozuvdagi yechim (`sol`). Keyin:

```bash
node levels/build.mjs
```

Build skripti har bir yechimni tekshiradi va element soni `goal` ga teng ekanini nazorat qiladi. Bosqichli maslahat uchun yechimdan faqat elementlar tarkibi va kirishlarga ulangan birinchi element olinadi (`hints`); yechimning o'zi `levels.json` ga tushmaydi. `levels.json` Go binariga `go:embed` orqali joylanadi, shuning uchun o'zgarishdan keyin serverni qayta yig'ish kerak (`deploy.sh` buni o'zi qiladi).

## Coolify orqali joylash (Docker)

**Hozirgi joylash:** http://logic-gate.170.168.6.82.sslip.io — Coolify'da `logic-gate` loyihasi (production). Yangi versiyani chiqarish: `main` ga push qilish kifoya — GitHub Actions testlarni o'tkazadi, image'ni yig'adi, Coolify'ni chaqiradi va sayt `/api/version` da yangi commit'ni qaytarguncha kutadi. Yangi versiya ko'rinmasa (serverdan ghcr.io ga ulanishlarning bir qismi uziladi va image tortilmay qoladi), Coolify har ~80 soniyada qayta chaqiriladi — jami 4 martagacha; ~7 daqiqada ham bo'lmasa, workflow xato bilan tugaydi. Mantiq: `.github/scripts/deploy-coolify.sh`.

Serverda Coolify ishlayotgan bo'lsa (80/443 portlari Traefik'da), o'yin boshqa loyihalar kabi Docker image sifatida joylanadi. **Bunday serverda `deploy/setup.sh` ni ishga tushirmang:** u Nginx o'rnatib, firewall'ni yoqadi.

1. `main` branch'ga push qilinganda GitHub Actions (`.github/workflows/docker.yml`) testlarni o'tkazadi va `ghcr.io/<owner>/logic-gate:latest` image'ini yig'adi. Kompilyatsiya serverda emas, GitHub'da bajariladi, shuning uchun server RAM'iga yuk tushmaydi.
2. Coolify'da: **Project → + New → Docker Image** → `ghcr.io/<owner>/logic-gate:latest`.
3. Sozlamalar:
   - **Ports Exposes:** `8080`;
   - **Domains:** `https://o-yin-domeningiz`;
   - **Persistent Storage:** volume, **Destination Path** `/data` (SQLite bazasi shu yerda). Busiz har bir qayta joylashda ma'lumotlar yo'qoladi;
   - **Resource Limits** (ixtiyoriy): Memory `128m`.
4. **Deploy**.

Kerakli muhit o'zgaruvchilari image ichida berilgan: `LG_ADDR=0.0.0.0:8080`, `LG_DB=/data/logicgate.db`, `LG_STATIC=/app/web`, `LG_TRUST_PROXY=private`, `GOMEMLIMIT=40MiB`. Frontend'ni Go serverning o'zi uzatadi: `.gz` fayllar, kesh va xavfsizlik sarlavhalari bilan. Konteyner salomatligi `logicgate health` buyrug'i orqali tekshiriladi.

Avtomatik yangilash uchun repozitoriy Secrets'ida `COOLIFY_WEBHOOK` (ilovaning Deploy Webhook URL manzili) va `COOLIFY_TOKEN` (Coolify API token, faqat `deploy` huquqi) bo'lishi kerak. Sayt manzili o'zgarsa, repozitoriy Variables'ida `LOGIC_GATE_URL` ni yangilang.

### Domen o'zgarganda

1. Coolify → ilova → **Domains**: yangi domen (`https://` — Let's Encrypt avtomatik).
2. `web/.env` dagi `VITE_SITE_URL` — Telegram/Open Graph havola rasmi to'liq manzil talab qiladi.
3. GitHub repozitoriy **Variables** → `LOGIC_GATE_URL` — deploy'dan keyingi tekshiruv shu manzilga boradi.

Havola rasmi `web/public/og.png` (1200×630) `web/scripts/og.html` dan olingan skrinshot.

### Zaxira nusxa (Coolify)

Server o'zi har kuni soat 03:00 da (Toshkent; `LG_BACKUP_HOUR=22` — UTC) bazaning gzip qilingan nusxasini `/data/backups/logicgate-YYYY-MM-DD.db.gz` ga yozadi (sana UTC bo'yicha), oxirgi 7 tasi saqlanadi (`LG_BACKUP_KEEP`). Ishga tushganda oxirgi 24 soatda nusxa bo'lmasa, bir daqiqadan keyin darhol oladi. Konteynerda shell yo'q, shuning uchun Coolify Scheduled Tasks emas, serverning ichki rejalashtiruvchisi ishlatiladi.

Nusxalar ro'yxati va qo'lda nusxa olish (serverda; `C` — konteyner nomi):

```bash
C=$(docker ps --filter name=nezdzxqjc5niwnbzzrl035ik --format '{{.Names}}' | head -1)
docker exec "$C" /app/logicgate backup
ls -la /var/lib/docker/volumes/nezdzxqjc5niwnbzzrl035ik-logic-gate-data/_data/backups/
```

Nusxalar bazaning o'zi bilan bir diskda turadi: ular xato deploy yoki ma'lumot buzilishidan himoya qiladi, lekin disk ishdan chiqsa — yo'q. Vaqti-vaqti bilan kompyuterga ko'chiring:

```bash
scp 'root@170.168.6.82:/var/lib/docker/volumes/nezdzxqjc5niwnbzzrl035ik-logic-gate-data/_data/backups/*.gz' .
```

Nusxadan tiklash: Coolify'da ilovani **Stop** qiling, serverda quyidagini bajaring (sanani o'zgartiring), keyin **Start**:

```bash
docker run --rm -v nezdzxqjc5niwnbzzrl035ik-logic-gate-data:/d alpine sh -c '
  gunzip -c /d/backups/logicgate-2026-11-05.db.gz > /d/logicgate.db &&
  rm -f /d/logicgate.db-wal /d/logicgate.db-shm &&
  chown 65532:65532 /d/logicgate.db'
```

### Moderatsiya

Taxalluslar serverda tekshiriladi: uzunlik (2–20), ruxsat etilgan belgilar va haqoratli so'zlar filtri (o'zbek, rus, ingliz; nuqta, raqam va kirill harflari bilan niqoblangan variantlar ham) — `server/internal/nickname`. Filtr oddiy; o'tib ketgan nomni administrator o'zgartiradi:

```bash
C=$(docker ps --filter name=nezdzxqjc5niwnbzzrl035ik --format '{{.Names}}' | head -1)
docker exec "$C" /app/logicgate players            # hamma o'yinchilar (id, taxallus, ★)
docker exec "$C" /app/logicgate players Ali        # taxallus bo'yicha qidirish
docker exec "$C" /app/logicgate rename <id> "O'yinchi 17"
```

Reyting 15 soniya ichida yangilanadi.

## VPS'ga joylash (eskiz.uz)

Bu bo'lim toza, faqat shu o'yin uchun ajratilgan Ubuntu server uchun (Nginx + systemd).

### 1. Server

eskiz.uz da Ubuntu 24.04 (yoki 22.04) VPS oling. 1 vCPU / 1 GB RAM yetarli. Server IP manzilini va root parolini oling.

### 2. SSH kalit

Git Bash'da (kalit hali bo'lmasa):

```bash
ssh-keygen -t ed25519
```

Kalitni serverga qo'shing (root parolini bir marta so'raydi):

```bash
cat ~/.ssh/id_ed25519.pub | ssh root@SERVER_IP 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys'
```

### 3. Domen (ixtiyoriy)

Domen bo'lsa, uning DNS sozlamasida `A` yozuvini server IP manziliga yo'naltiring va bir necha daqiqa kuting.

### 4. Birinchi joylash

Loyiha papkasida, Git Bash'da. Domensiz (IP orqali HTTP):

```bash
bash deploy/deploy.sh root@SERVER_IP --setup
```

Domen bilan (Let's Encrypt HTTPS; `--agree-tos` bilan Let's Encrypt shartlariga rozilik bildiriladi):

```bash
bash deploy/deploy.sh root@SERVER_IP --setup game.uz siz@pochta.uz
```

Skript nima qiladi:

1. Testlarni o'tkazadi, frontend'ni va Linux uchun Go binarini yig'adi (`dist/release`).
2. Release'ni SSH orqali serverning `/tmp` papkasiga yuklaydi.
3. `deploy/setup.sh`:
   - Nginx, ufw va kerak bo'lsa certbot'ni o'rnatadi;
   - swap bo'lmasa, 1 GB swap yaratadi;
   - `logicgate` tizim foydalanuvchisini va papkalarni yaratadi;
   - systemd xizmatini, kunlik zaxira nusxa uchun cron'ni va Nginx saytini sozlaydi;
   - firewall'da faqat SSH, 80 va 443 portlarini ochadi.
4. `deploy/install.sh` binar va statik fayllarni `/opt/logicgate` ga o'rnatadi, xizmatni qayta ishga tushiradi va `/healthz` orqali tekshiradi.

Brauzerda `http://SERVER_IP` (yoki `https://game.uz`) ni oching.

### 5. Yangilash

Koddagi o'zgarishlardan keyin:

```bash
bash deploy/deploy.sh root@SERVER_IP
```

### Domenni keyinroq qo'shish

```bash
bash deploy/deploy.sh root@SERVER_IP --setup game.uz siz@pochta.uz
```

### Serverda tekshirish

```bash
ssh root@SERVER_IP systemctl status logicgate
```

```bash
ssh root@SERVER_IP journalctl -u logicgate -n 100
```

Sozlamalar `/etc/logicgate.env` faylida (namuna: `deploy/.env.example`). O'zgartirgandan keyin `systemctl restart logicgate`.

| Yo'l | Nima |
|---|---|
| `/opt/logicgate/bin/logicgate` | server binari |
| `/opt/logicgate/web/` | statik fayllar |
| `/var/lib/logicgate/logicgate.db` | ma'lumotlar bazasi |
| `/var/backups/logicgate/` | kunlik zaxira nusxalar |
| `/etc/logicgate.env` | sozlamalar |
| `/etc/nginx/sites-available/logicgate` | Nginx sayti |

## Zaxira nusxa va tiklash

Har kuni soat 03:30 da bazaning nusxasi `/var/backups/logicgate/logicgate-YYYY-MM-DD.db.gz` ga yoziladi, 7 kundan eskilari o'chiriladi. Nusxa server ishlab turganda ham izchil olinadi (`VACUUM INTO`).

Qo'lda nusxa olish:

```bash
ssh root@SERVER_IP 'sudo -u logicgate /opt/logicgate/backup.sh'
```

Nusxalarni kompyuterga ko'chirib turish tavsiya etiladi (server diski buzilsa ham saqlanib qoladi):

```bash
scp 'root@SERVER_IP:/var/backups/logicgate/*.gz' .
```

Nusxadan tiklash (serverda):

```bash
systemctl stop logicgate
gunzip -c /var/backups/logicgate/logicgate-2026-11-05.db.gz > /var/lib/logicgate/logicgate.db
rm -f /var/lib/logicgate/logicgate.db-wal /var/lib/logicgate/logicgate.db-shm
chown logicgate:logicgate /var/lib/logicgate/logicgate.db
systemctl start logicgate
```

## Kunlik boshqotirma

Har kuni (Toshkent vaqti bilan yarim tunda) yangi masala: 3 kirish, 1–2 chiqish, ba'zan faqat NAND/NOR yoki NOT/AND/OR. Masalalar `node levels/daily.mjs` bilan oldindan yaratiladi (`levels/daily.json`, 728 kun ≈ 2 yil, keyin boshidan takrorlanadi) va faqat serverda turadi — brauzer kodida kelajakdagi masalalar yo'q.

- **Maqsad — isbotlangan minimum.** Generator berilgan elementlar bilan barcha sxemalarni to'liq sanab chiqadi (simmetriyalar qisqartiriladi, ~7 s), shuning uchun "maqsad"dan kam element bilan yechib bo'lmaydi.
- **Qiyinlik hafta kuniga bog'liq:** dushanba — oson, shanba — eng qiyin.
- **Reyting** — kamroq element, teng bo'lsa kim oldin topgan. Kechagi masala ham qabul qilinadi (yarim tundan oldin oflayn yechilgan natija keyin yetib kelishi uchun).
- **Seriya** — ketma-ket yechilgan kunlar; bugun hali yechilmagan bo'lsa ham kechagacha saqlanadi.

Masalalar ro'yxatini uzaytirish uchun `daily.mjs` dagi `COUNT` ni oshiring (mavjud kunlar o'zgarmaydi). Tanlash qoidalarini o'zgartirmang — o'tgan kunlarning masalalari ham o'zgarib ketadi.

## API

| Metod | Yo'l | Vazifa |
|---|---|---|
| POST | `/api/players` | `{nickname}` → `{id, nickname, code}` — yangi o'yinchi va tiklash kodi |
| GET | `/api/me` | profil (`Authorization: Bearer <kod>`) |
| PATCH | `/api/me` | `{nickname}` — taxallusni o'zgartirish |
| GET | `/api/progress` | o'yinchining eng yaxshi yechimlari |
| POST | `/api/levels/{id}/solve` | `{circuit}` — server sxemani tekshiradi va saqlaydi |
| GET | `/api/levels/{id}/stats` | yechganlar soni va eng kam element |
| GET | `/api/leaderboard` | top-50 (token bo'lsa, o'yinchining o'rni ham) |
| GET | `/api/daily` | bugungi masala, statistika; token bo'lsa — o'yinchi natijasi va seriyasi |
| POST | `/api/daily/{day}/solve` | `{circuit}` — kunlik yechim (faqat bugungi va kechagi kun) |
| GET | `/api/daily/{day}/leaderboard` | kun reytingi, top-50 (`{day}` = `today` ham bo'ladi) |
| GET | `/healthz` | holat tekshiruvi |

Cheklovlar: Go'da IP bo'yicha 10 so'rov/s (40 tagacha portlash), yangi o'yinchi — 30 soniyada 1 ta (5 tagacha), noto'g'ri tiklash kodi — 5 soniyada 1 ta; Nginx'da 20 so'rov/s. So'rov tanasi 64 KB gacha, sxemada 64 tagacha element va 256 tagacha sim.

## Xavfsizlik

- Tiklash kodi 80 bitli tasodifiy son; bazada faqat uning SHA-256 xeshi saqlanadi.
- Yechimlar serverda qayta tekshiriladi: mijoz yuborgan yulduz soniga ishonilmaydi.
- Go server faqat `127.0.0.1` da tinglaydi va `X-Real-IP` ni faqat lokal manzildan kelgan so'rovda qabul qiladi.
- systemd xizmati alohida foydalanuvchi nomidan, faqat o'qish uchun fayl tizimi va cheklangan huquqlar bilan ishlaydi.
- Nginx CSP, `X-Frame-Options`, `nosniff` sarlavhalarini qo'shadi.
