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
