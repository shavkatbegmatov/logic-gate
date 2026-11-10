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
| GET | `/api/levels/{id}/stats` | nechta odam yechgan, eng kam element soni, element soni bo'yicha taqsimot |
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

44. **M43 — Xato qatorda tekshiruv animatsiyasi ko'rinadi (bajarildi, 2.12.1):** xato qator qatorlar sonidan qat'i nazar sekin o'tadi (to'lqin 0,6–1,2 s, keyin 0,5 s to'xtash), xato chiqish qizil miltillaydi; birinchi qatorning o'zi xato bo'lsa tekshiruv ~0,36 s da tugab, sezilmay qolardi.
43. **M42 — Ikkinchi tekshiruv: maktab, Telegram, klaviatura (bajarildi, 2.12.0):** umumiy kompyuterda boshqa kod bilan kirish oldingi o'quvchini tozalaydi (ogohlantirish bilan), tiklash kodi profil ochilgan zahoti ko'rsatiladi; Telegram bulutidan tiklash poygasi (JoinForm holati, kutilgan profil ustidan yozilmaydi), SDK yuklanguncha hash ushlab turiladi, o'qituvchi kalitlari bulutda; klaviatura bilan maydon (nuqta, element, tumbler), jadval qatorlari, oyna fokusi va toast jonli hududi; til — `?lang=` va qurilma tili (faqat yangi qurilmada); hisobot daqiqada yangilanadi, Toshkent kunlari, o'chirilgan sinf; qo'llanmalar oflayn, shriftlar alohida keshda; yangiliklar ro'yxati alohida bo'lakda (bosh yuklama 96 KB).
42. **M41 — Tekshiruv natijalari bo'yicha tuzatishlar (bajarildi, 2.11.2):** sinf bitta IP ortida (rate limit, IPv6 /64, X-Real-IP tekshiruvi, kod terishni sekinlatish); muharrir (o'chirilgan port, sim tanlovi, Qum qutida spec bilan undo, tartiblangan ustun saqlanadi, palitradan qo'yilgan element pin qatorida); telefon (palitrani surish, tumbler); ikki tab, sinxronlash, eski saytdan ko'chirish; bosh bundle 107 → 96 KB (byudjet build'da tekshiriladi), service worker 5xx da keshdan; server keshlari, zaxira oqim bilan yuboriladi, `store` testlari, PR'da CI.
41. **M40 — Simlar to'rda (bajarildi, 2.11.1):** element uchlari va daraja pinlari 12 lik to'rga ko'chdi — ro'para qo'yilgan elementlar orasidagi sim to'g'ri chiziq; «Tartibga keltirish» chiqishga ulangan elementni pin ro'parasiga qo'yadi (chiqish simi doim to'g'ri); invariant testi.
40. **M39 — O'qituvchilar sahifasi (bajarildi, 2.11.0):** uz/ru statik sahifa — sinf rejimi, qanday boshlash, 3 ta 45 daqiqalik dars ishlanmasi, savol-javob; o'yindagi o'qituvchi ekranidan havola; sitemap'da 11 ta manzil.
39. **M38 — Tartibga keltirish (bajarildi, 2.10.0):** bitta tugma bilan sxema ustunlarga joylashadi (darajalarda va Qum qutida), D-trigger va teskari bog'lanish bilan ham; formuladan sxema ham shu joylashni ishlatadi.
38. **M37 — Telefonga o'rnatish (bajarildi, 2.9.0):** «O'rnatish» tugmasi (beforeinstallprompt) bosh sahifada va Sozlamalarda, iPhone uchun izoh, manifestda tezkor havolalar.
37. **M36 — Sertifikat (bajarildi, 2.8.0):** birinchi bo'lim tugagach ochiladi; ism, bo'limlar, yulduzlar, sana; canvas → PNG, ulashish, chop etish; Yutuqlar ekranida va bo'lim tugagan natija oynasida.
36. **M35 — Mustaqil tekshiruv va tuzatishlar (bajarildi, 2.7.0):** bugungi relizlarni ikki mustaqil tekshiruvchi ko'rdi; tuzatildi: yechilgan daraja doim ochiq, uzun formula Qum qutini yiqitmaydi (400 belgi), barcha marshrutlarda xavfsiz dekodlash, saqlangan Qum quti tozalangandan keyin o'qiladi, NAND/NOR/XNOR so'zlari, brauzer xatolari faqat o'z saytimizdan, takror kaliti — stek joyi, bot xabarida server va brauzer xatolari alohida, o'qituvchi vazifasida noma'lum darajalar. Sozlamalarda — barcha qo'llanmalar ro'yxati.
35. **M34 — Qo'llanma: sanoq sistemalari (bajarildi, 2.6.0):** uz/ru statik sahifa — 2–16 asoslar orasida o'tkazish kalkulyatori bosqichma-bosqich yechim bilan, 0–16 jadvali, bo'lish, yoyish va guruhlash misollari; sitemap'da 9 ta manzil.
34. **M33 — Brauzer xatolari (bajarildi):** o'yindagi kutilmagan xatolar (faqat o'z kodimizdagi) serverga yuboriladi, server log'ga ERROR qilib yozadi, bot admin'ga ogohlantiradi; takrorlar 6 soatda bir marta, shaxsiy ma'lumotsiz.
33. **M32 — Formuladan sxema (bajarildi, 2.5.0):** Qum qutida Bul ifodasidan sxema (konstantalar soddalashadi, NAND/NOR/XNOR birlashadi, takrorlar bir marta, ustunlarga joylash), `#/sandbox/<formula>` havolasi; qo'llanma kalkulyatoridan o'yinga tugma. Ifoda o'qigich o'yin va qo'llanma uchun bitta (`src/boolexpr.ts`).
32. **M31 — Qo'llanma: Bul algebrasi (bajarildi, 2.4.0):** uz/ru statik sahifa — amallar, qonunlar, De Morgan, soddalashtirish, MDNSh, Karno kartasi; haqiqat jadvali kalkulyatori (ifodalarni solishtiradi); sitemap'da 7 ta manzil.
31. **M30 — Hisobotni chiqarish (bajarildi, 2.3.0):** o'qituvchi hisoboti — CSV fayl (Excel), jadvalni nusxalash (Sheets/Excel), chop etish (yorug' mavzu, faqat hisobot).
30. **M29 — Sinf vazifalari (bajarildi, 2.2.0):** o'qituvchi darajalarni tanlab vazifa beradi (nom va muddat ixtiyoriy), o'quvchi bosh sahifada va sinf sahifasida ko'radi, vazifadagi darajalar qulfsiz; o'qituvchi hisobotida — bajarganlar soni va bajarmaganlar ro'yxati.
29. **M28 — Yechimlar taqsimoti (bajarildi, 2.1.0):** daraja va kunlik masala yechilgach — boshqa o'yinchilar nechta element ishlatgani (ustunlar, ko'pi bilan 10 ta, ortiqchasi "N+") va o'yinchining ustuni; "X% o'yinchi sizdan kamroq element bilan yechgan". Server faqat sonlarni beradi (taxalluslarsiz).
28. **M27 — Versiya va yangiliklar (bajarildi):** versiya 2.0.0; o'yinda «Yangiliklar» ekrani (uz/ru), qaytgan o'yinchiga bosh sahifada bir martalik xabar, Sozlamalarda versiya va havola; `CHANGELOG.md`; test versiya va yangiliklar mosligini tekshiradi. Har relizda versiya oshiriladi va sodda tilda yozuv qo'shiladi.
27. **M26 — Sinf rejimi (bajarildi):** o'qituvchi sinf yaratadi (kod + maxfiy kalit), o'quvchilar havola orqali qo'shiladi va sinf reytingini ko'radi; o'qituvchi hisoboti — darajalar, bo'limlar, kunlik masalalar, faollik; Telegram havolasi `c_<kod>`.
26. **M25 — Qo'llanma: ikkilik sanoq sistemasi (bajarildi):** uz/ru statik sahifa (o'tkazish usullari, jadval, qo'shish, bitlar o'yinchog'i), qo'llanmalar orasida menyu, sitemap'da 5 ta manzil.
25. **M24 — Dizayn: logotip (bajarildi):** yangi belgi (ikki kontakt, 45° yo'llar, AND va yonib turgan chiroq) — favicon, PWA va Apple ikonkalari, bosh ekran logotipi; havola rasmi va Telegram ilova rasmi Plata uslubida (og.png?v=3).

### Keyingi g'oyalar (foydalanuvchi qarori yoki ma'lumoti kerak)

- Telegram orqali kirish (initData imzosini serverda tekshirish) — bot tokeni serverda kerak bo'ladi; hozircha CloudStorage yetarli.
