# Logic Gate — loyiha rejasi

> Holat: 1-versiya tayyor (2026-11-05). Qabul qilingan qarorlar — `DECISIONS.md`, ishga tushirish va deploy — `README.md`.

## 1. Stek

### Backend variantlari (1 vCPU / 1 GB RAM uchun)

| Variant | Ishsiz RAM (taxminiy) | CPU | Ishlab chiqish | Deploy |
|---|---|---|---|---|
| **Go + net/http + SQLite** | 10–20 MB | juda past | o'rtacha | bitta binar fayl, serverga runtime kerak emas |
| Node.js 24 + Fastify + SQLite | 50–70 MB | past | tez | serverga Node o'rnatish kerak |
| Python + FastAPI + uvicorn | 60–90 MB | o'rtacha | tez | Python, venv, bog'liqliklar |

**Tanlov: Go.** RAM sarfi eng past, serverga hech narsa o'rnatilmaydi (Linux uchun Windows'dan cross-compile qilinadi), bitta binar fayl `systemd` ostida ishlaydi. SQLite uchun `modernc.org/sqlite` (sof Go, CGO kerak emas).

### Frontend variantlari

| Variant | Framework hajmi (gzip) | Izoh |
|---|---|---|
| **Vite + TypeScript + Preact** | ~4 KB | React'ga o'xshash, juda yengil |
| Vite + TypeScript, frameworksiz | 0 KB | menyular uchun ko'p qo'l mehnati |
| React | ~45 KB | keraksiz og'ir |

**Tanlov: Vite + TypeScript + Preact.** O'yin maydoni SVG'da chiziladi (ekranda aniq, sensorli boshqaruvga qulay, 200 tagacha element uchun tez). Build natijasi statik fayllar: server ularni faqat uzatadi, CPU sarflamaydi.

### Server qatlami
- **Nginx** (~5–10 MB RAM): statik fayllar, oldindan siqilgan `.gz` fayllar (`gzip_static`), uzoq muddatli kesh, `/api` → Go (127.0.0.1:8080).
- **certbot**: Let's Encrypt HTTPS.
- Docker ishlatilmaydi (qo'shimcha RAM va murakkablik).

### Resurs byudjeti
- Go jarayoni: ≤ 30 MB (systemd `MemoryMax=64M` bilan cheklanadi).
- Nginx: ≤ 15 MB.
- Frontend: JS + CSS ≤ 100 KB (gzip).

## 2. Arxitektura

```
Brauzer ──HTTPS──> Nginx ──┬── /            → web/dist (statik fayllar)
                           └── /api/*       → Go server (127.0.0.1:8080) ──> SQLite (data/logicgate.db)
```

- O'yin mantig'i (simulyator) to'liq brauzerda ishlaydi.
- Server faqat: o'yinchi, progress, yechimni qayta tekshirish (aldovga qarshi), reyting.
- Darajalar bitta `levels/levels.json` faylida. Frontend uni build vaqtida oladi, Go binar faylga `embed` orqali joylanadi.

## 3. Papka tuzilmasi

```
logic-gate/
├── levels/levels.json        # barcha darajalar (frontend va backend uchun umumiy)
├── web/                      # frontend
│   ├── src/sim/              # mantiqiy simulyator (sof TS, testlanadi)
│   ├── src/board/            # SVG sxema muharriri
│   ├── src/ui/               # ekranlar: menyu, bo'limlar, daraja, reyting
│   ├── src/api.ts            # backend bilan aloqa
│   └── index.html
├── server/                   # backend
│   ├── cmd/logicgate/        # main.go
│   ├── internal/sim/         # Go simulyator (yechimni tekshirish uchun)
│   ├── internal/store/       # SQLite, migratsiyalar
│   └── internal/api/         # HTTP handler'lar, rate limit
├── deploy/                   # systemd, nginx, setup.sh, backup.sh
├── PLAN.md, DECISIONS.md, README.md
```

## 4. O'yin mexanikasi

- Har bir darajada kirishlar (A, B, C…) va chiqishlar beriladi, kerakli natija haqiqat jadvali ko'rinishida ko'rsatiladi.
- O'yinchi palitradan elementlarni (AND, OR, NOT, XOR, NAND, NOR, XNOR) maydonga sudrab qo'yadi va portlarni simlar bilan ulaydi.
- Kirish tugmalarini bosib sxemani jonli sinash mumkin: simlar 1/0 holatiga qarab rang o'zgartiradi.
- "Tekshirish" barcha kirish kombinatsiyalarini sinaydi va xato qatorlarni jadvalda belgilaydi.
- Baho: element soni optimalga teng → 3 yulduz, optimal+2 gacha → 2 yulduz, yechildi → 1 yulduz.
- Har darajada bitta matnli maslahat.
- Teskari bog'lanish (sikl) v1'da taqiqlanadi va ekranda ko'rsatiladi.

## 5. Darajalar tizimi

Taklif: 5 bo'lim × 6 daraja = 30 daraja. Keyingi bo'lim oldingisidagi yulduzlar soniga qarab ochiladi.

1. **Asoslar** — NOT, AND, OR, ularni birlashtirish.
2. **XOR va NAND** — XOR'ni AND/OR/NOT'dan yig'ish, NAND, NOR.
3. **Kombinatsion sxemalar** — yarim summator, to'liq summator, multipleksor, dekoder, taqqoslagich.
4. **Faqat NAND** — hamma narsani bitta universal element bilan qurish.
5. **Murakkab masalalar** — 2-bitli summator, ko'pchilik ovozi, juftlik tekshiruvi va h.k.

Har bir daraja uchun mos yozuvdagi (reference) yechim saqlanadi. Test har bir darajaning yechilishi mumkinligini va optimal sonning to'g'riligini tekshiradi.

## 6. Ma'lumotlar modeli (SQLite)

- `players(id, token_hash, nickname, created_at, last_seen_at)`
- `solutions(player_id, level_id, gate_count, stars, circuit_json, solved_at)` — har o'yinchi uchun har darajadagi eng yaxshi yechim.
- Reyting so'rov orqali hisoblanadi (`SUM(stars)`), alohida jadval kerak emas.

## 7. API

| Metod | Yo'l | Vazifa |
|---|---|---|
| POST | `/api/players` | yangi o'yinchi (taxallus) → `id` va `token` |
| GET / PATCH | `/api/me` | profil, taxallusni o'zgartirish |
| GET | `/api/progress` | barcha yechilgan darajalar |
| POST | `/api/levels/{id}/solve` | sxemani yuborish → server tekshiradi, yulduz qaytaradi |
| GET | `/api/leaderboard` | top-50 o'yinchi |
| GET | `/api/levels/{id}/stats` | nechta odam yechgan, eng kam element soni |
| GET | `/healthz` | holat tekshiruvi |

Kiruvchi ma'lumotlar hajmi va tuzilmasi tekshiriladi; IP bo'yicha rate limit (xotirada, token bucket).

## 8. Deploy sxemasi

- `deploy/setup.sh` — toza Ubuntu'da: Nginx, certbot, `logicgate` foydalanuvchisi, papkalar, firewall (ufw: 22, 80, 443).
- `deploy/logicgate.service` — systemd unit: `MemoryMax`, `Restart=on-failure`, xavfsizlik cheklovlari (`ProtectSystem`, `NoNewPrivileges`).
- `deploy/nginx.conf` — statik fayllar, kesh, `gzip_static`, `/api` proxy, xavfsizlik sarlavhalari.
- `deploy/backup.sh` + cron — SQLite'ni har kuni zaxiralash, 7 kunlik nusxa saqlanadi.
- `deploy/deploy.sh` — lokal build → serverga `scp`/`rsync` → xizmatni qayta ishga tushirish.

## 9. Ish bosqichlari (milestone'lar)

1. **M0 — Skelet:** git, Vite + Preact, Go modul, darajalar formati.
2. **M1 — Simulyator:** TS va Go simulyatorlari, umumiy testlar.
3. **M2 — Sxema muharriri:** SVG maydon, sudrash, simlar, sensorli boshqaruv, zoom/pan.
4. **M3 — Darajalar va progress:** 30 daraja, yulduzlar, lokal saqlash, bo'limlar ekrani.
5. **M4 — Backend:** o'yinchi, progress sinxronlash, server tekshiruvi, reyting.
6. **M5 — Sayqal:** o'quv qo'llanma (1-daraja), ovoz, animatsiyalar, mobil moslashuv.
7. **M6 — Deploy va hisobot:** deploy fayllari, `README.md`, RAM va bundle o'lchovi, brauzerda to'liq o'ynab tekshirish.
8. **M7 — Joylash va o'sish (bajarildi):** Coolify + GitHub Actions avto-deploy, kunlik zaxira, taxallus moderatsiyasi, telefonda vertikal maydon, yangi element kartalari, Open Graph, ulashish.
9. **M8 — Qaytib kelish uchun sabablar (bajarildi):** kunlik boshqotirma (isbotlangan minimum, kunlik reyting, seriya), tekshiruv animatsiyasi, bosqichli maslahat, do'stlar masalasi (havolada), 17 ta yutuq, rus tili.

10. **M9 — Domen va HTTPS (bajarildi):** https://logic.noesis.uz, eski manzildan natijalarni ko'chirish, PWA, oflayn rejim.
11. **M10 — Xotira (bajarildi):** D-trigger, takt, vaqt diagrammasi, avtomat bilan tekshiruv va eng qisqa qarshi misol; 6 ta yangi daraja (kechikish, front, almashtirgich, xotira katakchasi, hisoblagich, kod qulfi).
12. **M11 — Telegram Mini App (bajarildi, @LogicGateUzBot):** Telegram ichida SDK, orqaga tugma, tebranish, `startapp` havolalar, profil kodi Telegram bulutida, Telegram'da ulashish.
13. **M12 — Bot serverda (bajarildi; token Coolify'da):** /start, kunlik eslatma (o'yin ichidan ham), zaxira nusxa admin'ga Telegram orqali, /stats.
14. **M13 — Xotira kuni (bajarildi):** har yakshanba kunlik masala D-trigger bilan (isbotlangan minimum), bot eslatmasida «xotira kuni».
15. **M14 — Bot: inline rejim va admin kuzatuvi (bajarildi; inline — BotFather /setinline):** istalgan suhbatda bugungi masala/taklif kartasi, haftalik hisobot, xato ogohlantirishlari.
16. **M15 — Avtomatlar (bajarildi):** 7-bo'lim, 6 ta daraja (birinchi bosish, navbatchi, turniket, tugmali chiroq, yuqoriga-pastga, ketma-ket qo'shuvchi), hammasi isbotlangan minimum bilan; jami 42 daraja.
17. **M16 — Kunlik masalalar arxivi (bajarildi):** o'tgan kunlar ro'yxati va masalasi, kechagisi seriyaga kiradi, qolganlari — mashq; havola rasmlari 42 daraja bilan.
18. **M17 — Sxema formulasi (bajarildi):** yon panelda jonli Bul ifodasi (¬ ∧ ∨ ⊕), umumiy elementlar va D-trigger holatlari nomlanadi.
19. **M18 — Bo'lim xulosalari (bajarildi):** 7 bo'lim uchun qisqa dars (uz/ru), bo'lim yechilgach ochiladi.
20. **M19 — Qidiruv tizimlari (bajarildi):** mantiqiy elementlar qo'llanmasi (uz/ru statik sahifa), robots.txt, sitemap.xml, schema.org, canonical; Google va Yandex'da tasdiqlangan.
21. **M20 — Dizayn, 1-bosqich (bajarildi):** mavzu o'zgaruvchilari, Plata va Daftar mavzulari + Avto (Telegram rejimi bilan), IBM Plex shriftlari, emoji o'rniga chiziqli ikonkalar, neon nur va gradientlarsiz.

22. **M21 — Dizayn, 2-bosqich: maydon (bajarildi):** simlar plata yo'li (to'g'ri burchak va 45°), kirishlar — tumbler, chiqishlar — chiroq; Daftar'da katakli qog'oz, siyoh, marker va qo'lda chizilgandek chiziqlar.
23. **M22 — Dizayn, 3-bosqich: bosh ekran (bajarildi):** "davom etish" kartochkasi (navbatdagi daraja, kichik sxema — qoralama bo'lsa u bilan, yechim ko'rsatilmaydi), pastki panel (Darajalar, Qum quti, Reyting, Yutuqlar, Sozlamalar), burchakda tez til almashtirish; qo'llanma havolasi — sozlamalarda.

24. **M23 — Dizayn, 4-bosqich: darajalar xaritasi (bajarildi):** bo'lim ichida darajalar "ilon" tartibida yo'llar bilan ulangan (6, 3 yoki 2 ustun — ekran kengligiga qarab), yechilgan darajadan keyingisiga yo'l yonadi, yangi yechimdan keyin signal yo'l bo'ylab "oqadi"; navbatdagi daraja chirog'i miltillaydi; bo'limlar ham yo'l bilan ulangan; ochilganda navbatdagi bo'limga o'tadi.

26. **M25 — Qo'llanma: ikkilik sanoq sistemasi (bajarildi):** uz/ru statik sahifa (o'tkazish usullari, jadval, qo'shish, bitlar o'yinchog'i), qo'llanmalar orasida menyu, sitemap'da 5 ta manzil.
25. **M24 — Dizayn: logotip (bajarildi):** yangi belgi (ikki kontakt, 45° yo'llar, AND va yonib turgan chiroq) — favicon, PWA va Apple ikonkalari, bosh ekran logotipi; havola rasmi va Telegram ilova rasmi Plata uslubida (og.png?v=3).

### Keyingi g'oyalar (foydalanuvchi qarori yoki ma'lumoti kerak)

- Google Search Console va Yandex Webmaster'da saytni tasdiqlash va sitemap yuborish — domen egasining akkaunti kerak.
- Telegram orqali kirish (initData imzosini serverda tekshirish) — bot tokeni serverda kerak bo'ladi; hozircha CloudStorage yetarli.
