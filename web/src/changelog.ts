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

export const CHANGELOG: Release[] = [
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
