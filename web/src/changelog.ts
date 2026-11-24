// O'yin versiyalari va yangiliklar — o'yinchilar uchun, sodda tilda (uz/ru). Eng yangisi birinchi.
//
// Yangi versiya chiqarganda:
//   1. web/package.json dagi "version" ni oshiring (yangi imkoniyat — 2.1.0, tuzatish — 2.0.1,
//      katta o'zgarish — 3.0.0);
//   2. shu ro'yxatning boshiga yozuv qo'shing (uz va ru qatorlari soni bir xil);
//   3. CHANGELOG.md ga ham o'sha qatorlarni yozing.
// changelog.test.ts uchalasi mos kelishini tekshiradi. O'yinda: Sozlamalar → «Yangiliklar» (#/news),
// yangi versiyadan keyin bosh sahifada bir marta xabar chiqadi.

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  uz: string[];
  ru: string[];
}

const parts = (v: string) => v.split('.').map(Number);
/** a versiyasi b dan yangiroqmi (1.10.0 > 1.9.3). */
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/**
 * Bosh sahifadagi xabar uchun eng muhim yangilik: o'yinchi ko'rmagan relizlar orasida yangi imkoniyatli
 * (x.Y.0 yoki X.0.0) bo'lsa — eng yangisi shu, aks holda eng so'nggi reliz. Bir kunda bir nechta reliz
 * chiqsa, kichik tuzatish (masalan, yangi yutuq) undan oldingi katta yangilikni (yangi bo'lim) yashirmasin.
 */
export function headline(seen: string | null, list: Release[] = CHANGELOG): Release {
  const unseen = seen ? list.filter((r) => newer(r.version, seen)) : [];
  return unseen.find((r) => parts(r.version)[2] === 0) ?? list[0];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.22.0',
    date: '2026-11-24',
    uz: [
      "O'yinni yaxshilash uchun endi qaysi bosqichda qiyin bo'layotganini anonim tarzda hisoblaymiz: o'yin har qurilmadan faqat «ochildi», «1-daraja yechildi» kabi bosqich nomini bir marta yuboradi. Ism, ID, natijalar yoki boshqa ma'lumot yuborilmaydi.",
    ],
    ru: [
      'Чтобы улучшать игру, теперь анонимно считаем, на каком этапе становится трудно: с каждого устройства игра один раз отправляет только название этапа — «открыта», «пройден 1-й уровень» и т. п. Имя, ID, результаты и другие данные не отправляются.',
    ],
  },
  {
    version: '2.21.0',
    date: '2026-11-24',
    uz: [
      "Endi saytga Telegram orqali kirsa bo'ladi: «Telegram orqali kirish» ni bosing, botda saytdagi raqamni tanlang — tiklash kodini terish shart emas. Telefon, kompyuter, istalgan brauzerda.",
      "Sozlamalarda — «Telegram'ni bog'lash»: profilingizni bir marta bog'lasangiz, keyin hamma qurilmada Telegram orqali kirasiz. Telegram ichida o'ynaganlarning profili o'zi bog'lanadi.",
    ],
    ru: [
      'Теперь на сайт можно войти через Telegram: нажмите «Войти через Telegram» и выберите в боте число с сайта — код восстановления вводить не нужно. На телефоне, компьютере, в любом браузере.',
      'В настройках — «Привязать Telegram»: привяжите профиль один раз, и дальше на всех устройствах входите через Telegram. У тех, кто играет внутри Telegram, профиль привязывается сам.',
    ],
  },
  {
    version: '2.20.1',
    date: '2026-11-24',
    uz: [
      "Profilingiz serverda topilmasa (masalan, takroriy profil sifatida o'chirilgan bo'lsa), o'yin endi jimgina yangisini ochmaydi. «Profil topilmadi» oynasida asosiy profilingiz kodi bilan kirasiz — shu qurilmadagi natijalar unga qo'shiladi — yoki o'zingiz yangi profil ochasiz. Reytingda ismingiz qayta ko'payib ketmaydi.",
    ],
    ru: [
      'Если вашего профиля нет на сервере (например, он удалён как дубликат), игра больше не создаёт новый молча. В окне «Профиль не найден» войдите по коду основного профиля — результаты с этого устройства добавятся к нему — или сами создайте новый. Имя в рейтинге больше не будет повторяться.',
    ],
  },
  {
    version: '2.20.0',
    date: '2026-11-24',
    uz: [
      "Bosh sahifaning yuqorisida endi kim o'ynayotgani ko'rinadi: rangli avatar, taxallus, o'yinchi ID va reytingdagi o'rningiz. Bir xil ismli profillar ID va rangidan farqlanadi.",
      "Sozlamalarda — to'liq o'yinchi ID (nusxalash tugmasi bilan), profil ochilgan sana va reytingdagi o'rin. ID ochiq raqam: uni o'qituvchiga aytsa bo'ladi, kirish uchun esa tiklash kodi kerak.",
    ],
    ru: [
      'Вверху главной теперь видно, кто играет: цветной аватар, никнейм, ID игрока и ваше место в рейтинге. Профили с одинаковыми именами различаются по ID и цвету.',
      'В настройках — полный ID игрока (с кнопкой копирования), дата создания профиля и место в рейтинге. ID — открытый номер, его можно назвать учителю, а для входа нужен код восстановления.',
    ],
  },
  {
    version: '2.19.3',
    date: '2026-11-23',
    uz: [
      "Avval boshqa qurilmada yoki Telegram'da o'ynaganlar endi taxallus so'raladigan joyning o'zida (daraja yechilgach, reyting, bosh sahifa) «Avval o'ynaganmisiz? Tiklash kodini kiriting» orqali o'z profiliga qaytadi — reytingda bitta odamning ismi ko'payib ketmaydi.",
    ],
    ru: [
      'Кто уже играл на другом устройстве или в Telegram, теперь может вернуться в свой профиль прямо там, где просят никнейм (после решения уровня, в рейтинге, на главной): «Уже играли? Введите код восстановления» — имя одного игрока больше не размножается в рейтинге.',
    ],
  },
  {
    version: '2.19.2',
    date: '2026-11-23',
    uz: ["Bir necha yangilanishdan keyin qaytganingizda bosh sahifadagi xabar endi eng muhim yangilikni (masalan, yangi bo'limni) ko'rsatadi, faqat oxirgi kichik tuzatishni emas."],
    ru: ['Если вы вернулись после нескольких обновлений, сообщение на главной теперь показывает самую важную новость (например, новую главу), а не только последнее мелкое исправление.'],
  },
  {
    version: '2.19.1',
    date: '2026-11-23',
    uz: ["Yangi yutuq «NOR ustasi»: «Faqat NOR» bo'limidagi barcha darajalarni 3 ★ bilan yeching."],
    ru: ['Новое достижение «Мастер NOR»: пройдите все уровни раздела «Только NOR» на 3 ★.'],
  },
  {
    version: '2.19.0',
    date: '2026-11-23',
    uz: [
      "Yangi 8-bo'lim «Faqat NOR»: 6 ta daraja — faqat NOR elementlaridan NOT, OR, AND, XNOR, XOR va multipleksor yig'ing. Endi jami 48 daraja.",
      "Bo'lim xulosasida — nega NOR ham universal va Oyga uchgan «Apollon» kemasining kompyuteri bunga qanday misol.",
    ],
    ru: [
      'Новая 8-я глава «Только NOR»: 6 уровней — соберите NOT, OR, AND, XNOR, XOR и мультиплексор только из элементов NOR. Теперь всего 48 уровней.',
      'В итогах главы — почему NOR тоже универсален и при чём тут компьютер «Аполлона», летавшего к Луне.',
    ],
  },
  {
    version: '2.18.13',
    date: '2026-11-23',
    uz: ["3D rejimda maydon tinch turganda telefon protsessori ham to'liq dam oladi — batareya yanada tejaladi."],
    ru: ['В 3D-режиме, пока поле не меняется, процессор телефона полностью отдыхает — батарея расходуется ещё меньше.'],
  },
  {
    version: '2.18.12',
    date: '2026-11-23',
    uz: ["Ekran o'quvchi dasturlar (ko'zi ojiz o'yinchilar uchun) tasdiqlash oynasida endi sarlavhadan tashqari savolning o'zini ham o'qiydi."],
    ru: ['Программы экранного доступа (для незрячих игроков) в окне подтверждения теперь читают не только заголовок, но и сам вопрос.'],
  },
  {
    version: '2.18.11',
    date: '2026-11-23',
    uz: [
      "Yangi versiya chiqqandan keyin eski ochiq sahifada 3D yuklanmasa, endi bu haqida xabar chiqadi va maydon 2D ko'rinishda qoladi (oldin «3D» tanlangan ko'rinar, maydon esa o'zgarmasdi).",
      "Elementni sudrab turganda ko'rinish almashsa, uning yangi joyi endi saqlanadi va «Bekor qilish» bilan qaytariladi.",
    ],
    ru: [
      'Если после выхода новой версии в старой открытой вкладке не загрузился 3D, теперь появляется сообщение и поле остаётся в 2D (раньше кнопка «3D» была выбрана, а поле не менялось).',
      'Если вид переключился, пока вы перетаскивали элемент, его новое место теперь сохраняется и отменяется кнопкой «Отменить».',
    ],
  },
  {
    version: '2.18.10',
    date: '2026-11-23',
    uz: [
      "Tik telefonda «2D Real» platasidagi yozuvlar endi oynadagi aksdek teskari emas, to'g'ri o'qiladi.",
      "3D'dan 2D'ga o'tganda sxema endi ekranga to'liq joylashadi — oldin ba'zan burchakka surilib, kirishlar ko'rinmay qolardi.",
      "Uslub menyusini Esc bilan yopganda maydonda tanlangan element tanlovdan chiqib ketmaydi.",
    ],
    ru: [
      'На телефоне в вертикальном положении надписи на плате «2D Real» больше не отображаются зеркально.',
      'При переключении из 3D в 2D схема теперь целиком помещается на экране — раньше она иногда уезжала в угол, и входы не были видны.',
      'Закрытие меню стилей клавишей Esc больше не снимает выделение с элемента на поле.',
    ],
  },
  {
    version: '2.18.9',
    date: '2026-11-23',
    uz: ["Kichik va yotiq ekranlarda oyna ichida aylantirish kerak bo'lsa ham «Keyingi daraja», «Tushunarli» kabi tugmalar endi doim pastda ko'rinib turadi."],
    ru: ['На маленьких и горизонтальных экранах кнопки вроде «Следующий уровень» и «Понятно» теперь всегда видны внизу окна, даже если его нужно прокручивать.'],
  },
  {
    version: '2.18.8',
    date: '2026-11-23',
    uz: ["Telefonni yotqizib o'ynaganda maydon ancha kattaroq: sarlavha, elementlar paneli va tugmalar ixchamroq bo'lib, bitta qatorga joylashadi."],
    ru: ['Если играть, повернув телефон горизонтально, поле стало заметно больше: заголовок, панель элементов и кнопки компактнее и умещаются в одну строку.'],
  },
  {
    version: '2.18.7',
    date: '2026-11-22',
    uz: ["Eng tor telefonlarda (320 px) rus tilida «Darajalar» ekranidagi uzun so'zlar endi karta va daraja plitkasidan chiqib ketmaydi: bo'lim yulduzlari sarlavha ostiga tushadi."],
    ru: ['На самых узких телефонах (320 px) длинные слова на экране «Уровни» больше не вылезают за карточку и плитку уровня: звёзды главы переносятся под заголовок.'],
  },
  {
    version: '2.18.6',
    date: '2026-11-22',
    uz: ["3D rejim telefonni kamroq qizdiradi va batareyani tejaydi: sxema o'zgarmay turganda maydon qayta-qayta chizilmaydi."],
    ru: ['3D-режим меньше нагревает телефон и бережёт батарею: пока схема не меняется, поле не перерисовывается снова и снова.'],
  },
  {
    version: '2.18.5',
    date: '2026-11-22',
    uz: [
      "3D rejimda boshqa ilovaga o'tib qaytganingizda (ayniqsa telefonda va Telegram ichida) maydon bo'sh qolmaydi — sxema o'zi qayta chiziladi.",
    ],
    ru: [
      'В 3D-режиме поле больше не остаётся пустым, когда вы переключаетесь в другое приложение и возвращаетесь (особенно на телефоне и в Telegram) — схема перерисовывается сама.',
    ],
  },
  {
    version: '2.18.4',
    date: '2026-11-20',
    uz: [
      "Telegram Mini App va telefonda ko'rinish tugmalari (2D/3D/Sxema, uslub va 3D kamera) maydon o'rtasiga chiqib qolishi hamda palitra bilan to'qnashishi tuzatildi.",
      "Tor vertikal ekranlarda 3D plata kamerasi va burchagi maydon bo'ylab kattaroq va markazroq joylashtirildi, sensorli ulash/bosish zonasi kengaytirildi.",
      "Telegram ichida takroriy «Orqaga» tugmasi olib tashlandi va xavfsiz chegaralar (safe-area) hamda ixcham palitra moslashtirildi.",
    ],
    ru: [
      'Исправлена панель переключения режимов (2D/3D/Схема, стиль и 3D-камера) в Telegram Mini App и на телефонах: она больше не наезжает на центр поля и кнопки масштаба.',
      'На узких вертикальных экранах 3D-плата теперь крупнее и точнее центрируется в видимой области, а сенсорные зоны портов и тумблеров увеличены.',
      'В Telegram убрана дублирующая кнопка «Назад», учтены системные отступы safe-area и сделана более компактная нижняя панель.',
    ],
  },
  {
    version: '2.18.3',
    date: '2026-11-20',
    uz: [
      "3D rejimda kirish tumbleri va chiqish indikatorida to'q old panel, perimetr hoshiyasi hamda ikki rangli (xrom asos + yorqin uchi) tumbler dastagi kontrasti keskin oshirildi.",
    ],
    ru: [
      'В 3D-режиме усилен контраст входных тумблеров и индикаторов выхода: тёмная лицевая панель, светящаяся рамка по периметру и двухцветный рычаг переключателя.',
    ],
  },
  {
    version: '2.18.2',
    date: '2026-11-20',
    uz: [
      "3D rejimda bitta manbadan tarmoqlangan simlar ustidagi tugun (post va mufta), burilish tirsaklari hamda element kirish portlari jips ulandi.",
    ],
    ru: [
      'В 3D-режиме узел разветвления проводов (стойка и муфта), угловые сгибы и входные порты элементов теперь соединяются плотно и без разрывов.',
    ],
  },
  {
    version: '2.18.1',
    date: '2026-11-20',
    uz: [
      "3D rejimda barcha simlar, tumbler dastaklari va element korpuslari ikkinchi kadrda yo'qolib ketishi tuzatildi.",
      "3D rejimda yoniq (1) va o'chiq (0) simlar, mikrosxema ustki yuzasi (0/1 nishoni), tumblerlar va svetodiodlar farqi keskin oshirildi.",
    ],
    ru: [
      'В 3D-режиме исправлено исчезновение проводов, тумблеров и корпусов микросхем со второго кадра.',
      'В 3D-режиме резко усилен контраст между активным (1) и неактивным (0) состоянием проводов, чипов (значок 0/1), тумблеров и светодиодов.',
    ],
  },
  {
    version: '2.18.0',
    date: '2026-11-20',
    uz: [
      "Yangi AAA studiya ko'rinishi: o'yin sukut bo'yicha jonli «2D Real — Sanoat PCB» uslubida ochiladi, endi «3D Real» rejimi ham bor!",
      "3D rejimda kamerani aylantirish, egish va yaqinlashtirish, hajmli chiplar, egilgan jumper simlar, jonli soya va porlaydigan svetodiodlar bilan bevosita sxema yig'ing.",
      "To'rtta alohida apparat uslubi Sozlamalar va maydonning o'zida tanlanadi: Sanoat PCB, Laboratoriya stoli, Maket platasi (Breadboard) va Kiber Sci-Fi — klassik Plata, Daftar va Chizma mavzulari ham saqlab qolindi.",
      "Yoniq simlarda tok oqimi animatsiyasi va mexanik tumbler/mikrosxema ovozlari qo'shildi.",
    ],
    ru: [
      'Новый внешний вид AAA-студии: игра теперь открывается в детальном режиме «2D Real — Промышленная PCB», а также появился интерактивный режим «3D Real»!',
      'В 3D-режиме вращайте и наклоняйте камеру, собирайте схемы прямо на объёмных микросхемах с изогнутыми перемычками, живыми тенями и светящимися светодиодами.',
      'Четыре аппаратных стиля на выбор в Настройках и прямо на поле: Промышленная PCB, Лабораторный стол, Макетная плата (Breadboard) и Кибер Sci-Fi — классические темы Плата, Тетрадь и Чертёж также сохранены.',
      'Добавлены анимация бегущего сигнала в активных проводах и объёмные механические звуки тумблеров и микросхем.',
    ],
  },
  {
    version: '2.17.5',
    date: '2026-11-12',
    uz: [
      "Matnni avtomatik nusxalab bo'lmasa (ba'zi telefon va brauzerlarda), u endi o'yin oynasida belgilangan holda chiqadi — uni bir bosishda nusxalab olasiz.",
    ],
    ru: [
      'Если текст не удаётся скопировать автоматически (на некоторых телефонах и в браузерах), он теперь показывается в окне игры уже выделенным — скопировать его можно одним нажатием.',
    ],
  },
  {
    version: '2.17.4',
    date: '2026-11-12',
    uz: [
      "«Maydonni tozalash», «Progressni o'chirish» va sinfdan chiqish kabi savollar endi brauzerning oddiy oynasida emas, o'yinning o'z oynasida chiqadi — tanlangan mavzuga mos, telefonda va Telegram ichida ham.",
    ],
    ru: [
      'Вопросы вроде «Очистить поле», «Сбросить прогресс» и выхода из класса теперь показываются не в простом окне браузера, а в окне самой игры — в цветах выбранной темы, и на телефоне, и в Telegram.',
    ],
  },
  {
    version: '2.17.3',
    date: '2026-11-12',
    uz: [
      "Telefonda Sozlamalar, Reyting va o'qituvchilar sahifalari ekranga to'liq sig'adi: kartalar o'ngdan kesilib qolmaydi (rus tilida bu ko'proq sezilardi).",
    ],
    ru: [
      'На телефоне «Настройки», «Рейтинг» и страница для учителей помещаются на экране целиком: карточки больше не обрезаются справа.',
    ],
  },
  {
    version: '2.17.2',
    date: '2026-11-11',
    uz: ["«Tartibga keltirish» tugmasi bitta elementli sxemada ham ishlaydi: element chiqish ro'parasiga qo'yiladi va sim to'g'ri chiziq bo'ladi."],
    ru: ['Кнопка «Упорядочить» работает и в схеме из одного элемента: элемент встаёт напротив выхода, и провод становится прямым.'],
  },
  {
    version: '2.17.1',
    date: '2026-11-11',
    uz: [
      "Qo'llanma sahifalari (mantiqiy elementlar, sanoq sistemalari, Bul algebrasi) va Telegram'dagi havola rasmi o'yinning yangi ko'rinishiga o'tdi.",
    ],
    ru: [
      'Справочные страницы (логические элементы, системы счисления, алгебра логики) и картинка ссылки в Telegram переведены на новый вид игры.',
    ],
  },
  {
    version: '2.17.0',
    date: '2026-11-11',
    uz: [
      "Ikki yangi mavzu: «Haqiqiy plata» — yashil plata, qora mikrosxemalar, oltin kontaktlar va svetodiod; «Chizma» — muhandislik chizmasi: oq qog'oz, qora chiziq, yoniq sim qizil.",
      "Sozlamalarda mavzu endi kichik namunasi bilan tanlanadi — qanday ko'rinishini oldindan ko'rasiz.",
    ],
    ru: [
      'Две новые темы: «Настоящая плата» — зелёная плата, чёрные микросхемы, золотые контакты и светодиод; «Чертёж» — инженерный чертёж: белый лист, чёрные линии, активный провод красный.',
      'В настройках тема выбирается по маленькому образцу — сразу видно, как она выглядит.',
    ],
  },
  {
    version: '2.16.0',
    date: '2026-11-11',
    uz: [
      "O'yin ko'rinishi yangilandi: ortiqcha hoshiyalar olib tashlandi, sarlavhalar yirikroq, ranglar sokinroq — asosiy narsa darhol ko'rinadi.",
      'Bosh sahifada ishlaydigan sxema: ikkala kalitni yoqing — chiroq yonadi.',
      "Maydondagi elementlar qalinroq chizilgan, yozuvlari o'qilishi oson.",
      "Kompyuterda bosh sahifa ikki ustunli: chapda o'yin, o'ngda kunlik masala va boshqa bo'limlar.",
    ],
    ru: [
      'Обновили внешний вид игры: убрали лишние рамки, заголовки стали крупнее, цвета спокойнее — главное видно сразу.',
      'На главной — работающая схема: включите оба переключателя, и лампа загорится.',
      'Элементы на поле нарисованы толще, подписи читаются легче.',
      'На компьютере главная в две колонки: слева игра, справа задача дня и остальные разделы.',
    ],
  },
  {
    version: '2.15.0',
    date: '2026-11-10',
    uz: [
      "Tekshiruv animatsiyasi kompyuterda animatsiya effektlari o'chirilgan bo'lsa ham ko'rinadi (ishxona va maktab kompyuterlarida ko'pincha shunday).",
      "Sozlamalarda «Animatsiya»: Avto, Yoqilgan yoki O'chirilgan. «O'chirilgan» da tekshiruv natijasi darhol chiqadi.",
    ],
    ru: [
      'Анимация проверки видна, даже если на компьютере отключены эффекты анимации (так часто бывает на рабочих и школьных компьютерах).',
      'В настройках — «Анимация»: Авто, Вкл. или Выкл. При «Выкл.» результат проверки появляется сразу.',
    ],
  },
  {
    version: '2.14.0',
    date: '2026-11-10',
    uz: [
      "Simlar endi sxema chizmalaridagidek: kesishgan joyda biri ko'prikcha bilan ustidan o'tadi, bitta manbadan tarmoqlangan joyda nuqta turadi, turli simlar bir chiziq ustiga tushmaydi va elementlar ichidan o'tmaydi.",
      "Simlar to'g'ri burchakli yo'llar bilan chiziladi — burchaklari kesilgan, plata ko'rinishi saqlangan.",
      "Telegram: internet sekin bo'lsa, Telegram'da saqlangan profil va o'qituvchi sinflari yangisi bilan almashib ketmaydi — javob kelmasa, «qayta urinish» taklif qilinadi.",
      "Qum quti, reyting, arxiv, yutuqlar va do'st masalasi ekranlari kerak bo'lganda yuklanadi — o'yin tezroq ochiladi.",
    ],
    ru: [
      'Провода теперь как на схемах: в месте пересечения один проходит над другим мостиком, в точке разветвления от одного источника стоит точка, разные провода не ложатся на одну линию и не проходят сквозь элементы.',
      'Провода рисуются прямоугольными трассами — со срезанными углами, вид платы сохранён.',
      'Telegram: при медленном интернете сохранённый в Telegram профиль и классы учителя не заменяются новыми — если ответа нет, предлагается «Повторить».',
      'Песочница, рейтинг, архив, достижения и задача друга загружаются по мере надобности — игра открывается быстрее.',
    ],
  },
  {
    version: '2.13.0',
    date: '2026-11-10',
    uz: [
      "Buzilgan havola yoki eski ma'lumot o'yinni oq ekranga aylantirmaydi: o'yin o'zi tiklanadi, kerak bo'lsa «qayta yuklash» va «ma'lumotni tozalash»ni taklif qiladi. Begona saytdan kelgan ko'chirish havolasi profilingizni almashtira olmaydi.",
      "Maktabdagi umumiy kompyuterda keyingi o'quvchiga oldingisining sertifikatdagi ismi chiqmaydi.",
      "«Davom etish»: keyingi bo'limga yulduz yetmasa, yana nechta kerakligi va qaysi darajani yaxshilash mumkinligi ko'rsatiladi. O'qituvchi vazifasi orqali ochilgan darajada yangi elementlar ham tanishtiriladi.",
      "«Yuqoriga-pastga» darajasi maslahatidagi formula tuzatildi, ikki dars matni aniqlashtirildi.",
      "Tekshiruv paytida sxemani klaviatura bilan ham o'zgartirib bo'lmaydi; Qum qutida katta sxemani sudrash tezlashdi; «Daftar» mavzusida yulduzlar va jadval raqamlari aniqroq.",
      "Telegram'da katta xotirali masala oddiy havola bilan ulashiladi — do'st masalasiz bosh sahifaga tushmaydi. Bosh sahifa boshqa qurilmada yechilgan kunlik masalani ham ko'rsatadi; server profilni topa olmasa, natijalar shu taxallus bilan yangi profilga o'tadi.",
      "Server: ertangi kunlik masalani oldindan ochib bo'lmaydi, reyting og'ir yukda ham tez, rad etilgan taxalluslar sinfning ro'yxatdan o'tishini to'smaydi, niqoblangan so'zli taxalluslar qabul qilinmaydi; kunlik masalalar yaqin kunlarda takrorlanmaydi.",
    ],
    ru: [
      'Испорченная ссылка или старые данные больше не превращают игру в белый экран: игра восстанавливается сама, а при необходимости предлагает «перезагрузить» и «очистить данные». Ссылка переноса с чужого сайта не может подменить ваш профиль.',
      'На общем школьном компьютере следующему ученику не показывается имя предыдущего в сертификате.',
      '«Продолжить»: если для следующей главы не хватает звёзд, видно, сколько ещё нужно и какой уровень можно улучшить. На уровне, открытом через задание учителя, новые элементы тоже представляются.',
      'Исправлена формула в подсказке уровня «Вверх-вниз», уточнены тексты двух уроков.',
      'Во время проверки схему нельзя изменить и с клавиатуры; в Песочнице большие схемы перетаскиваются быстрее; в теме «Тетрадь» звёзды и цифры таблицы чётче.',
      'В Telegram большая задача с памятью отправляется обычной ссылкой — друг не попадёт на главную без задачи. Главная показывает и ежедневную задачу, решённую на другом устройстве; если сервер не нашёл профиль, результаты переходят в новый профиль с тем же ником.',
      'Сервер: завтрашнюю ежедневную задачу нельзя открыть заранее, рейтинг быстр и под нагрузкой, отклонённые ники не мешают классу регистрироваться, замаскированные ники не принимаются; ежедневные задачи не повторяются в ближайшие дни.',
    ],
  },
  {
    version: '2.12.1',
    date: '2026-11-10',
    uz: [
      "«Tekshirish»da xato qator sekinroq ko'rsatiladi va noto'g'ri chiqish qizil miltillaydi — xato birinchi qatorning o'zida bo'lsa ham animatsiya ko'rinadi.",
    ],
    ru: [
      '«Проверка» медленнее показывает неверную строку, а неправильный выход мигает красным — анимация видна, даже если ошибка в самой первой строке.',
    ],
  },
  {
    version: '2.12.0',
    date: '2026-11-10',
    uz: [
      "Maktabdagi umumiy kompyuterda: boshqa o'quvchining tiklash kodi kiritilganda oldingi o'quvchining natijalari unga o'tib ketmaydi — o'yin avval ogohlantiradi va qurilmani tozalaydi.",
      "Profil ochilgan zahoti tiklash kodi ko'rsatiladi — uni daftarga yozib, keyingi darsda boshqa kompyuterda davom etish mumkin.",
      "Klaviatura bilan o'ynash mumkin: Tab bilan nuqta va elementlarni tanlang, Enter — ulash, strelkalar — surish, Delete — o'chirish; oynalar va xabarlarni ekran o'quvchi dasturlar ham o'qiydi.",
      "Ruscha qo'llanmadan yoki ruscha telefon va Telegram'dan kelganlarga o'yin birdaniga ruscha ochiladi.",
      "Telegram: profil tiklanayotganda tasodifan yangi profil ochilib qolmaydi, sekin internetda ekran o'zicha bosh sahifaga qaytmaydi; o'qituvchi sinflari Telegram'ning boshqa qurilmalarida ham ko'rinadi.",
      "O'qituvchi hisoboti dars paytida daqiqada bir yangilanadi, «faollik» kalendar kuni bo'yicha hisoblanadi, boshqa qurilmada o'chirilgan sinfni ro'yxatdan olib tashlash mumkin, «Progressni o'chirish» esa o'qituvchi kalitlarini ham o'chiradi.",
      "Qo'llanmalar bir marta ochilgach internetsiz ham ochiladi, Bul algebrasi kalkulyatori teng bo'lmagan ifodalar jadvalini ham ko'rsatadi, shriftlar har yangilanishda qayta yuklanmaydi.",
    ],
    ru: [
      'На общем школьном компьютере: при вводе кода восстановления другого ученика результаты предыдущего не переходят к нему — игра сначала предупреждает и очищает устройство.',
      'Код восстановления показывается сразу после создания профиля — его можно записать в тетрадь и на следующем уроке продолжить на другом компьютере.',
      'Можно играть с клавиатуры: Tab выбирает точки и элементы, Enter — соединить, стрелки — сдвинуть, Delete — удалить; окна и сообщения читают и экранные дикторы.',
      'Тем, кто пришёл с русского руководства или с телефона и Telegram на русском, игра сразу открывается на русском.',
      'Telegram: пока профиль восстанавливается, случайно не создаётся новый, при медленном интернете экран сам не возвращается на главную; классы учителя видны и на других устройствах с Telegram.',
      'Отчёт учителя во время урока обновляется раз в минуту, «активность» считается по календарным дням, удалённый на другом устройстве класс можно убрать из списка, а «Удалить прогресс» стирает и ключи учителя.',
      'Руководства после первого открытия работают без интернета, калькулятор алгебры логики показывает таблицу и для неравных выражений, шрифты не скачиваются заново при каждом обновлении.',
    ],
  },
  {
    version: '2.11.2',
    date: '2026-11-09',
    uz: [
      "Sinfda bir vaqtda 40 tagacha o'quvchi profil ochib o'ynay oladi — maktab Wi-Fi'ida ham «juda ko'p so'rov» xatosi chiqmaydi.",
      "Telefonda: elementlar palitrasini barmoq bilan surish mumkin (NOR, XNOR, D-trigger ham ko'rinadi), kirish tumbleri bosilganda sim boshlanib ketmaydi.",
      "Muharrir: o'chirilgan element simni buzmaydi, tanlangan sim boshqasiga sakramaydi, Qum qutida «bekor qilish» kirishlar sonini ham qaytaradi, «Tartibga keltirish» joylashi qayta ochilganda saqlanadi.",
      "Natijalar ikki tabda o'ynalganda yo'qolmaydi, serverga yuborilmay qolgan natijalar bitta xato tufayli to'xtab qolmaydi.",
      "O'yin tezroq ochiladi: kam ishlatiladigan sahifalar kerak bo'lganda yuklanadi.",
    ],
    ru: [
      'В классе одновременно до 40 учеников могут создать профиль и играть — даже через школьный Wi-Fi ошибка «слишком много запросов» не появляется.',
      'На телефоне: палитру элементов можно листать пальцем (видны и NOR, XNOR, D-триггер), нажатие на переключатель входа больше не начинает провод.',
      'Редактор: удалённый элемент не портит провода, выбранный провод не перескакивает на другой, в Песочнице «отменить» возвращает и число входов, расстановка «Упорядочить» сохраняется после повторного открытия.',
      'Результаты не теряются при игре в двух вкладках, а неотправленные результаты не застревают из-за одной ошибки.',
      'Игра открывается быстрее: редкие страницы загружаются, когда нужны.',
    ],
  },
  {
    version: '2.11.1',
    date: '2026-11-09',
    uz: [
      "Simlar endi to'g'ri chiziq bo'lib tushadi: element chiqishga yoki keyingi elementga ro'para qo'yilsa, sim o'rtasidagi mayda pog'ona yo'qoladi. «Tartibga keltirish» esa chiqishga boradigan simni doim to'g'ri chiziq qilib joylaydi.",
    ],
    ru: [
      'Провода теперь ложатся ровной линией: если элемент стоит напротив выхода или следующего элемента, мелкая ступенька посередине провода исчезает. А «Упорядочить» всегда делает провод к выходу прямым.',
    ],
  },
  {
    version: '2.11.0',
    date: '2026-11-09',
    uz: [
      "Saytda o'qituvchilar uchun sahifa: sinf rejimi qanday ishlashi va o'yin bilan o'tiladigan 3 ta tayyor dars ishlanmasi (45 daqiqa, darajalar, uy vazifasi, baholash).",
    ],
    ru: [
      'Страница для учителей на сайте: как работает режим класса и 3 готовых плана урока с игрой (45 минут, уровни, домашнее задание, оценивание).',
    ],
  },
  {
    version: '2.10.0',
    date: '2026-11-09',
    uz: [
      "«Tartibga keltirish» tugmasi (maydonning o'ng pastida): elementlar o'zi ustunlarga joylashadi, simlar chalkashmaydi — darajalarda ham, Qum qutida ham.",
    ],
    ru: [
      'Кнопка «Упорядочить» (справа внизу поля): элементы сами выстраиваются по столбцам, провода не путаются — и в уровнях, и в песочнице.',
    ],
  },
  {
    version: '2.9.0',
    date: '2026-11-09',
    uz: [
      "Telefonga o'rnatish: «O'rnatish» tugmasi (bosh sahifada va sozlamalarda) — o'yin ilova kabi ochiladi va internetsiz ishlaydi; iPhone uchun — qanday qo'shish izohi.",
      "O'rnatilgan ilova ikonkasini bosib tursangiz — tezkor havolalar: kunlik masala, darajalar, Qum quti.",
    ],
    ru: [
      'Установка на телефон: кнопка «Установить» (на главной и в настройках) — игра открывается как приложение и работает без интернета; для iPhone — подсказка, как добавить.',
      'Если удерживать значок установленного приложения — быстрые ссылки: задача дня, уровни, песочница.',
    ],
  },
  {
    version: '2.8.0',
    date: '2026-11-09',
    uz: [
      "Sertifikat: birinchi bo'lim tugagach ochiladi — ismingiz, tugatilgan bo'limlar va yulduzlar bilan; PNG qilib yuklab olish, ulashish yoki chop etish mumkin (Yutuqlar ekranida).",
    ],
    ru: [
      'Сертификат: открывается после первой главы — с вашим именем, пройденными главами и звёздами; его можно скачать в PNG, отправить или распечатать (на экране «Достижения»).',
    ],
  },
  {
    version: '2.7.0',
    date: '2026-11-09',
    uz: [
      "Sozlamalarda — saytdagi barcha qo'llanmalar va kalkulyatorlar ro'yxati (Telegram ichidan ham ochiladi).",
      "Formulada NAND, NOR, XNOR so'zlarini ham yozish mumkin: A NAND B.",
      "Tuzatishlar: vazifa orqali yechilgan daraja vazifa o'chirilgandan keyin ham ochiq qoladi; juda uzun formula Qum qutini to'xtatib qo'ymaydi.",
    ],
    ru: [
      'В настройках — список всех справочников и калькуляторов сайта (открываются и из Telegram).',
      'В формулах можно писать NAND, NOR, XNOR словами: A NAND B.',
      'Исправления: уровень, решённый по заданию, остаётся открытым и после удаления задания; слишком длинная формула больше не ломает песочницу.',
    ],
  },
  {
    version: '2.6.0',
    date: '2026-11-09',
    uz: [
      "Saytda yangi qo'llanma — «Sanoq sistemalari»: sonni 2, 8, 10, 16 va boshqa sistemalar orasida o'tkazadigan kalkulyator, yechimi bosqichma-bosqich.",
    ],
    ru: [
      'Новый справочник на сайте — «Системы счисления»: калькулятор перевода между 2, 8, 10, 16 и другими системами с пошаговым решением.',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-11-09',
    uz: [
      "Qum qutida formuladan sxema: mantiqiy ifodani yozing — sxema o'zi yig'iladi va joylashadi.",
      "«Bul algebrasi» qo'llanmasidagi kalkulyatordan ifodani bir bosishda o'yinda sxema qilib ochish mumkin.",
    ],
    ru: [
      'Схема по формуле в песочнице: введите логическое выражение — схема соберётся и расположится сама.',
      'Из калькулятора в справочнике «Алгебра логики» выражение можно одним нажатием открыть в игре как схему.',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-11-09',
    uz: [
      "Saytda yangi qo'llanma — «Bul algebrasi»: qonunlar, ifodani soddalashtirish, Karno kartasi va istalgan ifodaning haqiqat jadvalini chiqaradigan kalkulyator.",
    ],
    ru: [
      'Новый справочник на сайте — «Алгебра логики»: законы, упрощение выражений, карты Карно и калькулятор таблиц истинности для любого выражения.',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-11-09',
    uz: [
      "O'qituvchi hisobotini Excel uchun yuklab olish, jadvalni nusxalab Google Sheets'ga qo'yish yoki chop etish mumkin.",
    ],
    ru: [
      'Отчёт учителя можно скачать для Excel, скопировать таблицу в Google Таблицы или распечатать.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-11-09',
    uz: [
      "Sinf vazifalari: o'qituvchi darajalarni tanlab vazifa beradi (muddat bilan ham), o'quvchilar uni bosh sahifada ko'radi, o'qituvchi esa kim bajarganini kuzatadi.",
      'Vazifadagi darajalar yulduzlar yetmasa ham ochiladi.',
    ],
    ru: [
      'Задания класса: учитель выбирает уровни и даёт задание (можно со сроком), ученики видят его на главной, а учитель — кто уже выполнил.',
      'Уровни из задания открываются, даже если не хватает звёзд.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-11-09',
    uz: [
      "Yechimlar diagrammasi: daraja yoki kunlik masala yechilgach, boshqa o'yinchilar nechta element ishlatgani va sizning o'rningiz ko'rinadi.",
    ],
    ru: [
      'Диаграмма решений: после уровня или задачи дня видно, сколько элементов использовали другие игроки и где вы среди них.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-09',
    uz: [
      "Yangi ko'rinish: ikki mavzu — qorong'i «Plata» va yorug' «Daftar». Sozlamalarda tanlanadi.",
      "O'yin maydoni: simlar plata yo'llaridek, kirishlar — tumbler, chiqishlar — chiroq.",
      "Bosh sahifa: navbatdagi daraja kichik sxemasi bilan, pastda qulay menyu.",
      "Darajalar xaritasi: daraja yechilganda keyingisigacha yo'l yonadi.",
      "Sinf rejimi: o'qituvchi sinf yaratadi, o'quvchilar havola orqali qo'shiladi, o'qituvchi natijalarni ko'radi.",
      "Reytingda birinchi uch o'rin — shohsupada.",
      'Yangi logotip va ikonkalar.',
      "Saytda ikkita qo'llanma: mantiqiy elementlar va ikkilik sanoq sistemasi.",
    ],
    ru: [
      'Новый вид: две темы — тёмная «Плата» и светлая «Тетрадь». Выбирается в настройках.',
      'Игровое поле: провода как дорожки на плате, входы — тумблеры, выходы — лампочки.',
      'Главная: следующий уровень с мини-схемой и удобное меню внизу.',
      'Карта уровней: после решения загорается дорожка к следующему уровню.',
      'Режим класса: учитель создаёт класс, ученики присоединяются по ссылке, учитель видит результаты.',
      'В рейтинге первые три места — на пьедестале.',
      'Новый логотип и иконки.',
      'На сайте два справочника: логические элементы и двоичная система счисления.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-08',
    uz: [
      "7-bo'lim «Avtomatlar»: 6 ta yangi daraja — jami 42 ta.",
      "O'tgan kunlar masalalari: kecha va undan oldingi kunlik masalalarni ham yechish mumkin.",
      "Formula: yig'ilgan sxemaning ifodasi yon panelda ko'rinadi.",
      "Bo'lim xulosalari: bo'lim tugagach qisqa dars ochiladi.",
      'Yakshanba — xotira kuni: kunlik masala D-trigger bilan.',
    ],
    ru: [
      'Глава 7 «Автоматы»: 6 новых уровней — всего 42.',
      'Задачи прошлых дней: можно решить вчерашнюю и более ранние задачи дня.',
      'Формула: выражение собранной схемы видно на боковой панели.',
      'Итоги глав: после прохождения главы открывается короткий урок.',
      'Воскресенье — день памяти: задача дня с D-триггером.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-07',
    uz: [
      'Kunlik boshqotirma: har kuni yangi masala, kunlik reyting va seriya.',
      "Maslahatlar: avval yo'nalish, keyin yechim tarkibi.",
      "Do'stlar uchun masala: qum qutida sxema yig'ib, havola bilan yuborish.",
      '17 ta yutuq.',
      'Rus tili.',
      "Xotira bo'limi: D-trigger va takt.",
      "Telegram'da o'ynash (@LogicGateUzBot) va kunlik eslatma.",
      "Yangi manzil logic.noesis.uz; internet bo'lmasa ham ochiladi.",
    ],
    ru: [
      'Задача дня: каждый день новая задача, рейтинг дня и серия.',
      'Подсказки: сначала направление, затем состав решения.',
      'Задача для друзей: соберите схему в песочнице и отправьте ссылкой.',
      '17 достижений.',
      'Русский язык.',
      'Глава «Память»: D-триггер и такт.',
      'Игра в Telegram (@LogicGateUzBot) и ежедневное напоминание.',
      'Новый адрес logic.noesis.uz; открывается и без интернета.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-06',
    uz: [
      'Telefonda qulayroq: kirishlar tepada, chiqishlar pastda.',
      "Elementlar tavsifi telefonda ham ko'rinadi.",
      "Taxalluslar tekshiriladi: haqoratli so'zlar qabul qilinmaydi.",
    ],
    ru: [
      'Удобнее на телефоне: входы сверху, выходы снизу.',
      'Описания элементов видны и на телефоне.',
      'Никнеймы проверяются: оскорбительные слова не принимаются.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-05',
    uz: [
      "Birinchi versiya: 30 daraja, 5 bo'lim.",
      "Sxema muharriri: elementlarni sudrab qo'yish, simlar, haqiqat jadvali.",
      'Yulduzlar va umumiy reyting.',
    ],
    ru: [
      'Первая версия: 30 уровней, 5 глав.',
      'Редактор схем: перетаскивание элементов, провода, таблица истинности.',
      'Звёзды и общий рейтинг.',
    ],
  },
];
