# Qarorlar jurnali

Ishlab chiqish davomida qabul qilingan qarorlar. Yangilari pastga qo'shiladi.

## Savollarga javoblar (hammasi tavsiya bo'yicha)

| # | Savol | Qaror |
|---|---|---|
| 1 | O'yin nomi | Logic Gate |
| 2 | Mexanika | Kirishlar va haqiqat jadvali beriladi, o'yinchi elementlarni joylab simlar bilan ulaydi |
| 3 | Darajalar | 30 ta, 5 bo'lim × 6 daraja |
| 4 | Ketma-ket sxemalar | 1-versiyada yo'q, faqat kombinatsion |
| 5 | Baholash | element soni ≤ maqsad → 3★, ≤ maqsad+2 → 2★, yechildi → 1★ |
| 6 | Qum quti rejimi | Bor |
| 7 | Ro'yxatdan o'tish | Ro'yxatsiz: taxallus + tiklash kodi |
| 8 | Reyting | Umumiy yulduzlar bo'yicha top-50 + har daraja uchun eng kam element |
| 9 | Til | O'zbekcha (lotin), matnlar bitta faylda — keyin tillar qo'shish oson |
| 10 | Dizayn | Qorong'i "elektron plata" uslubi, nur sochadigan simlar |
| 11 | Ovoz | WebAudio orqali kodda yaratiladi, musiqa yo'q |
| 12 | Domen | Hozircha yo'q: avval IP orqali HTTP, domen bo'lsa skript HTTPS'ni yoqadi |
| 13 | Server | Ubuntu 24.04, 1 vCPU / 1 GB RAM, faqat shu o'yin uchun |
| 14 | Deploy | Skript va ko'rsatma tayyorlanadi, foydalanuvchi o'zi ishga tushiradi |
| 15 | Go | winget orqali o'rnatildi |

## Texnik qarorlar

- **Go moduli repozitoriy ildizida** (`go.mod`), backend kodi `server/` ichida. Sabab: `go:embed` yuqori papkadagi fayllarni ololmaydi, `levels/levels.json` esa frontend va backend uchun umumiy bo'lishi kerak. Shuning uchun `levels/` ham Go paketi (faqat `embed`).
- **Darajalar manbasi `levels/source.mjs`** (JS funksiyalar ko'rinishida), `levels/build.mjs` undan `levels.json` (haqiqat jadvallari) va `solutions.json` (faqat testlar uchun) yaratadi. Mos yozuvdagi yechimlar brauzerga yuborilmaydi.
- **Haqiqat jadvali formati:** har bir chiqish uchun `2^n` uzunlikdagi "0"/"1" qatori. `r`-qatorda `k`-kirish qiymati `(r >> (n-1-k)) & 1` — ya'ni birinchi kirish eng katta bit.
- **"Maqsad" soni** — mos yozuvdagi yechimdagi elementlar soni. U har doim ham isbotlangan minimum emas; o'yinchi kamroq element bilan yechsa ham 3★ oladi va reytingda ko'rinadi.
- **Barcha elementlar ikki kirishli** (NOT — bir kirishli). Ko'p kirishli elementlar yo'q: masalalar qiziqroq va simulyator soddaroq.
- **Tekshiruv qat'iy:** barcha chiqishlar va barcha element kirishlari ulangan bo'lishi, sikl bo'lmasligi shart. Jonli rejimda ulanmagan kirish 0 deb hisoblanadi.
- **Yechimni server qayta tekshiradi** (Go simulyatori), mijozdan kelgan yulduz soniga ishonilmaydi.
- **SQLite bitta ulanish bilan** (`SetMaxOpenConns(1)`), WAL rejimi, kesh ~2 MB. Kichik yukda `SQLITE_BUSY` bo'lmaydi va xotira tejaladi.
- **Tiklash kodi = kirish tokeni.** 80 bitli Crockford base32 (`XXXX-XXXX-XXXX-XXXX`), bazada SHA-256 xeshi. Kiritishda O→0, I/L→1 almashtiriladi.
- **Rate limit Go ichida, xotirada** (token bucket, IP bo'yicha) + Nginx `limit_req`. Redis kabi qo'shimcha xizmat kerak emas.
- **Reyting 15 soniya keshlanadi**, natija yaxshilanganda kesh tozalanadi.
- **`last_seen_at` soatiga ko'pi bilan bir marta yoziladi** — diskka keraksiz yozuvlar bo'lmasin.
- **Zaxira nusxa `logicgate backup` buyrug'i bilan** (`VACUUM INTO`): serverga `sqlite3` paketi kerak emas, ishlab turgan bazadan ham izchil nusxa olinadi.
- **Faqat gzip, brotli yo'q.** Ubuntu'ning standart Nginx'ida `gzip_static` bor, brotli moduli esa alohida paket talab qiladi. Fayllar build vaqtida siqiladi.
- **Docker ishlatilmaydi:** qo'shimcha RAM va murakkablik; bitta binar fayl + systemd yetarli.
- **1 GB swap** setup.sh da (agar swap bo'lmasa): 1 GB RAM'li serverda `apt` va certbot paytida xotira yetishmasligining oldini oladi.
- **Firewall SSH portini `sshd -T` dan oladi**, shunda nostandart portda o'zingizni bloklab qo'ymaysiz. `SKIP_UFW=1` bilan o'chirish mumkin.
- **Hash-marshrutlash** (`#/level/b1`): Nginx'da maxsus qoidalar kerak emas.
- **Port tanlash eng yaqin port bo'yicha** (DOM hit-test emas): barmoq uchun radius 24 px, sichqoncha uchun 12 px, element tanasi ustida 10 px. Kichik masshtabda ham portni topish oson.
- **Chiqish pinlari ustuni maqsadga qarab** (380 / 520 / 680 birlik): oddiy darajalar telefonda kattaroq ko'rinadi.
- **Ulanmagan chiqish neytral ko'rsatiladi** (qizil emas) — o'yin boshida ekran "xato" bilan to'lib ketmasin.
- **Qum qutida** 1–5 kirish, 1–4 chiqish, barcha elementlar; holat `localStorage` da.
- **Ovozlar WebAudio'da** sintez qilinadi: fayl yuklanmaydi, sozlamalarda o'chiriladi.
- **Shriftlar tizimniki** (monospace + system-ui): tashqi so'rov va qo'shimcha bayt yo'q.

## Haqiqiy server (2026-11-05)

eskiz.uz serveri (`170.168.6.82`, 4 vCPU / 8 GB, Ubuntu 24.04) toza emas: unda Coolify 4.6 (Traefik 80/443) va boshqa loyihalar ishlaydi, bo'sh RAM ~930 MB, swap to'liq band.

- **`setup.sh` bu serverda ishlatilmaydi:** Nginx 80/443 ni egallay olmaydi, `ufw` esa Coolify'ga xalaqit berishi mumkin. U faqat toza server uchun qoldi.
- **Joylash — Docker image + Coolify,** foydalanuvchining boshqa loyihalari kabi (`ghcr.io/shavkatbegmatov/...`).
- **Image serverda emas, GitHub Actions'da yig'iladi:** `modernc.org/sqlite` ni kompilyatsiya qilish 1–2 GB RAM talab qiladi, serverda esa bunchalik bo'sh xotira yo'q.
- **Konteynerda Nginx yo'q:** frontend'ni Go serverning o'zi uzatadi (`server/internal/web`) — `.gz` fayllar, kesh va CSP sarlavhalari bilan.
- **`LG_TRUST_PROXY=private`:** Traefik Docker tarmog'idan (xususiy IP) keladi, shuning uchun `X-Real-IP` faqat xususiy manzillardan qabul qilinadi. Busiz barcha o'yinchilar bitta IP bo'lib ko'rinib, rate limit hammaga birga ta'sir qilardi.
- **Asosiy image — `distroless/static:nonroot`** (~2 MB, shell yo'q). Health tekshiruvi uchun `logicgate health` buyrug'i qo'shildi.
- **Dockerfile'da `VOLUME` yo'q:** anonim volume qayta joylashda yo'qolib ketadi. `/data` ni Coolify'da nomli volume sifatida ulash kerak.
