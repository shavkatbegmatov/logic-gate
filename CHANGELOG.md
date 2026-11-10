# Logic Gate — yangiliklar

O'yinchilar uchun sodda tilda. O'yinning o'zida: Sozlamalar → «Yangiliklar». Manba — `web/src/changelog.ts`
(u yerda ruscha matn ham bor); versiya — `web/package.json`. Ikkalasi mosligini test tekshiradi.

Versiya raqami: yangi imkoniyat — o'rta raqam (2.1.0), tuzatish — oxirgi (2.0.1), katta o'zgarish — birinchi (3.0.0).

## 2.15.0 — 2026-11-10

- Tekshiruv animatsiyasi kompyuterda animatsiya effektlari o'chirilgan bo'lsa ham ko'rinadi (ishxona va maktab kompyuterlarida ko'pincha shunday).
- Sozlamalarda «Animatsiya»: Avto, Yoqilgan yoki O'chirilgan. «O'chirilgan» da tekshiruv natijasi darhol chiqadi.

## 2.14.0 — 2026-11-10

- Simlar endi sxema chizmalaridagidek: kesishgan joyda biri ko'prikcha bilan ustidan o'tadi, bitta manbadan tarmoqlangan joyda nuqta turadi, turli simlar bir chiziq ustiga tushmaydi va elementlar ichidan o'tmaydi.
- Simlar to'g'ri burchakli yo'llar bilan chiziladi — burchaklari kesilgan, plata ko'rinishi saqlangan.
- Telegram: internet sekin bo'lsa, Telegram'da saqlangan profil va o'qituvchi sinflari yangisi bilan almashib ketmaydi — javob kelmasa, «qayta urinish» taklif qilinadi.
- Qum quti, reyting, arxiv, yutuqlar va do'st masalasi ekranlari kerak bo'lganda yuklanadi — o'yin tezroq ochiladi.

## 2.13.0 — 2026-11-10

- Buzilgan havola yoki eski ma'lumot o'yinni oq ekranga aylantirmaydi: o'yin o'zi tiklanadi, kerak bo'lsa «qayta yuklash» va «ma'lumotni tozalash»ni taklif qiladi. Begona saytdan kelgan ko'chirish havolasi profilingizni almashtira olmaydi.
- Maktabdagi umumiy kompyuterda keyingi o'quvchiga oldingisining sertifikatdagi ismi chiqmaydi.
- «Davom etish»: keyingi bo'limga yulduz yetmasa, yana nechta kerakligi va qaysi darajani yaxshilash mumkinligi ko'rsatiladi. O'qituvchi vazifasi orqali ochilgan darajada yangi elementlar ham tanishtiriladi.
- «Yuqoriga-pastga» darajasi maslahatidagi formula tuzatildi, ikki dars matni aniqlashtirildi.
- Tekshiruv paytida sxemani klaviatura bilan ham o'zgartirib bo'lmaydi; Qum qutida katta sxemani sudrash tezlashdi; «Daftar» mavzusida yulduzlar va jadval raqamlari aniqroq.
- Telegram'da katta xotirali masala oddiy havola bilan ulashiladi — do'st masalasiz bosh sahifaga tushmaydi. Bosh sahifa boshqa qurilmada yechilgan kunlik masalani ham ko'rsatadi; server profilni topa olmasa, natijalar shu taxallus bilan yangi profilga o'tadi.
- Server: ertangi kunlik masalani oldindan ochib bo'lmaydi, reyting og'ir yukda ham tez, rad etilgan taxalluslar sinfning ro'yxatdan o'tishini to'smaydi, niqoblangan so'zli taxalluslar qabul qilinmaydi; kunlik masalalar yaqin kunlarda takrorlanmaydi.

## 2.12.1 — 2026-11-10

- «Tekshirish»da xato qator sekinroq ko'rsatiladi va noto'g'ri chiqish qizil miltillaydi — xato birinchi qatorning o'zida bo'lsa ham animatsiya ko'rinadi.

## 2.12.0 — 2026-11-10

- Maktabdagi umumiy kompyuterda: boshqa o'quvchining tiklash kodi kiritilganda oldingi o'quvchining natijalari unga o'tib ketmaydi — o'yin avval ogohlantiradi va qurilmani tozalaydi.
- Profil ochilgan zahoti tiklash kodi ko'rsatiladi — uni daftarga yozib, keyingi darsda boshqa kompyuterda davom etish mumkin.
- Klaviatura bilan o'ynash mumkin: Tab bilan nuqta va elementlarni tanlang, Enter — ulash, strelkalar — surish, Delete — o'chirish; oynalar va xabarlarni ekran o'quvchi dasturlar ham o'qiydi.
- Ruscha qo'llanmadan yoki ruscha telefon va Telegram'dan kelganlarga o'yin birdaniga ruscha ochiladi.
- Telegram: profil tiklanayotganda tasodifan yangi profil ochilib qolmaydi, sekin internetda ekran o'zicha bosh sahifaga qaytmaydi; o'qituvchi sinflari Telegram'ning boshqa qurilmalarida ham ko'rinadi.
- O'qituvchi hisoboti dars paytida daqiqada bir yangilanadi, «faollik» kalendar kuni bo'yicha hisoblanadi, boshqa qurilmada o'chirilgan sinfni ro'yxatdan olib tashlash mumkin, «Progressni o'chirish» esa o'qituvchi kalitlarini ham o'chiradi.
- Qo'llanmalar bir marta ochilgach internetsiz ham ochiladi, Bul algebrasi kalkulyatori teng bo'lmagan ifodalar jadvalini ham ko'rsatadi, shriftlar har yangilanishda qayta yuklanmaydi.

## 2.11.2 — 2026-11-09

- Sinfda bir vaqtda 40 tagacha o'quvchi profil ochib o'ynay oladi — maktab Wi-Fi'ida ham «juda ko'p so'rov» xatosi chiqmaydi.
- Telefonda: elementlar palitrasini barmoq bilan surish mumkin (NOR, XNOR, D-trigger ham ko'rinadi), kirish tumbleri bosilganda sim boshlanib ketmaydi.
- Muharrir: o'chirilgan element simni buzmaydi, tanlangan sim boshqasiga sakramaydi, Qum qutida «bekor qilish» kirishlar sonini ham qaytaradi, «Tartibga keltirish» joylashi qayta ochilganda saqlanadi.
- Natijalar ikki tabda o'ynalganda yo'qolmaydi, serverga yuborilmay qolgan natijalar bitta xato tufayli to'xtab qolmaydi.
- O'yin tezroq ochiladi: kam ishlatiladigan sahifalar kerak bo'lganda yuklanadi.

## 2.11.1 — 2026-11-09

- Simlar endi to'g'ri chiziq bo'lib tushadi: element chiqishga yoki keyingi elementga ro'para qo'yilsa, sim o'rtasidagi mayda pog'ona yo'qoladi. «Tartibga keltirish» esa chiqishga boradigan simni doim to'g'ri chiziq qilib joylaydi.

## 2.11.0 — 2026-11-09

- Saytda o'qituvchilar uchun sahifa: sinf rejimi qanday ishlashi va o'yin bilan o'tiladigan 3 ta tayyor dars ishlanmasi (45 daqiqa, darajalar, uy vazifasi, baholash).

## 2.10.0 — 2026-11-09

- «Tartibga keltirish» tugmasi (maydonning o'ng pastida): elementlar o'zi ustunlarga joylashadi, simlar chalkashmaydi — darajalarda ham, Qum qutida ham.

## 2.9.0 — 2026-11-09

- Telefonga o'rnatish: «O'rnatish» tugmasi (bosh sahifada va sozlamalarda) — o'yin ilova kabi ochiladi va internetsiz ishlaydi; iPhone uchun — qanday qo'shish izohi.
- O'rnatilgan ilova ikonkasini bosib tursangiz — tezkor havolalar: kunlik masala, darajalar, Qum quti.

## 2.8.0 — 2026-11-09

- Sertifikat: birinchi bo'lim tugagach ochiladi — ismingiz, tugatilgan bo'limlar va yulduzlar bilan; PNG qilib yuklab olish, ulashish yoki chop etish mumkin (Yutuqlar ekranida).

## 2.7.0 — 2026-11-09

- Sozlamalarda — saytdagi barcha qo'llanmalar va kalkulyatorlar ro'yxati (Telegram ichidan ham ochiladi).
- Formulada NAND, NOR, XNOR so'zlarini ham yozish mumkin: A NAND B.
- Tuzatishlar: vazifa orqali yechilgan daraja vazifa o'chirilgandan keyin ham ochiq qoladi; juda uzun formula Qum qutini to'xtatib qo'ymaydi.

## 2.6.0 — 2026-11-09

- Saytda yangi qo'llanma — «Sanoq sistemalari»: sonni 2, 8, 10, 16 va boshqa sistemalar orasida o'tkazadigan kalkulyator, yechimi bosqichma-bosqich.

## 2.5.0 — 2026-11-09

- Qum qutida formuladan sxema: mantiqiy ifodani yozing — sxema o'zi yig'iladi va joylashadi.
- «Bul algebrasi» qo'llanmasidagi kalkulyatordan ifodani bir bosishda o'yinda sxema qilib ochish mumkin.

## 2.4.0 — 2026-11-09

- Saytda yangi qo'llanma — «Bul algebrasi»: qonunlar, ifodani soddalashtirish, Karno kartasi va istalgan ifodaning haqiqat jadvalini chiqaradigan kalkulyator.

## 2.3.0 — 2026-11-09

- O'qituvchi hisobotini Excel uchun yuklab olish, jadvalni nusxalab Google Sheets'ga qo'yish yoki chop etish mumkin.

## 2.2.0 — 2026-11-09

- Sinf vazifalari: o'qituvchi darajalarni tanlab vazifa beradi (muddat bilan ham), o'quvchilar uni bosh sahifada ko'radi, o'qituvchi esa kim bajarganini kuzatadi.
- Vazifadagi darajalar yulduzlar yetmasa ham ochiladi.

## 2.1.0 — 2026-11-09

- Yechimlar diagrammasi: daraja yoki kunlik masala yechilgach, boshqa o'yinchilar nechta element ishlatgani va sizning o'rningiz ko'rinadi.

## 2.0.0 — 2026-11-09

- Yangi ko'rinish: ikki mavzu — qorong'i «Plata» va yorug' «Daftar». Sozlamalarda tanlanadi.
- O'yin maydoni: simlar plata yo'llaridek, kirishlar — tumbler, chiqishlar — chiroq.
- Bosh sahifa: navbatdagi daraja kichik sxemasi bilan, pastda qulay menyu.
- Darajalar xaritasi: daraja yechilganda keyingisigacha yo'l yonadi.
- Sinf rejimi: o'qituvchi sinf yaratadi, o'quvchilar havola orqali qo'shiladi, o'qituvchi natijalarni ko'radi.
- Reytingda birinchi uch o'rin — shohsupada.
- Yangi logotip va ikonkalar.
- Saytda ikkita qo'llanma: mantiqiy elementlar va ikkilik sanoq sistemasi.

## 1.3.0 — 2026-11-08

- 7-bo'lim «Avtomatlar»: 6 ta yangi daraja — jami 42 ta.
- O'tgan kunlar masalalari: kecha va undan oldingi kunlik masalalarni ham yechish mumkin.
- Formula: yig'ilgan sxemaning ifodasi yon panelda ko'rinadi.
- Bo'lim xulosalari: bo'lim tugagach qisqa dars ochiladi.
- Yakshanba — xotira kuni: kunlik masala D-trigger bilan.

## 1.2.0 — 2026-11-07

- Kunlik boshqotirma: har kuni yangi masala, kunlik reyting va seriya.
- Maslahatlar: avval yo'nalish, keyin yechim tarkibi.
- Do'stlar uchun masala: qum qutida sxema yig'ib, havola bilan yuborish.
- 17 ta yutuq.
- Rus tili.
- Xotira bo'limi: D-trigger va takt.
- Telegram'da o'ynash (@LogicGateUzBot) va kunlik eslatma.
- Yangi manzil logic.noesis.uz; internet bo'lmasa ham ochiladi.

## 1.1.0 — 2026-11-06

- Telefonda qulayroq: kirishlar tepada, chiqishlar pastda.
- Elementlar tavsifi telefonda ham ko'rinadi.
- Taxalluslar tekshiriladi: haqoratli so'zlar qabul qilinmaydi.

## 1.0.0 — 2026-11-05

- Birinchi versiya: 30 daraja, 5 bo'lim.
- Sxema muharriri: elementlarni sudrab qo'yish, simlar, haqiqat jadvali.
- Yulduzlar va umumiy reyting.
