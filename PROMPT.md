# Vazifa: "Logic Gate" brauzer o'yinini yaratish va eskiz.uz VPS'ga joylashga tayyorlash

## Kontekst
- Loyiha papkasi: `D:\Projects\GAME\logic-gate` (hozircha bo'sh). Ishlab chiqish kompyuteri: Windows 11.
- O'yin g'oyasi: mantiqiy elementlar (AND, OR, NOT, XOR, NAND, NOR va h.k.) yordamida sxema yig'ib, har bir darajadagi masalani yechish — brauzerda o'ynaladigan puzzle o'yin. Tafsilotlar savollar bosqichida aniqlanadi.
- Hosting: eskiz.uz VPS (Linux, Ubuntu). Resurslar kam, shuning uchun hammasini 1 vCPU va 1 GB RAM'ga mo'ljallab loyihala. O'yinchilar ko'payganda ham resurs sarfi past bo'lishi kerak.

## Stek tanlash
Backend va frontend uchun stekni o'zing tanla. Mezonlar:
1. Bo'sh turgan holatda RAM sarfi minimal bo'lsin (backend jarayoni uchun maqsad: 50 MB dan kam).
2. CPU kam yuklansin: frontend build qilingan statik fayllar bo'lsin (SSR yo'q), o'yin mantig'i brauzerda ishlasin, server faqat zarur ishlarni bajarsin (hisob, progress, reyting).
3. Ma'lumotlar bazasi alohida server talab qilmasin (masalan, SQLite), jiddiy sabab bo'lmasa.
4. Deploy oddiy bo'lsin: bitta systemd xizmati, oldida Nginx yoki Caddy, HTTPS (Let's Encrypt), gzip/brotli siqish va statik fayllarni keshlash.
5. Docker majburiy emas. Ishlatsang, uning RAM'ga ta'sirini hisobga ol.

2–3 variantni qisqa jadvalda taqqosla (taxminiy RAM/CPU, ishlab chiqish tezligi, deploy murakkabligi) va bittasini asoslab tavsiya qil.

## Ish tartibi (qat'iy shu ketma-ketlikda)

**1-bosqich — Reja.** Kod yozishdan oldin reja tuz: tanlangan stek, arxitektura (frontend ↔ API ↔ DB), papka tuzilmasi, o'yin mexanikasi, darajalar tizimi, ma'lumotlar modeli, API ro'yxati, deploy sxemasi va ish bosqichlari (milestone'lar).

**2-bosqich — Savollar.** Menga kerak bo'ladigan BARCHA savollarni BITTA xabarda ber: raqamlangan, mavzular bo'yicha guruhlangan, har biriga o'zing tavsiya qilgan javob bilan (men "hammasi tavsiya bo'yicha" deb javob bera olishim uchun). Masalan: o'yin mexanikasi tafsilotlari, darajalar soni, ro'yxatdan o'tish kerakmi, reyting jadvali, interfeys tili, dizayn uslubi, mobil qo'llab-quvvatlash, domen nomi, VPS tarifi va Ubuntu versiyasi. Javobimni kut.

**3-bosqich — To'xtovsiz yaratish.** Javoblarimni olgach, o'yinni boshidan oxirigacha to'xtamasdan yarat. Qo'shimcha savol berma: mayda qarorlarni o'zing qabul qil va ularni `DECISIONS.md` fayliga yozib bor. Faqat o'zing hal qila olmaydigan to'siq chiqsa (masalan, VPS'ga kirish ma'lumoti kerak bo'lsa) to'xta. Git repozitoriy och va har bir milestone oxirida commit qil. Har bir bosqichdan keyin build va testlarni ishga tushir, xatolarni o'zing tuzat.

## Yakuniy natija
- Ishlaydigan o'yin: kelishilgan sondagi darajalar, progress saqlanadi, telefon va kompyuterda qulay ishlaydi.
- Backend: API, ma'lumotlar bazasi migratsiyalari, kiruvchi ma'lumotlarni tekshirish, rate limit.
- `deploy/` papkasi: systemd unit, Nginx/Caddy konfiguratsiyasi, toza Ubuntu serverni sozlash skripti, `.env.example`, bazani kunlik zaxiralash (cron).
- `README.md` (o'zbek tilida): lokal ishga tushirish, build qilish va VPS'ga joylash bo'yicha qadamma-qadam ko'rsatma.
- Resurs hisoboti: production build'da backend RAM sarfi va frontend bundle hajmi o'lchab ko'rsatilsin.

## Tugash mezoni
Lokal build xatosiz o'tadi, testlar o'tadi, o'yin brauzerda boshidan oxirigacha o'ynab tekshirilgan, `README.md`dagi ko'rsatma bo'yicha uni toza Ubuntu serverga joylash mumkin.
