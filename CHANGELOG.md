# Logic Gate — yangiliklar

O'yinchilar uchun sodda tilda. O'yinning o'zida: Sozlamalar → «Yangiliklar». Manba — `web/src/changelog.ts`
(u yerda ruscha matn ham bor); versiya — `web/package.json`. Ikkalasi mosligini test tekshiradi.

Versiya raqami: yangi imkoniyat — o'rta raqam (2.1.0), tuzatish — oxirgi (2.0.1), katta o'zgarish — birinchi (3.0.0).

## 2.33.0 — 2026-11-25

- Hikoya yana to'rt bo'limga yetdi: «Tarozi minorasi» (Kombinatsion sxemalar), «Kumush ombor» (Faqat NAND), «Hisob xonasi» (Shinalar) va «Ustozning yuragi» (ALU). Har birida kirish va yakuniy sahnalar, har darajada o'z hikoya qatori; Chiroq «qo'sh», «hammasi bittadan», «birga» va «hisobla» degan so'zlarni o'rganadi.

## 2.32.0 — 2026-11-25

- Yangi, 11-bo'lim — «ALU» (112 ★ dan ochiladi): protsessorning hisoblovchi yuragini yig'asiz. 6 ta daraja: manfiy son, ayirgich, «qo'sh yoki ayir», mantiqiy blok, taqqoslagich va to'rt amalli ALU.
- Yangi elementlar: doimiy 1 va 0 manbalari (ONE, ZERO) — masalan, summatorning Ci kirishiga. Yangi bloklar: ayirgich (SUB4), shina AND/OR/XOR (AND4, OR4, XOR4) va nol aniqlagich (NOR4 — «Nolmi?» darajasidan ochiladi).
- «ALU» darajasidan keyin Qum qutida tayyor ALU4 bloki ochiladi: ikki son va amal kodi F1 F0 → natija, C va Z bayroqlari.

## 2.31.1 — 2026-11-25

- 3D rejimda apparat 8×/4× MSAA, 2048px yumshoq soyalar va anizotrop filtrlash yoqildi — simlar va elementlar chetidagi g'adir-budirlik yo'qoldi.
- PCB mis yo'llari 45° qiyalik (bevel) qirrali uzluksiz geometriyaga o'tkazildi va o'chiq (0) simlar rangi platadan aniq ajralib turadigan sovuq metall ohangga keltirildi.

## 2.31.0 — 2026-11-25

- Yangi, 10-bo'lim — «Shinalar» (100 ★ dan ochiladi): to'rt sim — bitta yo'l. Shina maydonda bitta keng pin va bitta qalin sim bo'lib ko'rinadi, ustida qiymati son bilan yoziladi; ulaganda to'rttala bit birga ulanadi, o'chirganda birga o'chadi.
- 6 ta yangi daraja: teskari shina, «Nolmi?», to'rt bitli summator, shina tanlovchi, bittaga oshirish va hisoblagichning bir qadami.
- Yangi bloklar: bo'laklovchi (SPLIT), birlashtiruvchi (JOIN), shina inkori (NOT4), to'rt bitli summator (ADD4), shina tanlovchi (MUX4) va bittaga oshiruvchi (INC4). Shinali darajalarda haqiqat jadvali sonlarda — 512 qatorli jadval ham oson o'qiladi.

## 2.30.0 — 2026-11-25

- Hikoyaning 2-bo'limi — «Bozor darvozalari»: Lola va Chiroq qulflangan bozorning oltita darvozasini ochadi. Kirish va yakuniy sahnalar, har darajada o'z hikoya qatori; Chiroq yangi so'zlar o'rganadi.

## 2.29.0 — 2026-11-25

- «Bloklar» bo'limiga hikoya qo'shildi: Chiroq buvining sandig'idan oyoqchali qora qutichalarni topadi, bo'lim oxirida esa buvining chizmasida Ustozning hisob xonasi va to'rt simli yo'l — shina paydo bo'ladi.
- Bo'limning har bir darajasi ustida endi hikoya qatori bor (uz va ru).

## 2.28.0 — 2026-11-25

- Yangi, 9-bo'lim — «Bloklar» (88 ★ dan ochiladi): Chiroq buvining sandig'idan topilgan tayyor mikrosxemalar — yarim summator, to'liq summator, multipleksor va dekoder. Har biri ichidagi sxemani qayta yig'masdan bitta element sifatida qo'yiladi.
- 6 ta yangi daraja: birlar sanog'i, ikki va uch bitli summator, «to'rtdan biri» tanlagich, sakkiz eshikli dekoder va to'rt ovozli hisoblagich. Blok bir nechta chiqishli — har oyog'i alohida ulanadi. Bu — protsessor yig'ish sari birinchi qadam.
- Qum qutida: blok uni o'rgatgan daraja yechilgach palitrada paydo bo'ladi (masalan, to'liq summator — «To'liq summator» darajasidan keyin).

## 2.27.0 — 2026-11-25

- Hikoya: endi o'yin Ko'hna Minor shahrida o'tadi — shahar mashinasi Ustoz jim bo'lib qolgan, shogird qiz Lola va mis chiroq-robot Chiroq uni sxemalarni tushunib qayta yoqadi. Birinchi bo'lim «Buvining ustaxonasi»: kirish va yakuniy sahnalar, har darajada qisqa hikoya qatori. Qolgan bo'limlar keyingi versiyalarda.
- Yangi uslub «Mis va lojuvard»: Samarqand koshinlari ranglari va girih naqshlari, signal — mis-oltin. Sozlamalar → «Mavzu va uslub».
- Hikoyani Sozlamalarda o'chirib qo'yish mumkin; bo'lim kartasidagi «Hikoya» sahnani qayta ko'rsatadi.

## 2.26.0 — 2026-11-25

- Musiqa: har bo'limning o'z fon kuyi bor — «Asoslar» yorqin va xotirjam, «Faqat NAND» qorong'iroq, «Xotira» va «Avtomatlar»da takt soati chiqillaydi. Menyu, kunlik masala va qum qutining ham o'z musiqasi bor.
- Yangi ovozlar: element qo'yish, sim ulash, tumbler va yechim endi boyroq eshitiladi va musiqa bilan bir tonallikda. Tekshiruvda signal simlardan oqayotgani ham eshitiladi.
- Sozlamalarda — «Fon musiqasi»: musiqani alohida o'chirsa bo'ladi, ovoz effektlari qoladi.

## 2.25.0 — 2026-11-25

- Sozlamalarda — «Qurilmalar»: Telegram orqali kirgan har bir qurilma (brauzer, tizim, kirgan va oxirgi faol sana) ko'rinadi, keraksizini bir bosishda profildan chiqarasiz.
- «Boshqa qurilmalardan chiqish»: telefon yo'qolsa yoki umumiy kompyuterda kirib qolgan bo'lsangiz — tiklash kodingiz yangisiga almashadi va boshqa hamma qurilma profildan chiqadi. Natijalar saqlanadi.

## 2.24.0 — 2026-11-25

- O'qituvchilar uchun tarqatma: sinf havolasining QR-kodi bilan A4 plakat (devorga yoki proyektorga) va qirqib tarqatiladigan 8 ta kartochka. O'quvchi telefon kamerasini QR-kodga qaratadi — va sinfga qo'shiladi. Sinf sahifasida — «QR-kod va tarqatma».

## 2.23.0 — 2026-11-25

- O'qituvchilar uchun sinf musobaqasi: darajalarni va vaqtni tanlang — o'quvchilar ularni bo'sh maydondan yechadi, reyting proyektorda katta taymer bilan jonli yangilanadi. Kim ko'p yulduz yig'sa — g'olib.
- O'quvchilar musobaqa boshlanganini bosh sahifada ko'radi va bir bosishda qatnashadi.

## 2.22.0 — 2026-11-24

- O'yinni yaxshilash uchun endi qaysi bosqichda qiyin bo'layotganini anonim tarzda hisoblaymiz: o'yin har qurilmadan faqat «ochildi», «1-daraja yechildi» kabi bosqich nomini bir marta yuboradi. Ism, ID, natijalar yoki boshqa ma'lumot yuborilmaydi.

## 2.21.0 — 2026-11-24

- Endi saytga Telegram orqali kirsa bo'ladi: «Telegram orqali kirish» ni bosing, botda saytdagi raqamni tanlang — tiklash kodini terish shart emas. Telefon, kompyuter, istalgan brauzerda.
- Sozlamalarda — «Telegram'ni bog'lash»: profilingizni bir marta bog'lasangiz, keyin hamma qurilmada Telegram orqali kirasiz. Telegram ichida o'ynaganlarning profili o'zi bog'lanadi.

## 2.20.1 — 2026-11-24

- Profilingiz serverda topilmasa (masalan, takroriy profil sifatida o'chirilgan bo'lsa), o'yin endi jimgina yangisini ochmaydi. «Profil topilmadi» oynasida asosiy profilingiz kodi bilan kirasiz — shu qurilmadagi natijalar unga qo'shiladi — yoki o'zingiz yangi profil ochasiz. Reytingda ismingiz qayta ko'payib ketmaydi.

## 2.20.0 — 2026-11-24

- Bosh sahifaning yuqorisida endi kim o'ynayotgani ko'rinadi: rangli avatar, taxallus, o'yinchi ID va reytingdagi o'rningiz. Bir xil ismli profillar ID va rangidan farqlanadi.
- Sozlamalarda — to'liq o'yinchi ID (nusxalash tugmasi bilan), profil ochilgan sana va reytingdagi o'rin. ID ochiq raqam: uni o'qituvchiga aytsa bo'ladi, kirish uchun esa tiklash kodi kerak.

## 2.19.3 — 2026-11-23

- Avval boshqa qurilmada yoki Telegram'da o'ynaganlar endi taxallus so'raladigan joyning o'zida (daraja yechilgach, reyting, bosh sahifa) «Avval o'ynaganmisiz? Tiklash kodini kiriting» orqali o'z profiliga qaytadi — reytingda bitta odamning ismi ko'payib ketmaydi.

## 2.19.2 — 2026-11-23

- Bir necha yangilanishdan keyin qaytganingizda bosh sahifadagi xabar endi eng muhim yangilikni (masalan, yangi bo'limni) ko'rsatadi, faqat oxirgi kichik tuzatishni emas.

## 2.19.1 — 2026-11-23

- Yangi yutuq «NOR ustasi»: «Faqat NOR» bo'limidagi barcha darajalarni 3 ★ bilan yeching.

## 2.19.0 — 2026-11-23

- Yangi 8-bo'lim «Faqat NOR»: 6 ta daraja — faqat NOR elementlaridan NOT, OR, AND, XNOR, XOR va multipleksor yig'ing. Endi jami 48 daraja.
- Bo'lim xulosasida — nega NOR ham universal va Oyga uchgan «Apollon» kemasining kompyuteri bunga qanday misol.

## 2.18.13 — 2026-11-23

- 3D rejimda maydon tinch turganda telefon protsessori ham to'liq dam oladi — batareya yanada tejaladi.

## 2.18.12 — 2026-11-23

- Ekran o'quvchi dasturlar (ko'zi ojiz o'yinchilar uchun) tasdiqlash oynasida endi sarlavhadan tashqari savolning o'zini ham o'qiydi.

## 2.18.11 — 2026-11-23

- Yangi versiya chiqqandan keyin eski ochiq sahifada 3D yuklanmasa, endi bu haqida xabar chiqadi va maydon 2D ko'rinishda qoladi (oldin «3D» tanlangan ko'rinar, maydon esa o'zgarmasdi).
- Elementni sudrab turganda ko'rinish almashsa, uning yangi joyi endi saqlanadi va «Bekor qilish» bilan qaytariladi.

## 2.18.10 — 2026-11-23

- Tik telefonda «2D Real» platasidagi yozuvlar endi oynadagi aksdek teskari emas, to'g'ri o'qiladi.
- 3D'dan 2D'ga o'tganda sxema endi ekranga to'liq joylashadi — oldin ba'zan burchakka surilib, kirishlar ko'rinmay qolardi.
- Uslub menyusini Esc bilan yopganda maydonda tanlangan element tanlovdan chiqib ketmaydi.

## 2.18.9 — 2026-11-23

- Kichik va yotiq ekranlarda oyna ichida aylantirish kerak bo'lsa ham «Keyingi daraja», «Tushunarli» kabi tugmalar endi doim pastda ko'rinib turadi.

## 2.18.8 — 2026-11-23

- Telefonni yotqizib o'ynaganda maydon ancha kattaroq: sarlavha, elementlar paneli va tugmalar ixchamroq bo'lib, bitta qatorga joylashadi.

## 2.18.7 — 2026-11-22

- Eng tor telefonlarda (320 px) rus tilida «Darajalar» ekranidagi uzun so'zlar endi karta va daraja plitkasidan chiqib ketmaydi: bo'lim yulduzlari sarlavha ostiga tushadi.

## 2.18.6 — 2026-11-22

- 3D rejim telefonni kamroq qizdiradi va batareyani tejaydi: sxema o'zgarmay turganda maydon qayta-qayta chizilmaydi.

## 2.18.5 — 2026-11-22

- 3D rejimda boshqa ilovaga o'tib qaytganingizda (ayniqsa telefonda va Telegram ichida) maydon bo'sh qolmaydi — sxema o'zi qayta chiziladi.

## 2.18.4 — 2026-11-20

- Telegram Mini App va telefonda ko'rinish tugmalari (2D/3D/Sxema, uslub va 3D kamera) maydon o'rtasiga chiqib qolishi hamda palitra bilan to'qnashishi tuzatildi.
- Tor vertikal ekranlarda 3D plata kamerasi va burchagi maydon bo'ylab kattaroq va markazroq joylashtirildi, sensorli ulash/bosish zonasi kengaytirildi.
- Telegram ichida takroriy «Orqaga» tugmasi olib tashlandi va xavfsiz chegaralar (safe-area) hamda ixcham palitra moslashtirildi.

## 2.18.3 — 2026-11-20

- 3D rejimda kirish tumbleri va chiqish indikatorida to'q old panel, perimetr hoshiyasi hamda ikki rangli (xrom asos + yorqin uchi) tumbler dastagi kontrasti keskin oshirildi.

## 2.18.2 — 2026-11-20

- 3D rejimda bitta manbadan tarmoqlangan simlar ustidagi tugun (post va mufta), burilish tirsaklari hamda element kirish portlari jips ulandi.

## 2.18.1 — 2026-11-20

- 3D rejimda barcha simlar, tumbler dastaklari va element korpuslari ikkinchi kadrda yo'qolib ketishi tuzatildi.
- 3D rejimda yoniq (1) va o'chiq (0) simlar, mikrosxema ustki yuzasi (0/1 nishoni), tumblerlar va svetodiodlar farqi keskin oshirildi.

## 2.18.0 — 2026-11-20

- Yangi AAA studiya ko'rinishi: o'yin sukut bo'yicha jonli «2D Real — Sanoat PCB» uslubida ochiladi, endi «3D Real» rejimi ham bor!
- 3D rejimda kamerani aylantirish, egish va yaqinlashtirish, hajmli chiplar, egilgan jumper simlar, jonli soya va porlaydigan svetodiodlar bilan bevosita sxema yig'ing.
- To'rtta alohida apparat uslubi Sozlamalar va maydonning o'zida tanlanadi: Sanoat PCB, Laboratoriya stoli, Maket platasi (Breadboard) va Kiber Sci-Fi — klassik Plata, Daftar va Chizma mavzulari ham saqlab qolindi.
- Yoniq simlarda tok oqimi animatsiyasi va mexanik tumbler/mikrosxema ovozlari qo'shildi.

## 2.17.5 — 2026-11-12

- Matnni avtomatik nusxalab bo'lmasa (ba'zi telefon va brauzerlarda), u endi o'yin oynasida belgilangan holda chiqadi — uni bir bosishda nusxalab olasiz.

## 2.17.4 — 2026-11-12

- «Maydonni tozalash», «Progressni o'chirish» va sinfdan chiqish kabi savollar endi brauzerning oddiy oynasida emas, o'yinning o'z oynasida chiqadi — tanlangan mavzuga mos, telefonda va Telegram ichida ham.

## 2.17.3 — 2026-11-12

- Telefonda Sozlamalar, Reyting va o'qituvchilar sahifalari ekranga to'liq sig'adi: kartalar o'ngdan kesilib qolmaydi (rus tilida bu ko'proq sezilardi).

## 2.17.2 — 2026-11-11

- «Tartibga keltirish» tugmasi bitta elementli sxemada ham ishlaydi: element chiqish ro'parasiga qo'yiladi va sim to'g'ri chiziq bo'ladi.

## 2.17.1 — 2026-11-11

- Qo'llanma sahifalari (mantiqiy elementlar, sanoq sistemalari, Bul algebrasi) va Telegram'dagi havola rasmi o'yinning yangi ko'rinishiga o'tdi.

## 2.17.0 — 2026-11-11

- Ikki yangi mavzu: «Haqiqiy plata» — yashil plata, qora mikrosxemalar, oltin kontaktlar va svetodiod; «Chizma» — muhandislik chizmasi: oq qog'oz, qora chiziq, yoniq sim qizil.
- Sozlamalarda mavzu endi kichik namunasi bilan tanlanadi — qanday ko'rinishini oldindan ko'rasiz.

## 2.16.0 — 2026-11-11

- O'yin ko'rinishi yangilandi: ortiqcha hoshiyalar olib tashlandi, sarlavhalar yirikroq, ranglar sokinroq — asosiy narsa darhol ko'rinadi.
- Bosh sahifada ishlaydigan sxema: ikkala kalitni yoqing — chiroq yonadi.
- Maydondagi elementlar qalinroq chizilgan, yozuvlari o'qilishi oson.
- Kompyuterda bosh sahifa ikki ustunli: chapda o'yin, o'ngda kunlik masala va boshqa bo'limlar.

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
