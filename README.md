# Logic Gate

Mantiqiy elementlardan (NOT, AND, OR, XOR, NAND, NOR, XNOR) sxema yig'ib, boshqotirmalarni yechadigan brauzer o'yini.

- 48 ta daraja, 8 ta bo'lim: asoslardan 2 bitli ko'paytirgich, xotira (D-trigger), avtomatlar va «Faqat NOR» gacha.
- Jonli simulyatsiya: simlar 1/0 holatiga qarab yonadi, haqiqat jadvali har bir o'zgarishda yangilanadi.
- Bo'lim xulosalari (`#/lesson/<bo'lim>`, `web/src/lessons.ts`): bo'limning barcha darajalari yechilgach ochiladigan qisqa dars — formulalar, jadvallar va g'oyalar (De Morgan, NAND va NOR universalligi, summator, trigger, chekli avtomat), o'zbekcha va ruscha.
- Sxema formulasi: yig'ilgan sxemaning Bul ifodasi (`Q = (A ∧ B) ∨ ¬C`) yon panelda jonli ko'rinadi (`web/src/sim/formula.ts`). Bir necha joyga ulangan element nom oladi (`t1`, chiqishga ulangan bo'lsa — chiqish nomi), D-trigger — `q1`, keyingi qiymati — `q1⁺`; maydonda trigger ostida ham `q1` yoziladi.
- Element sonini tejagan o'yinchiga 3 ★. Keyingi bo'limlar yulduzlar bilan ochiladi.
- Ro'yxatdan o'tmasdan o'ynash mumkin. Taxallus kiritilsa, natijalar reytingga qo'shiladi, progress esa tiklash kodi orqali boshqa qurilmaga o'tkaziladi.
- Qum quti: istalgan sxemani erkin yig'ish.
- Telefon va kompyuterda ishlaydi: sichqoncha, sensorli ekran, pinch-zoom, klaviatura (Delete, Ctrl+Z, Ctrl+Y, Ctrl+Enter). Tik telefonda sxema yuqoridan pastga joylashadi (kirishlar tepada, chiqishlar pastda) — elementlar kattaroq ko'rinadi.
- Faqat klaviatura bilan ham o'ynasa bo'ladi: Tab — maydondagi nuqtalar, elementlar va kirish tumblerlari; nuqtada Enter/Probel — simni boshlash va ulash, Delete — kirishga kelgan simni o'chirish; elementda strelkalar — surish, Delete — o'chirish; haqiqat jadvali qatorlari ham Tab bilan. Oynalar fokusni ushlaydi va yopilganda qaytaradi, xabarlar (toast) ekran o'quvchiga jonli hudud orqali o'qiladi.
- Til: o'zbek va rus. Tanlanmagan bo'lsa — qo'llanma sahifasidan kelgan havoladagi `?lang=` (o'qiladi va manzildan olib tashlanadi), birinchi ochilishda esa Telegram yoki brauzer tili (`web/src/lang-detect.ts`).

## Stek

| Qatlam | Tanlov | Nega |
|---|---|---|
| Backend | Go + `net/http` + SQLite (`modernc.org/sqlite`, CGO'siz) | Bitta binar fayl, serverga runtime kerak emas, RAM ~15–25 MB |
| Frontend | Vite + TypeScript + Preact + `@preact/signals`, o'yin maydoni SVG | Ochilishda JS + CSS gzip'da ~96 KB (byudjet 100 KB), hammasi statik fayllar |
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
| Frontend JS (gzip), ochilishda | 87,8 KB, 8 faylda (2.14.0; 1-versiyada 28,3 KB) |
| Frontend CSS (gzip) | 11,3 KB |
| Kerak bo'lganda yuklanadigan bo'laklar (gzip) | xulosa 8,6 KB, yangiliklar 7,8 KB, o'qituvchi 4,2 KB, qum quti 4,1 KB, sertifikat 2,6 KB, reyting 1,3 KB, do'st masalasi 1,0 KB, arxiv 0,8 KB, yutuqlar 0,7 KB |

Bosh yuklama (ochilishda kerak bo'ladigan JS + CSS) — gzip'da 100 KB gacha: `web/scripts/compress.mjs` build oxirida tekshiradi, oshsa build to'xtaydi. Kam ochiladigan ekranlar `lazy()` (`web/src/components/lazy.tsx`) bilan alohida bo'lakda; service worker ularni ham oldindan keshlaydi. Yangiliklar ro'yxati (`changelog.ts`, har relizda o'sadi) ham alohida: bosh sahifadagi «yangi versiya» banneri birinchi qatorni u yuklangach ko'rsatadi. 2.14.0 da simlar yo'naltirgichi qo'shilib 101 KB bo'ldi — qum quti, reyting, arxiv, yutuqlar va do'st masalasi ham alohida bo'lakka chiqarildi: 99,1 KB (2.15.0 da animatsiya sozlamasi bilan — 99,6 KB). 2.16.0 da yangi ko'rinish 100,7 KB ga chiqardi — do'st masalalarining lokal natijalari `custom-store.ts` ga ajratildi (ochilishda faqat shu kerak; kodlash va o'qish — `custom.ts`, Qum quti va do'st masalasi bilan birga yuklanadi): 98,1 KB. 2.17.0 da ikki yangi mavzu 99,9 KB ga chiqardi — Sozlamalar ekrani ham `lazy()` ga o'tdi, reyting, arxiv, yutuqlar, Qum quti va Sozlamalar uslublari o'z ekrani yonidagi faylga ko'chirildi: 97,8 KB. Bundler (Rolldown) bosh va alohida bo'laklarga umumiy modullarni o'zaro aylanma bog'liqlik bo'lmasligi uchun kichik fayllarga ajratadi — shuning uchun bosh JS bir necha faylda (HTTP/2 va service worker keshi bilan farqi sezilmaydi). Shundan keyin til lug'atlari ham alohida bo'lakka chiqdi (`i18n-uz.ts`, `i18n-ru.ts` — quyida «Tillar»): ochilishda faqat kerakli til yuklanadi — 89,3 KB (rus tilida; o'zbek tilida — 87,1 KB). Lug'at index.html dagi `src`/`href` da ko'rinmaydi (uni `theme.js` so'rab qo'yadi), shuning uchun `compress.mjs` uni alohida topib, eng kattasini bosh yuklamaga qo'shib hisoblaydi.

Qurilmadagi ma'lumot (localStorage) har o'qilganda shakli tekshiriladi (`web/src/validate.ts`): buzuq yozuv tashlanadi, ilova to'xtamaydi. Ilova baribir ishga tushmasa (shu jumladan ochilish tilining lug'ati yuklanmasa), `public/theme.js` oq ekran o'rniga «qayta yuklash» va «ma'lumotni tozalash» (profil qoladi) oynasini ko'rsatadi; ekran chizishda xato bo'lsa — `app.tsx` dagi karta.

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

Telegram Mini App'ni Telegram'siz sinash: `VITE_TG_SDK_URL=/dev/tg-mock.js pnpm dev`, so'ng o'yinni Telegram ochgandek manzil bilan oching — `http://localhost:5173/#tgWebAppData=<user=…&auth_date=…&hash=…>&tgWebAppVersion=8.0&tgWebAppPlatform=tdesktop`. Soxta SDK (`web/dev/tg-mock.js`) bulut xotirasini localStorage'da `tgmock.cloud.*` kalitlarida saqlaydi (o'yin ma'lumotini tozalasangiz qoladi — "boshqa qurilma"), javobni `tgmock.delay` ms kechiktiradi (sekin internet; 5000 dan oshsa — javob yo'q), barcha chaqiruvlarni `window.__tgmock.log` ga yozadi. Build'ga kirmaydi; server initData imzosini tekshiradigan joylar (eslatma obunasi) bu rejimda ishlamaydi.

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

Brauzerdagi tutun testi — har mavzuda (4 ta AAA uslubi + Plata, Haqiqiy plata, Daftar, Chizma), telefon (375×812) va kompyuter (1280×800) o'lchamida, eng tor telefonda (320×640) va yotiq telefonda (740×360) esa bitta uslubda (Sanoat PCB) asosiy ekranlar buzilmay ochilishini tekshiradi:

```bash
cd web
pnpm test:ui
```

Buyruq o'yinni build qiladi, `web/dist` ni vaqtinchalik statik serverdan (127.0.0.1, bo'sh port) ochadi va kompyuterdagi Chrome'ni oynasiz boshqaradi (`web/scripts/ui-smoke.mjs`; ~2 daqiqa, CI da ikkala tilda ~4 daqiqa). Kerak bo'ladi: Chrome (bo'lmasa Chromium yoki Edge; boshqa joyda bo'lsa — `CHROME_PATH=/yo'l/chrome`). Qo'shimcha paket o'rnatilmaydi: skript brauzer bilan DevTools protokoli orqali Node'ning ichki `WebSocket` i bilan gaplashadi, shuning uchun `package.json` va o'yin bundle'i o'zgarmaydi. Go serveri kerak emas: `/api` so'rovlariga 503 qaytadi — o'yin serversiz ham ochilishi kerak.

Har juftlik (mavzu × o'lcham) — yangi «qurilma»: o'yin bir marta ochiladi, `localStorage` dagi `lg.settings.v1` ga mavzu va til yoziladi, keyin har ekran alohida to'liq yuklanadi. Ekranlar: bosh sahifa, darajalar, daraja (`#/level/b1` — tanishtiruv oynasi yopiladi, palitradan bitta element qo'shiladi, «Tozalash» → o'yinning tasdiqlash oynasi: «Bekor qilish» elementni saqlaydi, qayta ochilgan oyna tekshiruvga ochiq qoladi), Qum quti, Sozlamalar, yutuqlar; AAA uslublarida yana 3D daraja (`level3d`: WebGL dvigateli tayyor bo'ladi — `.board-3d-wrap[data-gl="ready"]`, keyin kontekst `WEBGL_lose_context` bilan yo'qotilib qaytariladi va dvigatel qayta qurilishi kerak; test brauzerida WebGL bo'lmasa — ogohlantirish bilan o'tkazib yuboriladi, CI da `--enable-unsafe-swiftshader`). Tekshiriladi:

- konsol xatosi, ushlanmagan istisno va yuklanmagan fayl yo'q; o'yin «xato» ekranini ko'rsatmadi va serverga xato xabari (`/api/client-errors`) yubormadi;
- hech narsa gorizontal toshmaydi — sahifaning o'zi ham, ichki aylantirish joylari ham (`.scroll`, oyna). `body` da `overflow: hidden`, ro'yxatlar ichki konteynerda aylanadi — keng element aynan o'shani toshiradi. Uslubda ataylab `overflow-x: auto` berilgan joylar (palitra, haqiqat jadvali) hisobga olinmaydi;
- mavzu qo'llangan: `<html data-theme>` (Sanoat PCB `pcb` da atribut yo'q), sakkizta mavzuning foni sakkiz xil; til qo'llangan: `<html lang>`;
- mavzuga xos belgilar: AAA uslublarda 2D Real plata/mikrosxemalar, `.chip-body` AAA va «Haqiqiy plata» da, `.lamp-x` faqat «Chizma» da ko'rinadi; Sozlamalarda 3 ta `.mode-tile` va 9 ta `.theme-tile`, tanlangani — joriy mavzu.
- «Tozalash» tasdiqlash oynasi ochilish animatsiyasi tugagach butunligicha ekranda, ikkala tugmasi ko'rinadi.

Yiqilsa — nima, qaysi til, mavzu, o'lcham va ekranda ekani yoziladi, skrinshot `web/test-results/ui/` ga tushadi (git'ga kirmaydi; ruscha o'tishniki — `-ru` qo'shimchasi bilan). Tayyor `dist` ustida va tor doirada ishga tushirish:

```bash
node scripts/ui-smoke.mjs --theme=chizma --size=phone --screen=level,settings
```

Boshqa parametrlar: `--lang=uz,ru` (ikkala tilda; `--lang=ru` — faqat ruscha), `--shots` (har ekrandan skrinshot — mavzularni ko'zdan kechirish uchun), `--headed` (brauzer oynasi ko'rinib turadi). `pnpm test:ui` faqat o'zbekchada o'tadi (tezroq); CI'da (`.github/workflows/docker.yml`, `test` ishi) build'dan keyin ikkala tilda — `--lang=uz,ru`, lokalda ~35 soniya: ruscha matnlar uzunroq, tor ekranda sig'maslik ko'proq o'sha tilda chiqadi (2.17.1 dagi Sozlamalar shunday topilgan). Yiqilsa, skrinshotlar `ui-skrinshotlar` artefaktida. Yangi mavzu yoki ekran qo'shilsa — skript boshidagi `THEMES` / `SCREENS` ro'yxatiga qo'shing.

## Darajalarni tahrirlash

Darajalar `levels/source.mjs` da: har bir daraja uchun maqsad funksiyasi (`fn`), ruxsat etilgan elementlar va mos yozuvdagi yechim (`sol`). Keyin:

```bash
node levels/build.mjs
```

Ketma-ket (xotirali) darajada `fn` o'rniga `init` + `step(holat, ...kirishlar) → [keyingi holat, chiqishlar]` va vaqt diagrammasi namunasi (`example`) yoziladi; build ulardan eng kichik avtomatni quradi (`seq` maydoni). Maqsad haqiqatan minimum ekanini `node levels/seq-min.mjs` to'liq sanash bilan tekshiradi (taxminan bir daqiqa).

Build skripti har bir yechimni tekshiradi va element soni `goal` ga teng ekanini nazorat qiladi. Maqsadning eng kam element soni ekani alohida isbotlanadi: kombinatsion darajalar — `node levels/comb-min.mjs` (ruxsat etilgan elementlar bilan barcha sxemalarni to'liq sanaydi, ~20 s; m5 dan tashqari hammasi `web/scripts/levels-min.test.mjs` da, har `pnpm test` da), ketma-ket darajalar — `node levels/seq-min.mjs`. Yangi daraja qo'shganda ikkalasini ham ishga tushiring. Bosqichli maslahat uchun yechimdan faqat elementlar tarkibi va kirishlarga ulangan birinchi element olinadi (`hints`); yechimning o'zi `levels.json` ga tushmaydi. `levels.json` Go binariga `go:embed` orqali joylanadi, shuning uchun o'zgarishdan keyin serverni qayta yig'ish kerak (`deploy.sh` buni o'zi qiladi).

## Coolify orqali joylash (Docker)

**Hozirgi joylash:** https://logic.noesis.uz — Coolify'da `logic-gate` loyihasi (production). Eski manzil http://logic-gate.170.168.6.82.sslip.io ham ishlaydi: natijasi yo'q tashrifchi yangi manzilga o'tkaziladi, natijasi borlarga ularni olib o'tish tugmasi chiqadi (`web/src/migrate.ts`). Yangi versiyani chiqarish: `main` ga push qilish kifoya — GitHub Actions testlarni o'tkazadi, image'ni yig'adi, Coolify'ni chaqiradi va sayt `/api/version` da yangi commit'ni qaytarguncha kutadi. Repo yopiq — Actions daqiqalari oylik limitli (bitta push ~5–6 daqiqa): o'zgarishlarni bitta push'ga yig'ing; faqat `*.md` yoki `deploy/telegram/` o'zgargan commit CI'ni ishga tushirmaydi; push'da tutun testi 4 uslubda, to'liq 8 uslub — har dushanba va qo'lda (Actions → Docker image → Run workflow). Limit tugasa yoki to'lov o'tmasa, image ishi boshlanmaydi («recent account payments have failed or your spending limit needs to be increased») — GitHub → Settings → Billing and plans. Yangi versiya ko'rinmasa (serverdan ghcr.io ga ulanishlarning bir qismi uziladi va image tortilmay qoladi), Coolify har ~80 soniyada qayta chaqiriladi — jami 4 martagacha; ~7 daqiqada ham bo'lmasa, workflow xato bilan tugaydi. Mantiq: `.github/scripts/deploy-coolify.sh`.

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

Rasmlar o'zgargandan keyin (deploy tugagach) qo'lda qilinadigan ikki ish:

1. **Telegram ilova rasmi (BotFather).** Telegram'da @BotFather → `/myapps` → `@LogicGateUzBot` → ilova (`play`) → **Edit Photo** → `deploy/telegram/app-640x360.png` ni rasm sifatida yuboring (640×360; siqilgan «photo» ham bo'ladi). Bu rasm `t.me/LogicGateUzBot/play` havolasi va ilova ochilish oynasida ko'rinadi.
2. **Havola oldidagi rasm (@WebpageBot).** Telegram havolalar ko'rinishini (rasm, sarlavha, tavsif) o'z keshida saqlaydi. @WebpageBot ga `https://logic.noesis.uz` ni yuboring (qo'llanma sahifalari ham ulashilgan bo'lsa — ularning manzillarini ham, bittadan); bot «Link preview was updated» desa, yangi ko'rinish olindi. Eski xabarlardagi ko'rinish darhol o'zgarmasligi mumkin — yangi yuborilgan havolalarda yangisi chiqadi.

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

Bir odamning ortiqcha profillari (yangi qurilmada kod o'rniga taxallus kiritib ochilgan) — avval zaxira nusxa, keyin `players` ro'yxatidagi id bo'yicha o'chiriladi. Yechimlari, kunlik natijalari va sinf a'zoligi ham o'chadi, qaytarib bo'lmaydi (faqat zaxira nusxadan). Taxallus bo'yicha o'chirilmaydi — bir xil ismli boshqa o'quvchi bo'lishi mumkin:

```bash
docker exec "$C" /app/logicgate backup
docker exec "$C" /app/logicgate delete <id> [id...]
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
- Profil kodi Telegram bulutida (CloudStorage — shu bot va shu foydalanuvchi uchun shaxsiy): boshqa qurilmadagi Telegram'da o'yin ochilsa, profil va natijalar o'zi tiklanadi. Tiklash tugaguncha taxallus shakli o'rnida «tekshirilmoqda» turadi; aloqa bo'lmasa — «qayta urinish» (yangi profil bulutdagi tiklanmagan profil ustidan yozilmaydi). Taxallus Telegram'dagi ismdan taklif qilinadi.
- SDK ishga tushirish parametrlarini hashdan o'qiydi: u yuklanguncha o'yinchi boshqa ekranga o'tsa, hash o'zgarmaydi (`holdHash` — `web/src/router.ts`), SDK yuklangach o'sha ekran yoziladi — sekin internetda ekran bosh sahifaga sakramaydi.
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
- admin'ga har dushanba 10:00 da haftalik hisobot (o'yinchilar, faollik, kunlik masala, reyting) va xatolar haqida ogohlantirish (ERROR log, 10 daqiqada ko'pi bilan bitta xabar) — server xatolari ham, o'yinchilar brauzeridagi xatolar ham (pastda);
- **inline rejim** (BotFather → `/setinline` → @LogicGateUzBot → masalan `masala`): istalgan suhbatda `@LogicGateUzBot` yozilsa — «Bugungi masala» (o'yinga bog'langan va bugun yechgan bo'lsa — natijasi bilan) va «O'yinga taklif» kartalari, «Yechish»/«O'ynash» tugmasi Mini App'ni ochadi;
- o'yin ichida (Telegram'da) kunlik masala yechilgan oynada va sozlamalarda «🔔 Har kuni eslatish» tugmasi: Telegram'dan ruxsat so'raladi, server `initData` imzosini token bilan tekshiradi (`POST /api/telegram/remind`);
- **saytga Telegram orqali kirish** (2.21.0): brauzerda «Telegram orqali kirish» — server bir martalik so'rov ochadi (`POST /api/auth/telegram`, 5 daqiqa, xotirada — `server/internal/tglogin`), sayt raqam va `t.me/<bot>?start=auth_<id>` havolasini ko'rsatadi. Bot so'rovni shu foydalanuvchiga biriktiradi va uchta raqam tugmasini beradi: saytdagi raqam tanlansa — tasdiq, noto'g'ri raqam yoki «Bu men emas» — rad (begona yuborgan havola bilan birovning brauzeri profilga kira olmaydi). Sayt holatni so'rab turadi (`GET /api/auth/telegram/{id}`) va profilga **qurilma kaliti** bilan kiradi (`player_tokens`, tiklash kodi kabi ishlaydi; asosiy kod o'zgarmaydi, profil o'chirilsa kalitlari ham o'chadi). Telegram hali profilga bog'lanmagan bo'lsa — yangi profil (`…/player`) yoki tiklash kodi bilan mavjudini bog'lash (`…/attach`). Sozlamalarda — «Telegram'ni bog'lash» (`POST /api/me/telegram`). Mini App'da profil o'zi bog'lanadi (`POST /api/me/telegram/app`), bulut bo'sh yoki eskirgan bo'lsa — server orqali tiklanadi (`POST /api/auth/telegram/app`). BotFather'da qo'shimcha sozlash kerak emas.
- **qurilmalar** (2.25.0): Sozlamalar → «Qurilmalar» — profilning qurilma kalitlari (taxminiy nom User-Agent'dan, masalan «Chrome · Android»; User-Agent'ning o'zi saqlanmaydi), kirgan va oxirgi ishlatilgan sana (soatiga bir marta yangilanadi); keraksizini chiqarish. Tiklash kodi bilan kirganlar ro'yxatda yo'q (bitta umumiy kod) — «Boshqa qurilmalardan chiqish» kodni yangisiga almashtiradi va barcha kalitlarni o'chiradi; Telegram bog'lanishi qoladi.

Yangilanishlar long polling bilan olinadi — webhook manzili kerak emas. Token faqat muhitdan o'qiladi; Bot API xatolarida u `***` bilan almashtiriladi.

| O'zgaruvchi | Ma'nosi |
|---|---|
| `LG_TELEGRAM_TOKEN` | @BotFather bergan token. Bo'sh bo'lsa bot o'chiq, o'yinda eslatma tugmasi ko'rinmaydi |
| `LG_TELEGRAM_ADMIN` | Zaxira nusxa va `/stats` oladigan Telegram ID (botga `/id` yozib bilish mumkin) |
| `LG_REMIND_HOUR` | Eslatma soati, Toshkent vaqti (standart 9) |
| `LG_SITE_URL`, `LG_TELEGRAM_APP` | Mini App manzili (`https://logic.noesis.uz`) va qisqa nomi (`play`) |

Coolify: ilova → **Environment Variables** → `LG_TELEGRAM_TOKEN` (va `LG_TELEGRAM_ADMIN`) qo'shing → **Redeploy**. Tokenni hech qayerga (chat, repozitoriy, skrinshot) yozmang.

Rasm `deploy/telegram/app-640x360.png` va `web/public/og.png` — `web/scripts/og.html` dan.

### O'yinchilar voronkasi

O'yinchilar qaysi bosqichda to'xtab qolayotganini ko'rish uchun (2.22.0): qurilma har bosqichni serverga **bir marta** xabar qiladi (`web/src/funnel.ts` → `POST /api/events {event, src}`) — o'yin shu qurilmada birinchi ochildi (`visit`), 1-daraja (`level1`), 3 ta daraja (`level3`), birinchi kunlik masala (`daily1`), boshqa kuni qaytib ochildi (`return`); `src` — `web` yoki `tg`. Server kun bo'yicha faqat sonini oshiradi (`stats_daily`): qurilma, o'yinchi, IP va boshqa ma'lumot saqlanmaydi. Qaysi bosqich yuborilgani faqat qurilmaning o'zida (`lg.funnel.v1`); 2.22.0 dan oldin o'ynagan qurilmalar hisoblanmaydi. Bot admin'ga haftalik hisobotda va `/stats` da 7 kunlik voronkani ko'rsatadi — har bosqich soni va birinchi ochganlarga nisbatan ulushi («Profil ochdi» — serverdagi yangi profillar). Bir IP dan: 80 tagacha birdaniga, keyin 2 soniyada bitta.

### Brauzer xatolari

O'yin (faqat build'da) kutilmagan xatolarni — `error` va `unhandledrejection` — `POST /api/client-errors` ga yuboradi (`web/src/errors.ts`). Faqat o'yinning o'z kodidagi (stekda `<sayt>/assets/…`) xatolar: brauzer kengaytmalari, Telegram skripti, tarmoq uzilishlari va ma'lum shovqinlar (`ResizeObserver loop`, `Script error.`) yuborilmaydi; bir sahifada ko'pi bilan 5 ta, har biri bir marta. Yuboriladi: xabar, stek, ekran nomi (marshrutning birinchi qismi — sinf yoki masala kodisiz), versiya, brauzer (User-Agent), Telegram ichidami. O'yinchi, IP, natijalar yuborilmaydi.

Server (`server/internal/api/clienterr.go`) ularni `level=ERROR msg="brauzer xatosi"` qilib log'ga yozadi — bot admin'ga ogohlantiradi; xabarda server xatolari va brauzer xatolari alohida qatorlarda (tashqaridan kelgan matn server xatosini yashirmasin). Bir xil xato (xabar + stekdagi birinchi `fayl:qator:ustun`) 6 soatda bir marta yoziladi, orada nechta takrorlangani keyingi yozuvda (`repeat=`). Bir IP dan: 5 tagacha birdaniga, keyin daqiqada bitta. Ko'rish: `docker logs <konteyner> 2>&1 | grep "brauzer xatosi"`.

## Tillar

O'zbekcha (standart) va ruscha. Til bosh sahifadagi va sozlamalardagi tugma bilan almashtiriladi, `lg.settings.v1` da saqlanadi. Interfeys matnlari — har til o'z faylida: `web/src/i18n-uz.ts` va `web/src/i18n-ru.ts` (`ru: Dict`, `Dict = typeof uz`, shuning uchun kalit tushib qolsa TypeScript xato beradi). Darajalar va bo'limlar tarjimasi — `levels/i18n.ru.mjs`; `node levels/build.mjs` ularni `levels.json` ga `i18n.ru` sifatida qo'shadi va har bir daraja tarjima qilinganini tekshiradi. Server faqat xato kodlarini qaytaradi, matnlar mijozda.

Lug'atlar alohida bo'laklarda — ochilishda faqat kerakli til yuklanadi (`web/src/i18n.ts`: `loadLang`, `setLang`):

- `t` hamma joyda sinxron, lekin birinchi lug'at kelguncha bo'sh: ilova lug'at tayyor bo'lgachgina chiziladi (`main.tsx` → `langReady`), o'yinchi boshqa tildagi matnni ko'rmaydi. Shuning uchun modul yuklanayotganda (funksiyadan tashqarida) `t` dan o'qimang.
- `public/theme.js` ochilish tilini `state.ts` dagi tartibda taxmin qilib (havoladagi `?lang=`, saqlangan til, birinchi ochilishda — Telegram yoki brauzer tili), lug'atni asosiy JS bilan parallel so'rab qo'yadi. Fayl manzillari index.html dagi `theme.js` tegida (`data-dict-uz`, `data-dict-ru` — `vite.config.ts` yozadi). Taxmin tartibi `lang-detect.test.ts` da tekshiriladi.
- Til almashtirilganda avval lug'at yuklanadi, keyin tanlov saqlanadi (`lang-switch.ts`); yuklanmasa — eski til qoladi va xabar chiqadi. Service worker ikkala lug'atni ham oldindan keshlaydi: o'rnatilgan o'yinda til oflayn ham almashadi.
- Testlarda ikkala lug'at oldindan yuklanadi (`web/src/test-setup.ts`), shuning uchun `setLang` u yerda darhol almashtiradi.

## Do'stlar masalasi

Qum qutida yig'ilgan sxemadan «Masala qilish» masala yaratadi: uning haqiqat jadvali — vazifa, muallif ishlatgan elementlar soni — maqsad, ruxsat etilgan elementlar — muallif ishlatganlari. Masala butunlay havolaning o'zida (`#/p/<kod>`, ~150 belgi): ixcham JSON → base64url. Server va baza ishtirok etmaydi; natijalar faqat qurilmada (`lg.custom.v1`). Havola o'qilganda qat'iy tekshiriladi, buzilgan bo'lsa xabar chiqadi.

## Mavzular va shriftlar

O'yin uslubi — "ustaxona": tuzilma bitta, ranglar mavzuga qarab. Sozlamalarda **Plata** (qorong'i, sukut bo'yicha: yashil plata, mis yo'llar, sariq chiroq), **Haqiqiy plata** (lak ostidagi yo'llar, oltin kontaktlar, qora mikrosxemalar, svetodiod), **Daftar** (yorug': katakli qog'oz va siyoh — kunduzi va sinfda proyektorda qulay), **Chizma** (muhandislik chizmasi: oq qog'oz, qora chiziq, yoniq sim qizil) va **Avto** (telefon yoki Telegram rejimiga qarab: Daftar yoki Plata).

- Ranglar faqat `web/src/styles.css` boshidagi o'zgaruvchilarda: `:root, [data-theme='plata']` — Plata, qolganlari — `[data-theme='daftar' | 'haqiqiy' | 'chizma']` (atribut bo'yicha: Sozlamalardagi mavzu namunasi `<span data-theme>` orqali shu bloklardan rang oladi). Qolgan CSS'da (shu jumladan `screens/*.css`) qattiq yozilgan rang bo'lmasligini va har mavzu barcha o'zgaruvchilarni belgilashini `theme.test.ts` tekshiradi; yangi rang kerak bo'lsa — barcha mavzularga o'zgaruvchi qo'shing. Shu test har mavzuda matn va fon kontrastini ham hisoblaydi (WCAG AA: `--text`, `--muted` — 4,5:1, `--dim` — 3:1, tugma yozuvi `--accent-ink` / `--accent`, `--gold-ink`, `--bad`, `--good`).
- Yangi mavzu qo'shish: `theme.ts` (`Theme`, `THEMES`, `THEME_BG`), `state.ts` (`cleanSettings`), `public/theme.js` (birinchi chizishdan oldingi atribut), `styles.css` (rang bloki), `i18n-uz.ts` va `i18n-ru.ts` (`settings.themes`, `themeHint`). Mavzular faqat rang bilan farq qilishi kerak; shaklga ta'sir qiladigan ikki istisno `activeTheme` ni o'qiydi — Haqiqiy plata'da maydondagi element mikrosxema (`GateShape` ning `chip` xossasi; palitra va tavsiflarda belgi qoladi), Chizma'da simlar to'g'ri burchakli (`routeD` da burchak kesigi 0). Yangi mavzuni brauzerdagi tutun testiga ham qo'shing (`web/scripts/ui-smoke.mjs` dagi `THEMES`; yuqorida — «Lokal ishga tushirish»).
- Kam ochiladigan ekranlarning uslublari o'z faylida (`web/src/screens/<Ekran>.css`, ekran fayli import qiladi) — ekran `lazy()` bilan yuklanganda uslubi ham birga keladi va bosh yuklamaga kirmaydi. `--on` — signal 1 (sim, chiroq), `--accent` — interfeysdagi asosiy tugma; shaffof variant uchun `rgba(var(--on-rgb), 0.2)`.
- Bloklar hoshiya bilan emas, sirt tusi bilan ajraladi: `--bg` (sahifa) → `--bg2` (karta, panel) → `--panel` (karta ustidagi tugma, plitka) → `--raise` (ustiga kelganda). To'liq hoshiya kerak bo'lsa — `border: 1px solid var(--edge)`: Plata'da shaffof, Daftar'da ingichka chiziq. `--line` — faqat ajratuvchi chiziq va kiritish maydoni. Urg'uli fon (xabar, joriy qator, faol holat) — `--accent-soft`. Plata'da urg'u rangi bitta (sariq: `--accent`, `--on`, yulduzlar); `--copper` — faqat yo'llar va kontaktlar. Mono shrift — faqat raqam, formula va kodlarda.
- `web/public/theme.js` mavzuni birinchi chizishdan oldin qo'yadi (CSP inline skriptga ruxsat bermaydi), keyin `src/theme.ts` boshqaradi: `<html data-theme>`, brauzer paneli rangi, Telegram oynasi ranglari.
- Brauzerning o'z oynalari (`confirm`, `alert`, `prompt`) ishlatilmaydi — mavzuga mos emas, tugmalari brauzer tilida, Telegram ichida ishonchsiz. O'rniga `web/src/components/Dialogs.tsx`: `askConfirm({ title, text, note, ok, danger, icon })` → `Promise<boolean>` (o'chiradigan amalda `danger`: qizil tugma, fokus «Bekor qilish» da) va `showCopy(text)` (avtomatik nusxalab bo'lmagan matn). Ikkalasini ilovadagi bitta `ConfirmHost` (`app.tsx`) chizadi, boshqa ekranga o'tilsa ochiq savol «yo'q» bilan yopiladi. Oyna boshqa `Modal` ustida ham ochilishi mumkin: Esc va Tab faqat eng ustidagisida ishlaydi. `src/dialogs.test.ts` kodda brauzer oynasi qolmaganini tekshiradi.
- Animatsiya — Sozlamalarda **Avto** (sukut bo'yicha), **Yoqilgan**, **O'chirilgan**; `<html data-motion>` (`theme.ts`, `theme.js`). Qurilmaning "kamroq harakat" sozlamasi (Windows'da "Animatsiya effektlari" o'chiq — ishxona kompyuterlarida ko'p uchraydi) Avto'da faqat CSS bezaklarini o'chiradi; tekshiruv qatorma-qator o'ynayveradi, faqat «O'chirilgan» da darhol. Sababi — `DECISIONS.md`. CSS'da `prefers-reduced-motion` faqat bitta joyda bo'lishi kerak (`theme.test.ts`), aks holda «Yoqilgan» uni bekor qila olmaydi.
- Shriftlar — IBM Plex Sans va Plex Mono (`@fontsource`, o'z serverimizdan). Har alifbo `unicode-range` bilan faqat kerak bo'lganda yuklanadi; service worker shriftni birinchi yuklanishda keshga qo'yadi (versiyalar orasida saqlanadi).
- Maydon: simlar plata yo'li kabi — faqat gorizontal, vertikal va 45° qismlar (`geometry.ts` → `wireRoute`, burchaklar `routePath` da kesiladi); kirishlar — tumbler (qiymat dasta ichida), chiqishlar — chiroq. Plata'da yoniq yo'l ostida yorug'lik, Daftar'da — sariq marker, siyoh chiziq, katakli qog'oz va biroz "qo'lda chizilgan" chiziqlar (SVG filtri `#sketch`; sudrash, surish va masshtab paytida o'chadi — telefon sekinlashmasin).
- Bosh ekran: tepada ishlaydigan sxema (`components/HeroGate.tsx` — ikki tumbler, AND va chiroq; maydondagi elementlar va klasslarning o'zi, holati saqlanmaydi), navbatdagi daraja katta sarlavha bilan (`components/MiniBoard.tsx` — uning kichik sxemasi: pinlar va o'yinchining qoralamasi; yechim hech qachon ko'rsatilmaydi), yulduzlar chizig'i va bitta asosiy tugma; kunlik masala, arxiv, taklif va Telegram — bitta ro'yxatdagi qatorlar; pastki panel. 900 px dan keng ekranda ikki ustun: chapda o'yin, o'ngda ro'yxat. Til — burchakdagi tugma, qo'llanma havolasi — sozlamalarda.
- Darajalar xaritasi (`levelmap.ts`): bo'lim ichida "ilon" tartibi — ustunlar soni sig'adiganining eng kattasi va iloji bo'lsa darajalar soniga bo'linadigan; har daraja keyingisiga o'ngga, chapga yoki pastga qisqa yo'l bilan ulanadi. Xaritada birinchi marta ko'rilgan yechimlar (`lg.mapSeen.v1`) yo'lni animatsiya bilan "yoqadi".
- Ikonkalar — `components/ui.tsx` dagi `ICONS` (24×24, chiziqli). Interfeysda emoji ishlatilmaydi; faqat ulashish matnlarida (Telegram xabari) qoladi.

## Qidiruv tizimlari (SEO)

O'yin hash marshrutli SPA — Google va Yandex undan faqat bosh sahifani ko'radi. Shuning uchun build oxirida `web/scripts/pages.mjs` oddiy HTML sahifalar yozadi (JavaScript'siz o'qiladi):

- `/ikkilik-sanoq-sistemasi/` va `/ru/dvoichnaya-sistema/` — ikkilik sanoq sistemasi: o'nlikdan ikkilikka va qaytib, 0–15 jadvali, ikkilikda qo'shish (misollar `pages-binary.mjs` da hisoblanadi) va bitlarni bosib sonni ko'radigan o'yinchoq (`public/guide-binary.js`). Qo'llanmalar bir-biriga sarlavhadagi menyu orqali bog'langan.
- `/oqituvchilar/` va `/ru/uchitelyam/` — o'qituvchilar uchun: sinf rejimining imkoniyatlari, qanday boshlash (4 qadam), 3 ta dars ishlanmasi (maqsadlar, 45 daqiqalik bosqichlar, darsdagi va uyga beriladigan darajalar, baholash) va savol-javob. Matnlar — `pages-teachers.mjs`; darajalar id bo'yicha, raqami va nomi build'da `levels.json` dan (test: id lar haqiqiy, bosqichlar yig'indisi 45, uz/ru darslari bir xil darajalar bilan). O'yindagi o'qituvchi ekranida shu sahifaga havola.
- `/sanoq-sistemalari/` va `/ru/sistemy-schisleniya/` — sanoq sistemalari: 2–16 asoslar orasida o'tkazish kalkulyatori (usulni o'zi tanlaydi: 10 dan — bo'lish, 10 ga — yoyish, 2 ↔ 8/16 — bitlarni guruhlash, qolganlari — 10 orqali; yechim bosqichlari bilan, 2⁶⁴ gacha, BigInt), 0–16 jadvali va uch usulning misollari. Mantiq va yechim HTML'i — `scripts/numbase.mjs` (build'da misollar, brauzerda `guide-base-ui.js` bilan `dist/guide-base.js`); matnlar — `pages-base.mjs`.
- `/bul-algebrasi/` va `/ru/algebra-logiki/` — Bul algebrasi: amallar va yozuvlari, qonunlar jadvali, De Morgan, soddalashtirish qadamlari, jadvaldan formula (MDNSh), Karno kartasi va haqiqat jadvali kalkulyatori (ikki ifodani solishtiradi). Matnlar — `pages-bool.mjs`; ifoda o'qigich — `src/boolexpr.ts` (o'yin bilan umumiy): build'da misollarni hisoblaydi va tekshiradi (har bir qonun va qadam haqiqatan teng; misol birorta darajaning jadvali emas), brauzerga esa `guide-bool-ui.js` bilan birga `dist/guide-bool.js` bo'lib chiqadi. Kalkulyator ostidagi tugma ifodani o'yindagi Qum qutida sxema qilib ochadi.
- `/mantiqiy-elementlar/` va `/ru/logicheskie-elementy/` — mantiqiy elementlar qo'llanmasi: belgisi (o'yindagi `src/board/shapes.ts` dan), formulasi, haqiqat jadvali, D-trigger, Bul algebrasi qonunlari, o'yin bo'limlari (`levels/levels.json` dan). Matnlar — `web/scripts/pages-content.mjs`, maktab atamalari bilan (inkor, konyunksiya, dizyunksiya…).
- `robots.txt` (`/api/` yopiq) va `sitemap.xml` (11 ta manzil) — manzil `VITE_SITE_URL` dan.

Bosh sahifada `canonical`, kengaytirilgan `description` va schema.org (`WebApplication`) bor; o'yinning bosh ekranida qo'llanmaga havola (Telegram ichida yashirin). Go server papkadagi `index.html` ni beradi, sleshsiz manzilni sleshliga yo'naltiradi; Nginx'da `try_files $uri $uri/index.html /index.html`.

Saytni Google Search Console va Yandex Webmaster'ga qo'shish (domen egasi tasdiqlaydi) va u yerda `https://logic.noesis.uz/sitemap.xml` ni yuborish — indekslashni tezlashtiradi. Tasdiqlash fayllari — `web/public/google*.html` va `web/public/yandex_*.html`: ularni o'chirmang, Google va Yandex vaqti-vaqti bilan qayta tekshiradi.

## Sinf rejimi (o'qituvchilar uchun)

Sozlamalar → «O'qituvchilar uchun: sinf yaratish» (`#/teacher`). O'qituvchi sinf nomini kiritadi va ikki narsa oladi:

- **sinf kodi** (6 belgi, ochiq) va havola `#/class/<kod>` — o'quvchilarga yuboriladi (Telegram'da `startapp=c_<kod>`); o'quvchi taxallusi bilan qo'shiladi va sinfdoshlar reytingini ko'radi;
- **o'qituvchi kaliti** (tiklash kodi kabi 16 belgi) — hisobot va boshqaruv uchun; shu qurilmada saqlanadi (`lg.teacher.v1`), serverda faqat SHA-256 xeshi. Boshqa qurilmada «Kod va kalit bilan qo'shish»; Telegram ichida kalitlar Telegram bulutiga ham yoziladi (`teacher` kaliti) va boshqa qurilmadagi Telegram'da ro'yxat o'zi to'ladi. «Progressni o'chirish» kalitlarni ham o'chiradi (ogohlantirish bilan) — umumiy kompyuterda keyingi foydalanuvchi hisobotni ocholmasin.

**Vazifalar.** Hisobotda «Yangi vazifa»: o'qituvchi 1–12 ta darajani belgilaydi, istasa nom va muddat qo'yadi (sinfda 20 tagacha vazifa). O'quvchi vazifani bosh sahifada ko'radi («Sinf vazifasi», bajarilmagan va muddati o'tmaganlardan eng yaqini) va sinf sahifasida — hammasini. Vazifadagi darajalar o'quvchiga yulduzlar yetmasa ham ochiq (ro'yxat qurilmada `lg.tasks.v1` da, oflayn ham ishlaydi). O'qituvchi har vazifa bo'yicha nechta o'quvchi bajarganini va kim hali bajarmaganini ko'radi.

**Sinf musobaqasi** (2.23.0). Hisobotda «🏁 Musobaqa boshlash»: o'qituvchi 1–12 ta darajani va vaqtni (5–45 daqiqa; server 3–120 ni qabul qiladi) tanlaydi, istasa nom qo'yadi. Sinfda bir vaqtda bitta musobaqa; o'qituvchi uni muddatidan oldin tugata oladi, sinfda oxirgi 20 tasi natijalari bilan saqlanadi. «Proyektorda ochish» (`#/contest/<kod>` — sinf kaliti shu qurilmada bo'lsa): katta taymer va har daraja bo'yicha yulduzlar jadvali, 4 soniyada yangilanadi, «To'liq ekran». O'quvchi musobaqani bosh sahifadagi e'londan (sinf a'zosining bosh sahifasi 20 soniyada musobaqa bor-yo'qligini so'raydi) yoki sinf sahifasidan ochadi: taymer, darajalar va reyting (8 soniyada yangilanadi). Musobaqa darajasi (`#/contest/<kod>/<daraja>`) **bo'sh maydondan** boshlanadi va yulduzlar yetmasa ham ochiq; yechim oddiy progressga ham yoziladi, musobaqaga esa aynan shu sxema yuboriladi (`POST /api/classes/{code}/contests/{id}/solve`) — server qayta tekshiradi, eng yaxshisini saqlaydi; oldin yechilgan darajaning saqlangan sxemasi hisobga o'tmaydi. Reyting: ko'p yulduz, keyin ko'p daraja, keyin avvalroq erishgan. Tugash vaqti server javobidagi «qolgan soniyalar» dan hisoblanadi (qurilma soati noto'g'ri bo'lsa ham to'g'ri); tugagach 15 soniya ichida kelgan yechim (tarmoqda kechikkan) qabul qilinadi.

**Tarqatma** (2.24.0). Sinf sahifasida «QR-kod va tarqatma» (`#/teacher/<kod>/handout`): sinf havolasining QR-kodi bilan A4 plakat (devorga yoki proyektorga — o'qituvchi kaliti bu sahifada yo'q) va qirqib tarqatiladigan 8 ta kartochka (2 × 4). «Chop etish» — chetlarsiz A4 (`@page handout`), varaq ekranda ham qog'ozdagidek (o'lchamlar varaq eniga nisbatan, `cqw`; ranglar — doim yorug' «Daftar»). QR-kod o'zimizniki (`web/src/qr.ts`, bayt rejimi, 1–10 versiya, M daraja) — kutubxonasiz; sinf havolasi 3-versiyaga (29×29) sig'adi.

**Hisobotni chiqarish.** Jadval ostida: «Excel (CSV)» — fayl (UTF-8 BOM, `;` ajratgich: Excel o'zbek/rus sozlamalarida shuni kutadi), «Jadvalni nusxalash» — TSV, Excel yoki Google Sheets'ga to'g'ridan-to'g'ri qo'yiladi (Telegram ichida ham ishlaydi), «Chop etish» — faqat hisobot va vazifalar, yorug' mavzuda. Ustunlar: o'quvchi, yulduzlar, darajalar, har bo'lim bo'yicha yechilganlar, bugungi va 7 kunlik kunlik masalalar, oxirgi kirish sanasi, har vazifa bo'yicha yechilgan darajalar. `=`, `+`, `-`, `@` bilan boshlangan matn formula bo'lib qolmasligi uchun oldiga `'` qo'yiladi.

Hisobot (`#/teacher/<kod>`): o'quvchi, yulduzlar, darajalar, har bir bo'lim bo'yicha yechilganlar (rang to'yinganligi bilan), bugungi kunlik masala, 7 kunda yechilgan kunlik masalalar, oxirgi faollik (Toshkent kalendar kunlari bo'yicha); o'quvchini chiqarish va sinfni o'chirish (natijalar o'quvchilarda qoladi). Dars paytida hisobot daqiqada bir marta va sahifaga qaytilganda o'zi yangilanadi. Boshqa qurilmada o'chirilgan sinf «ro'yxatdan olib tashlash» bilan tozalanadi. Sinfda 200 tagacha o'quvchi; bir IP dan sinf yaratish — 2 daqiqada 1 ta (5 tagacha birdaniga).

## Sertifikat

Yutuqlar ekranining tepasida «Sertifikat» (`#/certificate`, `web/src/certificate.ts`, `screens/CertificateScreen.tsx`). Birinchi bo'lim to'liq yechilgach ochiladi; unda: ism (sertifikat uchun alohida maydon — sukut bo'yicha taxallus, faqat qurilmada `lg.certName.v1`), tugatilgan bo'limlar (belgi bilan), yulduzlar va yechilgan darajalar, sana (Toshkent), sayt. Hamma darajalar yechilsa — «kursning barcha N darajasini yechdi». Bo'lim aynan shu yechim bilan tugasa, natija oynasida «Bo'lim tugadi — sertifikat» tugmasi chiqadi.

Chizish — canvas'da (1600×1131, A4 yotiq), har doim Daftar ranglarida va plata yo'llari bilan; shriftlar (IBM Plex) yuklangach chiziladi. «PNG yuklab olish», «Ulashish» (Web Share bilan fayl — telefonda), «Chop etish» (faqat sertifikat). Telegram ichida yuklab olish va chop etish ishlamaydi — u yerda ekran rasmi haqida izoh. Sertifikat imzolanmagan: bu rag'bat uchun; o'qituvchi natijani sinf hisobotida ko'radi.

## Tartibga keltirish

Maydonning o'ng pastidagi tugmalar ichida (zoom yonida) «Tartibga keltirish» — `web/src/board/tidy.ts`: elementlar kirishdan chuqurligi bo'yicha ustunlarga (D-trigger chiqishi manba kabi — teskari bog'lanish halqa bo'lmaydi), ustun ichida — manbalari ro'parasida, chiqish pin'iga ulangan element esa aynan pin ro'parasida (chiqishga boradigan sim to'g'ri chiziq), ustma-ust tushmaydi. Element uchlari va daraja pinlari 12 lik to'rda turadi (`shapes.ts`, `geometry.ts`; testda tekshiriladi) — shuning uchun ro'para qo'yilgan elementlar orasidagi sim pog'onasiz. Simlar o'zgarmaydi, faqat joylar; «Bekor qilish» bilan qaytariladi. Darajada chiqishlar joyiga sig'dirishga harakat qiladi (ustunlar orasi 144 dan 108 gacha qisqaradi), sig'masa chiqishlar ustuni o'ngga suriladi. Formuladan sxema ham shu joylashni ishlatadi.

## Formuladan sxema (Qum quti)

Qum qutida «Formuladan sxema» (yuqoridagi ƒ× tugmasi yoki yon paneldagi tugma): Bul ifodasi yoziladi va sxema o'zi yig'iladi (`src/formula-build.ts`). Ifoda o'qigich — `src/boolexpr.ts`: «Bul algebrasi» qo'llanmasidagi kalkulyator bilan bitta fayl (build `node:module` `stripTypeScriptTypes` bilan undan `dist/guide-bool.js` yasaydi). Qoidalar:

- ifoda 400 belgigacha (uzunrog'i — xabar: o'qigich rekursiv va har tugmada qayta hisoblaydi); `NAND`, `NOR`, `XNOR` so'z bilan ham yoziladi;
- konstantalar soddalashtiriladi (`A ∧ 1 = A`); butun ifoda doimiy bo'lsa — xabar (maydonda 0/1 manbai yo'q);
- `¬(A ∧ B)` → bitta NAND (NOR, XNOR ham), bir xil qism-ifodalar bir marta yig'iladi;
- kirishlar A–E: boshqa harflar (x, y…) tartib bilan A, B… ga almashtiriladi va bu oynada aytiladi; 5 tadan ortiq — xato;
- joylash — «Tartibga keltirish» bilan bir xil (`board/tidy.ts`); chuqur sxemada chiqishlar ustuni o'ngga suriladi;
- maydondagi kirish/chiqishlar soni kamaytirilmaydi: «Bekor qilish» eski sxemani yaroqli holda qaytaradi.

Havola: `#/sandbox/<encodeURIComponent(ifoda)>` — Qum quti shu formula bilan oynani ochadi (manzil `#/sandbox` ga qaytariladi). Qo'llanmadagi «Sxemasini o'yinda yig'ish →» tugmasi shu havolani birinchi ifoda bilan yangilab boradi. Test (`formula-build.test.ts`) har bir misolda yig'ilgan sxemaning simulyatordagi jadvali ifodaning o'zi bilan bir xilligini tekshiradi.

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

## Telefonga o'rnatish

O'yin — PWA (`public/manifest.webmanifest` + service worker). Chrome/Edge/Android `beforeinstallprompt` hodisasini beradi: `web/src/install.ts` (main.tsx da erta import qilinadi) uni ushlaydi, bosh sahifada (kamida 2 daraja yechgan o'yinchiga; yopilsa — 30 kun ko'rsatilmaydi, `lg.installDismissed.v1`) va Sozlamalarda «O'rnatish» tugmasi tizim oynasini chaqiradi. iPhone/iPad'da hodisa yo'q — Sozlamalarda «Ulashish → Bosh ekranga qo'shish» izohi. O'rnatilgan ilovada (`display-mode: standalone`) va Telegram ichida ko'rsatilmaydi. Manifestdagi `shortcuts` — ikonkani bosib turilganda: kunlik masala, darajalar, Qum quti.

## Oflayn rejim

HTTPS'da (va `localhost` da) `dist/sw.js` service worker ro'yxatdan o'tadi: birinchi ochilishdan keyin o'yin internetsiz ham ochiladi. `sw.js` build oxirida `web/scripts/sw.mjs` tomonidan `sw.template.js` dan yoziladi (fayllar ro'yxati + mazmun xeshi). Har deploy'da xesh o'zgaradi — brauzer yangi versiyani o'zi o'rnatadi va eski keshni o'chiradi. Server 5xx qaytarsa (masalan, deploy paytida proksi 502), sahifa o'rniga keshdagi o'yin ochiladi. Shriftlar alohida `lg-fonts` keshida — yangi versiyada qayta yuklanmaydi. Qo'llanma sahifalari va ularning skriptlari (`lg-pages`) avval tarmoqdan olinadi, nusxasi keshga yoziladi: bir marta ochilgan qo'llanma internetsiz ham ochiladi, hali ochilmagani o'rniga o'yin emas, qisqa oflayn xabar chiqadi. `vite dev` da service worker yo'q.

Favqulodda holatda (service worker buzilgan bo'lsa) foydalanuvchilarga "sayt ma'lumotlarini tozalash"ni maslahat bermang — natijalar ham o'chadi. Buning o'rniga `sw.js` ni o'zini o'chiradigan versiya bilan deploy qiling (`self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', () => self.registration.unregister());`): brauzer `sw.js` ni har ochilishda tekshiradi (`Cache-Control: no-cache`). Ishlab chiqishda: DevTools → Application → Service workers → Unregister.

## API

| Metod | Yo'l | Vazifa |
|---|---|---|
| POST | `/api/players` | `{nickname}` → `{id, nickname, code}` — yangi o'yinchi va tiklash kodi |
| GET | `/api/me` | profil (`Authorization: Bearer <kod>`) |
| PATCH | `/api/me` | `{nickname}` — taxallusni o'zgartirish |
| GET | `/api/me/devices` | Telegram orqali kirgan qurilmalar: `{devices: [{id, label, createdAt, usedAt, current}], viaCode}` |
| DELETE | `/api/me/devices/{id}` | qurilmani profildan chiqarish (shu qurilmaning o'zini emas — 400 `current_device`) |
| POST | `/api/me/logout-others` | `{code}` — tiklash kodi shu yangisiga almashadi, barcha qurilma kalitlari o'chadi |
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
| POST | `/api/client-errors` | `{msg, stack, route, version, ua, tg}` — o'yindagi kutilmagan xato (javob 204; log'ga ERROR, bot ogohlantiradi) |
| POST | `/api/classes/{code}/tasks` | `{title, levels, due}` — o'qituvchi vazifa beradi (kalit bilan); `due` — Toshkent kuni, 0 — muddatsiz |
| DELETE | `/api/classes/{code}/tasks/{id}` | o'qituvchi vazifani o'chiradi (kalit bilan) |
| POST | `/api/classes/{code}/contests` | o'qituvchi musobaqa boshlaydi: `{title, levels, minutes}` (kalit bilan; davom etayotgani bo'lsa 409) |
| POST | `/api/classes/{code}/contests/{id}/stop` | o'qituvchi musobaqani tugatadi (kalit bilan) |
| GET | `/api/classes/{code}/contest/teacher` | oxirgi musobaqa va reyting — proyektor (kalit bilan) |
| GET | `/api/classes/{code}/contest` | oxirgi musobaqa va reyting — o'quvchi (a'zo, token) |
| POST | `/api/classes/{code}/contests/{id}/solve` | o'quvchining musobaqadagi yechimi: `{level, circuit}` → yulduz, o'rin |
| POST | `/api/events` | o'yinchilar voronkasi bosqichi: `{event, src}` (204) |
| GET | `/healthz` | holat tekshiruvi |

Cheklovlar (bitta maktab NAT manzili ortidagi 40 o'quvchili sinfga mo'ljallangan): Go'da IP bo'yicha 20 so'rov/s (400 tagacha portlash), yangi o'yinchi — 30 soniyada 1 ta (50 tagacha birdaniga), noto'g'ri tiklash kodi yoki topilmagan sinf kodi — 5 soniyada 1 ta (10 tagacha); IPv6 manzillar /64 tarmog'i bo'yicha hisoblanadi, `X-Real-IP` faqat haqiqiy IP bo'lsa olinadi; Nginx'da 20 so'rov/s. So'rov tanasi 64 KB gacha, sxemada 64 tagacha element va 256 tagacha sim; yechim ixcham ko'rinishda saqlanadi (element id `g1…gN`, butun koordinatalar, 8 KB gacha — oshsa 400 `circuit_too_large`). Ro'yxatdan o'tish cheklovi faqat profil yaratiladigan so'rovdan olinadi (rad etilgan taxallus uni sarflamaydi). Reyting fonda ko'pi bilan 15 soniyada bir marta qayta hisoblanadi (taxallus va yechimlar uni majburlay olmaydi), o'yinchining o'z o'rni har so'rovda; kunlik arxiv statistikasi 60 soniya keshlanadi. Mijoz javobni kutmay uzilsa — 499, xato sifatida log'ga yozilmaydi. 90 kundan beri kirmagan va hech narsasi (yechim, kunlik natija, sinf, Telegram) yo'q profillar kunda bir marta o'chiriladi.

## Xavfsizlik

- Tiklash kodi 80 bitli tasodifiy son; bazada faqat uning SHA-256 xeshi saqlanadi.
- Yechimlar serverda qayta tekshiriladi: mijoz yuborgan yulduz soniga ishonilmaydi.
- Go server faqat `127.0.0.1` da tinglaydi va `X-Real-IP` ni faqat lokal manzildan kelgan so'rovda qabul qiladi.
- systemd xizmati alohida foydalanuvchi nomidan, faqat o'qish uchun fayl tizimi va cheklangan huquqlar bilan ishlaydi.
- Nginx CSP, `X-Frame-Options`, `nosniff` sarlavhalarini qo'shadi.

## Litsenziya

[MIT](LICENSE.md) — kodni istalgan maqsadda (tijoratda ham) ishlatish, o'zgartirish va tarqatish mumkin; faqat mualliflik va litsenziya matni nusxalarda saqlanishi kerak. Kod kafolatsiz beriladi.
