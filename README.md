# Logic Gate

Mantiqiy elementlardan (NOT, AND, OR, XOR, NAND, NOR, XNOR) sxema yig'ib, boshqotirmalarni yechadigan brauzer o'yini.

- 42 ta daraja, 7 ta bo'lim: asoslardan 2 bitli ko'paytirgich, xotira (D-trigger) va avtomatlargacha.
- Jonli simulyatsiya: simlar 1/0 holatiga qarab yonadi, haqiqat jadvali har bir o'zgarishda yangilanadi.
- Bo'lim xulosalari (`#/lesson/<bo'lim>`, `web/src/lessons.ts`): bo'limning barcha darajalari yechilgach ochiladigan qisqa dars — formulalar, jadvallar va g'oyalar (De Morgan, NAND universalligi, summator, trigger, chekli avtomat), o'zbekcha va ruscha.
- Sxema formulasi: yig'ilgan sxemaning Bul ifodasi (`Q = (A ∧ B) ∨ ¬C`) yon panelda jonli ko'rinadi (`web/src/sim/formula.ts`). Bir necha joyga ulangan element nom oladi (`t1`, chiqishga ulangan bo'lsa — chiqish nomi), D-trigger — `q1`, keyingi qiymati — `q1⁺`; maydonda trigger ostida ham `q1` yoziladi.
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

Ketma-ket (xotirali) darajada `fn` o'rniga `init` + `step(holat, ...kirishlar) → [keyingi holat, chiqishlar]` va vaqt diagrammasi namunasi (`example`) yoziladi; build ulardan eng kichik avtomatni quradi (`seq` maydoni). Maqsad haqiqatan minimum ekanini `node levels/seq-min.mjs` to'liq sanash bilan tekshiradi (taxminan bir daqiqa).

Build skripti har bir yechimni tekshiradi va element soni `goal` ga teng ekanini nazorat qiladi. Bosqichli maslahat uchun yechimdan faqat elementlar tarkibi va kirishlarga ulangan birinchi element olinadi (`hints`); yechimning o'zi `levels.json` ga tushmaydi. `levels.json` Go binariga `go:embed` orqali joylanadi, shuning uchun o'zgarishdan keyin serverni qayta yig'ish kerak (`deploy.sh` buni o'zi qiladi).

## Coolify orqali joylash (Docker)

**Hozirgi joylash:** https://logic.noesis.uz — Coolify'da `logic-gate` loyihasi (production). Eski manzil http://logic-gate.170.168.6.82.sslip.io ham ishlaydi: natijasi yo'q tashrifchi yangi manzilga o'tkaziladi, natijasi borlarga ularni olib o'tish tugmasi chiqadi (`web/src/migrate.ts`). Yangi versiyani chiqarish: `main` ga push qilish kifoya — GitHub Actions testlarni o'tkazadi, image'ni yig'adi, Coolify'ni chaqiradi va sayt `/api/version` da yangi commit'ni qaytarguncha kutadi. Yangi versiya ko'rinmasa (serverdan ghcr.io ga ulanishlarning bir qismi uziladi va image tortilmay qoladi), Coolify har ~80 soniyada qayta chaqiriladi — jami 4 martagacha; ~7 daqiqada ham bo'lmasa, workflow xato bilan tugaydi. Mantiq: `.github/scripts/deploy-coolify.sh`.

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
4. Eski manzilni Coolify'da qoldiring — eski havolalar ishlashda davom etadi, `migrate.ts` foydalanuvchilarni yangi manzilga olib o'tadi.

DNS: domenlar eskiz.uz da (ns1/ns2.eskiz.uz), `logic.noesis.uz` — A yozuv `170.168.6.82`. Coolify `https://` domen qo'shganda `www.` variantini ham avtomatik qo'shadi — unga DNS yozuvi bo'lmasa, uni o'chiring (aks holda Let's Encrypt sertifikati olinmasligi mumkin).

Havola rasmi `web/public/og.png` (1200×630) va Telegram ilova rasmi `deploy/telegram/app-640x360.png` — `web/scripts/og.html` dan headless Chrome skrinshoti (buyruqlar faylning boshida). Ilova ikonkalari (`web/public/icons/`) — `web/scripts/icons.html` dan, belgi `web/public/favicon.svg` bilan bir xil. Telegram rasmni manzili bo'yicha keshlaydi, shuning uchun rasm o'zgarganda `web/index.html` va `web/scripts/pages.mjs` dagi `og.png?v=…` ni oshiring va havolani @WebpageBot'ga yuboring.

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
- **Yakshanba — xotira kuni** (2026-11-15 dan): masala D-trigger bilan, vaqt diagrammasi namunasi bilan (1–2 kirish, eng kichik avtomat 2–4 holat, maqsad 3–4 element). Masala — kichik tasodifiy sxemaning avtomati; maqsad `levels/seqsearch.mjs` qidiruvi bilan isbotlangan minimum (barcha kirishlar ishlatilishi shart). Oddiy kunlar masalalari asosiy generatsiyadan keyin, alohida urug' bilan almashtiriladi — boshqa kunlar o'zgarmaydi. Bot yakshanba eslatmasida buni aytadi.
- **Reyting** — kamroq element, teng bo'lsa kim oldin topgan. Kechagi masala ham qabul qilinadi (yarim tundan oldin oflayn yechilgan natija keyin yetib kelishi uchun).
- **Seriya** — ketma-ket yechilgan kunlar; bugun hali yechilmagan bo'lsa ham kechagacha saqlanadi.
- **Arxiv** (`#/archive`, bosh sahifadagi «O'tgan kunlar masalalari»): o'tgan kunlar ro'yxati — yechganlar soni, eng kam yechim va o'yinchining natijasi (`GET /api/daily/archive`). Kun masalasi `GET /api/daily/{day}` bilan olinadi — faqat bugungacha, kelajak kunlari 404. Kechagi masala hali ochiq (reyting va seriyaga kiradi); undan oldingilari — mashq: natija faqat qurilmada (`lg.dailyPractice.v1`), serverga yuborilmaydi, seriya va yutuqlarga kirmaydi.

Masalalar ro'yxatini uzaytirish uchun `daily.mjs` dagi `COUNT` ni oshiring (mavjud kunlar o'zgarmaydi). Tanlash qoidalarini o'zgartirmang — o'tgan kunlarning masalalari ham o'zgarib ketadi.

## Xotira (ketma-ket sxemalar)

6-bo'lim «Xotira» (52 ★ dan ochiladi) yangi element — D-trigger (`DFF`) bilan. Uning chiqishi — saqlangan bit (boshida 0); «Takt» tugmasi (yoki `T`) bosilganda har bir trigger kirishidagi qiymatni eslab qoladi. Trigger orqali o'tgan aylana sikl hisoblanmaydi, triggersiz aylana — sikl.

- **Vazifa** haqiqat jadvali o'rniga vaqt diagrammasi namunasi bilan beriladi; panelda «Sizning sxemangiz» — bosilgan taktlar va kutilgan qiymatlar.
- **Tekshiruv** sxemani kerakli avtomat bilan har qanday kirishlar ketma-ketligida solishtiradi: ikkalasi boshlang'ich holatdan birga, erishiladigan har bir juft holat bo'yicha kenglik bo'yicha yuradi (≤ 8 trigger, ya'ni ≤ 256 holat). Farq bo'lsa, uni ko'rsatadigan eng qisqa ketma-ketlik taktma-takt o'ynab ko'rsatiladi; to'g'ri bo'lsa — namuna.
- Server (`sim.CheckSeq`) xuddi shu tekshiruvni qayta bajaradi; noto'g'ri javobda `{"error":"wrong_answer","trace":[…]}`.
- Qum qutida ham D-trigger va takt bor. Xotirali sxemadan do'stlar masalasi ham yaratiladi: havolada eng kichik avtomat (`s: { q, y }` — keyingi holatlar va chiqishlar), ko'pi bilan 16 holat va 128 katakcha (Telegram `startapp` 512 belgiga sig'sin). Vaqt diagrammasi namunasi havolaga yozilmaydi — avtomatdan bir xil tarzda hosil qilinadi (`exampleFor`).

7-bo'lim «Avtomatlar» (64 ★ dan ochiladi) — xotirali sxemalar amalda: birinchi bosish, navbatchi (impulslarni navbat bilan ikki chiqishga), turniket, tugmali chiroq (front + almashtirgich), yuqoriga-pastga hisoblagich va ketma-ket (bitma-bit) qo'shuvchi. Hammasining maqsadi `seq-min.mjs` da isbotlangan; qo'shuvchi uchun (2 kirish + 5 gacha trigger) qidiruv 7 o'zgaruvchigacha — 128 bitli jadval (32 bitli so'zlar massivi) bilan ishlaydi.

## Telegram Mini App

O'yin Telegram ichida bot orqali ochiladi. Server tomonida hech narsa kerak emas: bot tokeni serverga qo'yilmaydi va o'yin uni ishlatmaydi.

- Telegram SDK (`telegram.org/js/telegram-web-app.js`) faqat Telegram ichida yuklanadi (`web/src/telegram.ts`) — oddiy saytga tashqi skript qo'shilmaydi.
- `t.me/<bot>/<app>?startapp=daily` — kunlik masala, `startapp=p_<kod>` — do'stlar masalasi (`web/src/telegram-app.ts`).
- Telegram sarlavhasidagi orqaga tugmasi har ekranning "orqaga" amalini bajaradi; asosiy amallar tebranish bilan; maydonda sudrash ilovani yopib yubormaydi (vertikal surish o'chirilgan).
- Profil kodi Telegram bulutida (CloudStorage — shu bot va shu foydalanuvchi uchun shaxsiy): boshqa qurilmadagi Telegram'da o'yin ochilsa, profil va natijalar o'zi tiklanadi. Taxallus Telegram'dagi ismdan taklif qilinadi.
- Ulashish Telegram'ning o'z oynasida; `VITE_TG_APP_URL` sozlangan bo'lsa, havola Mini App'ga (do'st ham Telegram ichida ochadi), saytning bosh sahifasida esa "Telegram'da o'ynash" tugmasi chiqadi.
- CSP: `script-src` da `https://telegram.org`, `frame-ancestors https://web.telegram.org` (Telegram'ning veb-versiyasi Mini App'ni iframe'da ochadi). Boshqa saytlar o'yinni iframe'ga ola olmaydi.

### Botni sozlash (bir marta, @BotFather da)

1. `/newbot` → nom `Logic Gate`, username (masalan `LogicGateUzBot`). Bot tokenini hech kimga bermang — o'yinga u kerak emas.
2. `/newapp` → botni tanlang → nom, qisqa tavsif, rasm — `deploy/telegram/app-640x360.png`, GIF — `/empty`, URL — `https://logic.noesis.uz`, qisqa nom (masalan `play`). Natija: `https://t.me/LogicGateUzBot/play`.
3. `/setmenubutton` → botni tanlang → URL `https://logic.noesis.uz`, matn `O'ynash` — bot suhbatida doimiy tugma.
4. Ixtiyoriy: `/setuserpic` — `web/public/icons/icon-512.png`; `/setdescription`, `/setabouttext`.
5. `web/.env` da `VITE_TG_APP_URL=https://t.me/LogicGateUzBot/play`, commit va push.

Hozirgi bot: [@LogicGateUzBot](https://t.me/LogicGateUzBot), Mini App — https://t.me/LogicGateUzBot/play (2026-11-07).

### Bot serverda (kunlik eslatma va zaxira nusxa)

Server bot tokeni bilan ishga tushsa (`server/internal/bot`), bot:

- `/start` ga salomlashuv va «O'ynash» (Mini App) hamda «Har kuni eslatish» tugmalari bilan javob beradi; `/eslatma` — yoqish/o'chirish, `/til` — o'zbekcha/ruscha (standart — o'zbekcha, o'yin kabi; o'yin ichidan yoqilganda — o'yindagi til), `/id` — Telegram ID, `/help`;
- har kuni `LG_REMIND_HOUR` da (Toshkent, standart 9:00) eslatma yoqqanlarga bugungi masala haqida yozadi — bugun yechganlarga yozmaydi, o'yinga bog'langanlarga seriyasini aytadi; server o'chiq bo'lib qolsa, 21:00 gacha kechikib yuboradi;
- kunlik zaxira nusxani admin'ga fayl qilib yuboradi (serverdan tashqaridagi nusxa) va admin'ga `/stats` ni ko'rsatadi;
- admin'ga har dushanba 10:00 da haftalik hisobot (o'yinchilar, faollik, kunlik masala, reyting) va serverdagi xatolar haqida ogohlantirish (ERROR log, 10 daqiqada ko'pi bilan bitta xabar);
- **inline rejim** (BotFather → `/setinline` → @LogicGateUzBot → masalan `masala`): istalgan suhbatda `@LogicGateUzBot` yozilsa — «Bugungi masala» (o'yinga bog'langan va bugun yechgan bo'lsa — natijasi bilan) va «O'yinga taklif» kartalari, «Yechish»/«O'ynash» tugmasi Mini App'ni ochadi;
- o'yin ichida (Telegram'da) kunlik masala yechilgan oynada va sozlamalarda «🔔 Har kuni eslatish» tugmasi: Telegram'dan ruxsat so'raladi, server `initData` imzosini token bilan tekshiradi (`POST /api/telegram/remind`).

Yangilanishlar long polling bilan olinadi — webhook manzili kerak emas. Token faqat muhitdan o'qiladi; Bot API xatolarida u `***` bilan almashtiriladi.

| O'zgaruvchi | Ma'nosi |
|---|---|
| `LG_TELEGRAM_TOKEN` | @BotFather bergan token. Bo'sh bo'lsa bot o'chiq, o'yinda eslatma tugmasi ko'rinmaydi |
| `LG_TELEGRAM_ADMIN` | Zaxira nusxa va `/stats` oladigan Telegram ID (botga `/id` yozib bilish mumkin) |
| `LG_REMIND_HOUR` | Eslatma soati, Toshkent vaqti (standart 9) |
| `LG_SITE_URL`, `LG_TELEGRAM_APP` | Mini App manzili (`https://logic.noesis.uz`) va qisqa nomi (`play`) |

Coolify: ilova → **Environment Variables** → `LG_TELEGRAM_TOKEN` (va `LG_TELEGRAM_ADMIN`) qo'shing → **Redeploy**. Tokenni hech qayerga (chat, repozitoriy, skrinshot) yozmang.

Rasm `deploy/telegram/app-640x360.png` va `web/public/og.png` — `web/scripts/og.html` dan.

## Tillar

O'zbekcha (standart) va ruscha. Til bosh sahifadagi va sozlamalardagi tugma bilan almashtiriladi, `lg.settings.v1` da saqlanadi. Interfeys matnlari — `web/src/i18n.ts` (`ru: typeof uz`, shuning uchun kalit tushib qolsa TypeScript xato beradi). Darajalar va bo'limlar tarjimasi — `levels/i18n.ru.mjs`; `node levels/build.mjs` ularni `levels.json` ga `i18n.ru` sifatida qo'shadi va har bir daraja tarjima qilinganini tekshiradi. Server faqat xato kodlarini qaytaradi, matnlar mijozda.

## Do'stlar masalasi

Qum qutida yig'ilgan sxemadan «Masala qilish» masala yaratadi: uning haqiqat jadvali — vazifa, muallif ishlatgan elementlar soni — maqsad, ruxsat etilgan elementlar — muallif ishlatganlari. Masala butunlay havolaning o'zida (`#/p/<kod>`, ~150 belgi): ixcham JSON → base64url. Server va baza ishtirok etmaydi; natijalar faqat qurilmada (`lg.custom.v1`). Havola o'qilganda qat'iy tekshiriladi, buzilgan bo'lsa xabar chiqadi.

## Mavzular va shriftlar

O'yin uslubi — "ustaxona": tuzilma bitta, ranglar mavzuga qarab. Sozlamalarda **Plata** (qorong'i, sukut bo'yicha: yashil plata, mis yo'llar, sariq chiroq), **Daftar** (yorug': katakli qog'oz va siyoh — kunduzi va sinfda proyektorda qulay) va **Avto** (telefon yoki Telegram rejimiga qarab).

- Ranglar faqat `web/src/styles.css` boshidagi o'zgaruvchilarda (`:root` — Plata, `:root[data-theme='daftar']` — Daftar). Qolgan CSS'da qattiq yozilgan rang bo'lmasligini `theme.test.ts` tekshiradi; yangi rang kerak bo'lsa — ikkala mavzuga o'zgaruvchi qo'shing. `--on` — signal 1 (sim, chiroq), `--accent` — interfeysdagi asosiy tugma; shaffof variant uchun `rgba(var(--on-rgb), 0.2)`.
- `web/public/theme.js` mavzuni birinchi chizishdan oldin qo'yadi (CSP inline skriptga ruxsat bermaydi), keyin `src/theme.ts` boshqaradi: `<html data-theme>`, brauzer paneli rangi, Telegram oynasi ranglari.
- Shriftlar — IBM Plex Sans va Plex Mono (`@fontsource`, o'z serverimizdan). Har alifbo `unicode-range` bilan faqat kerak bo'lganda yuklanadi; service worker shriftni birinchi yuklanishda keshga qo'yadi.
- Maydon: simlar plata yo'li kabi — faqat gorizontal, vertikal va 45° qismlar (`geometry.ts` → `wireRoute`, burchaklar `routePath` da kesiladi); kirishlar — tumbler (qiymat dasta ichida), chiqishlar — chiroq. Plata'da yoniq yo'l ostida yorug'lik, Daftar'da — sariq marker, siyoh chiziq, katakli qog'oz va biroz "qo'lda chizilgan" chiziqlar (SVG filtri `#sketch`; sudrash, surish va masshtab paytida o'chadi — telefon sekinlashmasin).
- Bosh ekran: "davom etish" kartochkasi (`components/MiniBoard.tsx` — navbatdagi darajaning kichik sxemasi: pinlar va o'yinchining qoralamasi; yechim hech qachon ko'rsatilmaydi), kunlik masala, pastki panel. Til — burchakdagi tugma, qo'llanma havolasi — sozlamalarda.
- Darajalar xaritasi (`levelmap.ts`): bo'lim ichida "ilon" tartibi — ustunlar soni sig'adiganining eng kattasi va iloji bo'lsa darajalar soniga bo'linadigan; har daraja keyingisiga o'ngga, chapga yoki pastga qisqa yo'l bilan ulanadi. Xaritada birinchi marta ko'rilgan yechimlar (`lg.mapSeen.v1`) yo'lni animatsiya bilan "yoqadi".
- Ikonkalar — `components/ui.tsx` dagi `ICONS` (24×24, chiziqli). Interfeysda emoji ishlatilmaydi; faqat ulashish matnlarida (Telegram xabari) qoladi.

## Qidiruv tizimlari (SEO)

O'yin hash marshrutli SPA — Google va Yandex undan faqat bosh sahifani ko'radi. Shuning uchun build oxirida `web/scripts/pages.mjs` oddiy HTML sahifalar yozadi (JavaScript'siz o'qiladi):

- `/ikkilik-sanoq-sistemasi/` va `/ru/dvoichnaya-sistema/` — ikkilik sanoq sistemasi: o'nlikdan ikkilikka va qaytib, 0–15 jadvali, ikkilikda qo'shish (misollar `pages-binary.mjs` da hisoblanadi) va bitlarni bosib sonni ko'radigan o'yinchoq (`public/guide-binary.js`). Qo'llanmalar bir-biriga sarlavhadagi menyu orqali bog'langan.
- `/mantiqiy-elementlar/` va `/ru/logicheskie-elementy/` — mantiqiy elementlar qo'llanmasi: belgisi (o'yindagi `src/board/shapes.ts` dan), formulasi, haqiqat jadvali, D-trigger, Bul algebrasi qonunlari, o'yin bo'limlari (`levels/levels.json` dan). Matnlar — `web/scripts/pages-content.mjs`, maktab atamalari bilan (inkor, konyunksiya, dizyunksiya…).
- `robots.txt` (`/api/` yopiq) va `sitemap.xml` — manzil `VITE_SITE_URL` dan.

Bosh sahifada `canonical`, kengaytirilgan `description` va schema.org (`WebApplication`) bor; o'yinning bosh ekranida qo'llanmaga havola (Telegram ichida yashirin). Go server papkadagi `index.html` ni beradi, sleshsiz manzilni sleshliga yo'naltiradi; Nginx'da `try_files $uri $uri/index.html /index.html`.

Saytni Google Search Console va Yandex Webmaster'ga qo'shish (domen egasi tasdiqlaydi) va u yerda `https://logic.noesis.uz/sitemap.xml` ni yuborish — indekslashni tezlashtiradi. Tasdiqlash fayllari — `web/public/google*.html` va `web/public/yandex_*.html`: ularni o'chirmang, Google va Yandex vaqti-vaqti bilan qayta tekshiradi.

## Sinf rejimi (o'qituvchilar uchun)

Sozlamalar → «O'qituvchilar uchun: sinf yaratish» (`#/teacher`). O'qituvchi sinf nomini kiritadi va ikki narsa oladi:

- **sinf kodi** (6 belgi, ochiq) va havola `#/class/<kod>` — o'quvchilarga yuboriladi (Telegram'da `startapp=c_<kod>`); o'quvchi taxallusi bilan qo'shiladi va sinfdoshlar reytingini ko'radi;
- **o'qituvchi kaliti** (tiklash kodi kabi 16 belgi) — hisobot va boshqaruv uchun; shu qurilmada saqlanadi (`lg.teacher.v1`), serverda faqat SHA-256 xeshi. Boshqa qurilmada «Kod va kalit bilan qo'shish».

**Vazifalar.** Hisobotda «Yangi vazifa»: o'qituvchi 1–12 ta darajani belgilaydi, istasa nom va muddat qo'yadi (sinfda 20 tagacha vazifa). O'quvchi vazifani bosh sahifada ko'radi («Sinf vazifasi», bajarilmagan va muddati o'tmaganlardan eng yaqini) va sinf sahifasida — hammasini. Vazifadagi darajalar o'quvchiga yulduzlar yetmasa ham ochiq (ro'yxat qurilmada `lg.tasks.v1` da, oflayn ham ishlaydi). O'qituvchi har vazifa bo'yicha nechta o'quvchi bajarganini va kim hali bajarmaganini ko'radi.

**Hisobotni chiqarish.** Jadval ostida: «Excel (CSV)» — fayl (UTF-8 BOM, `;` ajratgich: Excel o'zbek/rus sozlamalarida shuni kutadi), «Jadvalni nusxalash» — TSV, Excel yoki Google Sheets'ga to'g'ridan-to'g'ri qo'yiladi (Telegram ichida ham ishlaydi), «Chop etish» — faqat hisobot va vazifalar, yorug' mavzuda. Ustunlar: o'quvchi, yulduzlar, darajalar, har bo'lim bo'yicha yechilganlar, bugungi va 7 kunlik kunlik masalalar, oxirgi kirish sanasi, har vazifa bo'yicha yechilgan darajalar. `=`, `+`, `-`, `@` bilan boshlangan matn formula bo'lib qolmasligi uchun oldiga `'` qo'yiladi.

Hisobot (`#/teacher/<kod>`): o'quvchi, yulduzlar, darajalar, har bir bo'lim bo'yicha yechilganlar (rang to'yinganligi bilan), bugungi kunlik masala, 7 kunda yechilgan kunlik masalalar, oxirgi faollik; o'quvchini chiqarish va sinfni o'chirish (natijalar o'quvchilarda qoladi). Sinfda 200 tagacha o'quvchi; bir IP dan sinf yaratish — 2 daqiqada 1 ta (5 tagacha birdaniga).

## Versiya va yangiliklar

O'yin versiyasi — `web/package.json` dagi `version` (build'da `__APP_VERSION__`); u Sozlamalar pastida ko'rinadi. O'yinchilar uchun yangiliklar sodda tilda ikki joyda yoziladi:

- `web/src/changelog.ts` — o'yin ichidagi «Yangiliklar» ekrani (`#/news`, uz va ru);
- `CHANGELOG.md` — repoda, o'zbekcha.

Yangi versiyadan keyin qaytgan o'yinchiga bosh sahifada bir marta «Yangi versiya X» xabari chiqadi (birinchi qator + «Nimalar yangi →»); ko'rilgan versiya `lg.seenVersion.v1` da saqlanadi. Yangi o'yinchiga xabar chiqmaydi.

Har reliz oldidan:

1. `web/package.json` dagi versiyani oshiring: yangi imkoniyat — o'rta raqam (2.1.0), tuzatish — oxirgi (2.0.1), katta o'zgarish — birinchi (3.0.0).
2. `changelog.ts` boshiga yozuv qo'shing: sana, uz va ru qatorlari (soni teng). O'yinchi tilida yozing: nima o'zgardi va unga nima foyda — texnik so'zlarsiz.
3. Xuddi shu o'zbekcha qatorlarni `CHANGELOG.md` ga qo'shing.

`changelog.test.ts` versiya, tartib, sanalar, uz/ru soni va `CHANGELOG.md` mosligini tekshiradi — biri unutilsa test yiqiladi.

## Oflayn rejim

HTTPS'da (va `localhost` da) `dist/sw.js` service worker ro'yxatdan o'tadi: birinchi ochilishdan keyin o'yin internetsiz ham ochiladi. `sw.js` build oxirida `web/scripts/sw.mjs` tomonidan `sw.template.js` dan yoziladi (fayllar ro'yxati + mazmun xeshi). Har deploy'da xesh o'zgaradi — brauzer yangi versiyani o'zi o'rnatadi va eski keshni o'chiradi. `vite dev` da service worker yo'q.

Favqulodda holatda (service worker buzilgan bo'lsa) foydalanuvchilarga "sayt ma'lumotlarini tozalash"ni maslahat bermang — natijalar ham o'chadi. Buning o'rniga `sw.js` ni o'zini o'chiradigan versiya bilan deploy qiling (`self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', () => self.registration.unregister());`): brauzer `sw.js` ni har ochilishda tekshiradi (`Cache-Control: no-cache`). Ishlab chiqishda: DevTools → Application → Service workers → Unregister.

## API

| Metod | Yo'l | Vazifa |
|---|---|---|
| POST | `/api/players` | `{nickname}` → `{id, nickname, code}` — yangi o'yinchi va tiklash kodi |
| GET | `/api/me` | profil (`Authorization: Bearer <kod>`) |
| PATCH | `/api/me` | `{nickname}` — taxallusni o'zgartirish |
| GET | `/api/progress` | o'yinchining eng yaxshi yechimlari |
| POST | `/api/levels/{id}/solve` | `{circuit}` — server sxemani tekshiradi va saqlaydi |
| GET | `/api/levels/{id}/stats` | yechganlar soni, eng kam element va taqsimot `spread: [[element, o'yinchilar], ...]` |
| GET | `/api/leaderboard` | top-50 (token bo'lsa, o'yinchining o'rni ham) |
| GET | `/api/daily` | bugungi masala, statistika; token bo'lsa — o'yinchi natijasi va seriyasi |
| POST | `/api/daily/{day}/solve` | `{circuit}` — kunlik yechim (faqat bugungi va kechagi kun); javobda `spread` ham bor |
| GET | `/api/daily/{day}/leaderboard` | kun reytingi, top-50 (`{day}` = `today` ham bo'ladi) |
| POST | `/api/classes` | `{name}` → `{code, name, key}` — o'qituvchi sinf yaratadi (kalit faqat shu javobda) |
| GET | `/api/classes/{code}` | sinf nomi, o'quvchilar soni va vazifalar (`tasks`); token bo'lsa — `member` |
| POST / DELETE | `/api/classes/{code}/join` | o'quvchi sinfga qo'shiladi / chiqadi (token bilan) |
| GET | `/api/classes/{code}/board` | sinf reytingi — faqat a'zolar uchun |
| GET | `/api/me/classes` | o'yinchi a'zo bo'lgan sinflar (har birida `tasks`) |
| GET | `/api/classes/{code}/report` | o'qituvchi hisoboti (`X-Class-Key: <kalit>`): har bir o'quvchining darajalari, bugungi va 7 kunlik kunlik masalalari, faolligi |
| DELETE | `/api/classes/{code}/members/{id}`, `/api/classes/{code}` | o'qituvchi o'quvchini chiqaradi / sinfni o'chiradi (kalit bilan) |
| POST | `/api/classes/{code}/tasks` | `{title, levels, due}` — o'qituvchi vazifa beradi (kalit bilan); `due` — Toshkent kuni, 0 — muddatsiz |
| DELETE | `/api/classes/{code}/tasks/{id}` | o'qituvchi vazifani o'chiradi (kalit bilan) |
| GET | `/healthz` | holat tekshiruvi |

Cheklovlar: Go'da IP bo'yicha 10 so'rov/s (40 tagacha portlash), yangi o'yinchi — 30 soniyada 1 ta (5 tagacha), noto'g'ri tiklash kodi — 5 soniyada 1 ta; Nginx'da 20 so'rov/s. So'rov tanasi 64 KB gacha, sxemada 64 tagacha element va 256 tagacha sim.

## Xavfsizlik

- Tiklash kodi 80 bitli tasodifiy son; bazada faqat uning SHA-256 xeshi saqlanadi.
- Yechimlar serverda qayta tekshiriladi: mijoz yuborgan yulduz soniga ishonilmaydi.
- Go server faqat `127.0.0.1` da tinglaydi va `X-Real-IP` ni faqat lokal manzildan kelgan so'rovda qabul qiladi.
- systemd xizmati alohida foydalanuvchi nomidan, faqat o'qish uchun fayl tizimi va cheklangan huquqlar bilan ishlaydi.
- Nginx CSP, `X-Frame-Options`, `nosniff` sarlavhalarini qo'shadi.
