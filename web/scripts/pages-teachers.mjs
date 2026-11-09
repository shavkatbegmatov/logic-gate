// "O'qituvchilar uchun" sahifasi (scripts/pages.mjs): sinf rejimi qanday ishlashi va tayyor dars
// ishlanmalari. Darajalar id bo'yicha — raqami va nomi build'da levels.json dan olinadi (nomi
// o'zgarsa yoki tartib almashsa, sahifa o'zi yangilanadi; noma'lum id — test xatosi).
// Darslar yechimni aytmaydi: faqat qaysi darajalar va qanday tartibda.

export const TEACHERS = {
  uz: {
    path: '/oqituvchilar/',
    nav: "O'qituvchilar uchun",
    title: "O'qituvchilar uchun: dars ishlanmalari | Logic Gate",
    description:
      "Informatika darsi uchun bepul o'yin: mantiqiy elementlar, Bul algebrasi, ikkilik sanoq sistemasi. Sinf rejimi, vazifalar, Excel hisobot va 45 daqiqalik tayyor dars ishlanmalari.",
    h1: "O'qituvchilar uchun: Logic Gate bilan informatika darsi",
    lead: [
      "Logic Gate — mantiqiy elementlar va sxemalar mavzusini o'yin orqali o'rgatadigan bepul vosita. O'quvchilar telefon, kompyuter yoki Telegram'da o'ynaydi; ro'yxatdan o'tish shart emas.",
      "Sinf rejimida siz o'quvchilarning natijasini ko'rasiz, vazifa berasiz va hisobotni Excel'ga yuklab olasiz. Quyida — tayyor dars ishlanmalari.",
    ],
    create: 'Sinf yaratish',
    features: {
      title: 'Sinf rejimida nimalar bor',
      items: [
        ['Sinf — bir daqiqada', "Sinf nomini yozasiz — havola va kod tayyor. O'quvchilar havolani ochib, taxallus bilan qo'shiladi."],
        ['Vazifa va muddat', "Darajalarni tanlab vazifa berasiz, o'quvchilar uni bosh sahifada ko'radi. Vazifadagi darajalar o'quvchiga darhol ochiladi."],
        ['Hisobot', "Kim qaysi bo'limni yechgan, yulduzlar, kunlik masalalar, oxirgi faollik. Excel'ga yuklab olish yoki chop etish mumkin."],
        ['Sertifikat', "Bo'limni tugatgan o'quvchi sertifikatni PNG qilib yuklab oladi yoki chop etadi."],
        ['Internet sekin bo\'lsa ham', "O'yin yengil (1 MB dan kam), bir marta ochilgach internetsiz ham ishlaydi."],
        ['Ikki tilda', "O'zbek va rus tillarida — o'quvchi tilni o'zi tanlaydi."],
      ],
    },
    start: {
      title: 'Qanday boshlash',
      steps: [
        "O'yinni oching: Sozlamalar → «O'qituvchilar uchun: sinf yaratish».",
        "Sinf nomini yozing (masalan, «8-B sinf, 12-maktab») — havola, kod va o'qituvchi kalitini olasiz. Kalitni saqlab qo'ying: hisobot faqat u bilan ochiladi.",
        "Havolani o'quvchilarga Telegram guruhida yuboring yoki kodni doskaga yozing.",
        'Hisobot sahifasida natijalarni kuzating va vazifa bering.',
      ],
    },
    lessons: {
      title: 'Dars ishlanmalari',
      text: "Har bir dars 45 daqiqaga mo'ljallangan. Darajalar raqami o'yindagi xaritadagi bilan bir xil.",
      grade: 'Sinf',
      minutes: 'Davomiyligi: 45 daqiqa',
      goals: 'Maqsadlar',
      plan: 'Dars borishi',
      min: 'daq.',
      homework: 'Uy vazifasi',
      assess: 'Baholash',
      guide: "Qo'llanma",
      items: [
        {
          title: "1-dars. Mantiqiy elementlar: EMAS, VA, YOKI",
          grade: '8–9',
          guide: 'elements',
          goals: [
            "Mantiqiy amallarni (inkor, kon'yunksiya, diz'yunksiya) va ularning haqiqat jadvallarini bilish.",
            "Oddiy sxemani elementlardan yig'a olish.",
          ],
          inClass: ['b1', 'b2', 'b3', 'b4'],
          homework: ['b5', 'b6'],
          plan: [
            [5, "Kirish: «Kompyuter qanday qaror qabul qiladi?» — chiroq va kalit misoli. 0 va 1 — tok yo'q va tok bor."],
            [10, "Tushuntirish: EMAS, VA, YOKI elementlari va ularning haqiqat jadvallari (qo'llanma sahifasi bilan)."],
            [20, "Amaliyot: o'quvchilar o'yinda {inClass} darajalarini yechadi. Tez tugatganlar 3 yulduz uchun kamroq element bilan qayta yechadi."],
            [5, "Muhokama: qaysi masala qiyin bo'ldi, kim eng kam element ishlatdi — hisobotdan ko'rsating."],
            [5, "Uy vazifasini bering: o'yinda vazifa qilib, keyingi darsgacha muddat bilan."],
          ],
          assess: "Hisobotdagi «1» ustuni (1-bo'lim) va yulduzlar: masalan, 4 ta daraja — «3», 6 ta — «4», 6 ta va 15+ yulduz — «5».",
        },
        {
          title: '2-dars. XOR, NAND va Bul algebrasi qonunlari',
          grade: '9',
          guide: 'bool',
          goals: [
            'XOR (faqat bittasi) va NAND (VA-EMAS) elementlarini bilish.',
            "De Morgan qonunini haqiqat jadvali bilan tekshira olish.",
          ],
          inClass: ['x1', 'x2', 'x3', 'x4'],
          homework: ['x5', 'x6'],
          plan: [
            [5, 'Takrorlash: EMAS, VA, YOKI jadvallari — doskada qisqa savol-javob.'],
            [10, "Yangi mavzu: XOR va NAND. De Morgan qonuni — Bul algebrasi qo'llanmasidagi jadval va kalkulyator bilan."],
            [20, "Amaliyot: {inClass}. Qo'shimcha: Qum qutida «Formuladan sxema» bilan ¬(A ∧ B) va ¬A ∨ ¬B ni yig'ib, jadvallarini solishtirish."],
            [5, "Muhokama: nega NAND «universal» element deyiladi? (O'quvchilar buni «Faqat NAND» bo'limida o'zlari ko'radi.)"],
            [5, 'Uy vazifasini bering.'],
          ],
          assess: "Hisobotdagi «2» ustuni (2-bo'lim); Qum qutidagi topshiriq — og'zaki.",
        },
        {
          title: '3-dars. Ikkilik sanoq sistemasi va summator',
          grade: '9–10',
          guide: 'bases',
          goals: [
            "O'nlik sonni ikkilikka o'tkazish va ikkilik sonlarni qo'shish.",
            "Kompyuter sonlarni qanday qo'shishini — yarim va to'liq summator misolida tushunish.",
          ],
          inClass: ['c1', 'c6'],
          homework: ['m5'],
          plan: [
            [10, "Ikkilik sanoq sistemasi: o'tkazish (sanoq sistemalari kalkulyatori bilan tekshirish) va ikkilikda qo'shish."],
            [5, "Savol: ikkita bir bitli sonni qo'shganda natija uchun nechta bit kerak? (Yig'indi va ko'chish.)"],
            [20, 'Amaliyot: {inClass} — yarim va to\'liq summatorni yig\'ish.'],
            [5, "Muhokama: to'liq summatorlarni ketma-ket ulab, istalgan uzunlikdagi sonlarni qo'shish mumkin."],
            [5, "Uy vazifasini bering. Vazifadagi daraja o'quvchilarga yulduzlari yetmasa ham ochiladi."],
          ],
          assess: "Hisobotdagi «3» ustuni (3-bo'lim) va vazifalar kartasidagi «Bajardi» soni.",
        },
      ],
    },
    faq: {
      title: 'Savollar',
      items: [
        ["O'yin pullikmi?", "Yo'q, butunlay bepul va reklamasiz."],
        ["O'quvchilar ro'yxatdan o'tishi kerakmi?", "Yo'q. Sinfga qo'shilish uchun faqat taxallus yoziladi: telefon raqami, pochta yoki ism so'ralmaydi."],
        ["O'quvchi telefonini almashtirsa, natijalar yo'qoladimi?", "Yo'q: Sozlamalardagi tiklash kodi bilan boshqa qurilmada natijalar qaytadi."],
        ["Internet bo'lmasa-chi?", "Bir marta ochilgan o'yin internetsiz ham ishlaydi; natijalar internet paydo bo'lganda yuboriladi."],
        ['Hisobotni boshqa kompyuterda qanday ochaman?', "Sinf kodi va o'qituvchi kaliti bilan: «O'qituvchilar uchun» ekranidagi «Boshqa qurilmada yaratilgan sinf» bo'limida."],
      ],
    },
  },

  ru: {
    path: '/ru/uchitelyam/',
    nav: 'Учителям',
    title: 'Учителям: готовые планы уроков | Logic Gate',
    description:
      'Бесплатная игра для уроков информатики: логические элементы, алгебра логики, двоичная система. Режим класса, задания, отчёт в Excel и готовые планы уроков на 45 минут.',
    h1: 'Учителям: урок информатики с Logic Gate',
    lead: [
      'Logic Gate — бесплатный инструмент, который учит логическим элементам и схемам через игру. Ученики играют на телефоне, компьютере или в Telegram; регистрация не нужна.',
      'В режиме класса вы видите результаты учеников, даёте задания и скачиваете отчёт в Excel. Ниже — готовые планы уроков.',
    ],
    create: 'Создать класс',
    features: {
      title: 'Что есть в режиме класса',
      items: [
        ['Класс за минуту', 'Вводите название класса — ссылка и код готовы. Ученики открывают ссылку и присоединяются под никнеймом.'],
        ['Задания со сроком', 'Выбираете уровни и даёте задание — ученики видят его на главной. Уровни из задания открываются сразу.'],
        ['Отчёт', 'Кто какую главу прошёл, звёзды, задачи дня, последняя активность. Можно скачать в Excel или распечатать.'],
        ['Сертификат', 'Ученик, прошедший главу, скачивает сертификат в PNG или печатает его.'],
        ['Даже при медленном интернете', 'Игра лёгкая (меньше 1 МБ) и после первого открытия работает без интернета.'],
        ['На двух языках', 'Узбекский и русский — ученик выбирает язык сам.'],
      ],
    },
    start: {
      title: 'Как начать',
      steps: [
        'Откройте игру: Настройки → «Для учителей: создать класс».',
        'Введите название класса (например, «8-Б, школа №12») — получите ссылку, код и ключ учителя. Сохраните ключ: отчёт открывается только с ним.',
        'Отправьте ссылку ученикам в группу Telegram или напишите код на доске.',
        'Следите за результатами на странице отчёта и давайте задания.',
      ],
    },
    lessons: {
      title: 'Планы уроков',
      text: 'Каждый урок рассчитан на 45 минут. Номера уровней совпадают с картой в игре.',
      grade: 'Класс',
      minutes: 'Длительность: 45 минут',
      goals: 'Цели',
      plan: 'Ход урока',
      min: 'мин',
      homework: 'Домашнее задание',
      assess: 'Оценивание',
      guide: 'Справочник',
      items: [
        {
          title: 'Урок 1. Логические элементы: НЕ, И, ИЛИ',
          grade: '8–9',
          guide: 'elements',
          goals: ['Знать логические операции (отрицание, конъюнкция, дизъюнкция) и их таблицы истинности.', 'Уметь собрать простую схему из элементов.'],
          inClass: ['b1', 'b2', 'b3', 'b4'],
          homework: ['b5', 'b6'],
          plan: [
            [5, 'Вступление: «Как компьютер принимает решения?» — пример с лампой и выключателем. 0 и 1 — тока нет и ток есть.'],
            [10, 'Объяснение: элементы НЕ, И, ИЛИ и их таблицы истинности (по справочнику).'],
            [20, 'Практика: ученики решают в игре уровни {inClass}. Кто закончил раньше — решает заново меньшим числом элементов ради 3 звёзд.'],
            [5, 'Обсуждение: какая задача была трудной, кто использовал меньше всего элементов — покажите по отчёту.'],
            [5, 'Задайте домашнее задание: в игре как задание со сроком до следующего урока.'],
          ],
          assess: 'Столбец «1» (глава 1) в отчёте и звёзды: например, 4 уровня — «3», 6 — «4», 6 уровней и 15+ звёзд — «5».',
        },
        {
          title: 'Урок 2. XOR, И-НЕ и законы алгебры логики',
          grade: '9',
          guide: 'bool',
          goals: ['Знать элементы XOR (исключающее ИЛИ) и И-НЕ (NAND).', 'Уметь проверить закон де Моргана таблицей истинности.'],
          inClass: ['x1', 'x2', 'x3', 'x4'],
          homework: ['x5', 'x6'],
          plan: [
            [5, 'Повторение: таблицы НЕ, И, ИЛИ — короткий опрос у доски.'],
            [10, 'Новая тема: XOR и И-НЕ. Закон де Моргана — по таблице и калькулятору в справочнике по алгебре логики.'],
            [20, 'Практика: {inClass}. Дополнительно: в песочнице через «Схема по формуле» собрать ¬(A ∧ B) и ¬A ∨ ¬B и сравнить их таблицы.'],
            [5, 'Обсуждение: почему И-НЕ называют «универсальным» элементом? (Ученики увидят это сами в главе «Только NAND».)'],
            [5, 'Задайте домашнее задание.'],
          ],
          assess: 'Столбец «2» (глава 2) в отчёте; задание в песочнице — устно.',
        },
        {
          title: 'Урок 3. Двоичная система и сумматор',
          grade: '9–10',
          guide: 'bases',
          goals: ['Переводить десятичные числа в двоичные и складывать двоичные числа.', 'Понять, как компьютер складывает числа, на примере полусумматора и полного сумматора.'],
          inClass: ['c1', 'c6'],
          homework: ['m5'],
          plan: [
            [10, 'Двоичная система: перевод (с проверкой в калькуляторе систем счисления) и сложение в двоичной системе.'],
            [5, 'Вопрос: сколько бит нужно для результата при сложении двух однобитных чисел? (Сумма и перенос.)'],
            [20, 'Практика: {inClass} — собрать полусумматор и полный сумматор.'],
            [5, 'Обсуждение: соединяя полные сумматоры цепочкой, можно складывать числа любой длины.'],
            [5, 'Задайте домашнее задание. Уровень из задания открывается ученикам, даже если не хватает звёзд.'],
          ],
          assess: 'Столбец «3» (глава 3) в отчёте и число «Выполнили» в карточке заданий.',
        },
      ],
    },
    faq: {
      title: 'Вопросы',
      items: [
        ['Игра платная?', 'Нет, полностью бесплатная и без рекламы.'],
        ['Ученикам нужно регистрироваться?', 'Нет. Чтобы присоединиться к классу, вводится только никнейм: телефон, почта или имя не спрашиваются.'],
        ['Если ученик сменит телефон, результаты пропадут?', 'Нет: по коду восстановления из настроек результаты вернутся на другом устройстве.'],
        ['А если нет интернета?', 'Открытая один раз игра работает и без интернета; результаты отправятся, когда интернет появится.'],
        ['Как открыть отчёт на другом компьютере?', 'По коду класса и ключу учителя: на экране «Для учителей», в разделе «Класс, созданный на другом устройстве».'],
      ],
    },
  },
};
