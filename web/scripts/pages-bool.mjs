// "Bul algebrasi" qo'llanmasining matnlari (scripts/pages.mjs). Maktab va kollej informatikasidagi
// mavzu: amallar, qonunlar, De Morgan, soddalashtirish, jadvaldan formula (MDNSh), Karno kartasi.
// Misollar o'yindagi darajalarning jadvallari emas — yechimlar oshkor qilinmaydi (testda tekshiriladi).
// Har bir formula src/boolexpr.ts bilan tekshiriladi: qonunlar va soddalashtirish qadamlari haqiqatan teng.

/** Jadvaldan formula va Karno kartasi misoli: A, B, C; natija 1 — 010, 011, 111 qatorlarida. */
export const SOP_EXAMPLE = '00110001';

export const BOOL = {
  uz: {
    path: '/bul-algebrasi/',
    nav: 'Bul algebrasi',
    title: 'Bul algebrasi: qonunlar va soddalashtirish | Logic Gate',
    description:
      "Bul algebrasi: amallar, asosiy qonunlar, De Morgan qonunlari, ifodani soddalashtirish, jadvaldan formula va Karno kartasi — misollar va haqiqat jadvali kalkulyatori bilan.",
    h1: 'Bul algebrasi',
    lead: [
      "Bul algebrasi — faqat ikki qiymat bilan ishlaydigan algebra: 0 va 1 (yolg'on va rost). Uni XIX asrda ingliz matematigi Jorj Bul yaratgan. Bugun u har bir kompyuter va telefonning asosida: protsessor ichidagi har bir sxema — Bul ifodasi.",
      "Bu sahifada: amallar va ularning yozilishi, asosiy qonunlar, De Morgan qonunlari, ifodani soddalashtirish, haqiqat jadvalidan formula tuzish va Karno kartasi. Boshida — istalgan ifodaning haqiqat jadvalini chiqaradigan kalkulyator.",
    ],
    calc: {
      title: 'Haqiqat jadvali kalkulyatori',
      text: "Ifodani yozing — haqiqat jadvali darhol chiqadi. Ikkinchi maydonga boshqa ifoda yozsangiz, ular teng yoki teng emasligi tekshiriladi: masalan, soddalashtirish to'g'riligini bilish uchun.",
      labelA: '1-ifoda',
      labelB: "2-ifoda (solishtirish uchun, ixtiyoriy)",
      shortA: '1-ifoda',
      shortB: '2-ifoda',
      symbols: 'Belgilar',
      toSandbox: "Sxemasini o'yinda yig'ish →",
      syntax:
        "Yozuv: ¬ yoki ! — EMAS, ∧ yoki & — VA, ∨ yoki + — YOKI, ⊕ yoki ^ — XOR, qavslar ( ). O'zgaruvchilar — lotin harflari (A, B, C…), 6 tagacha. AB — bu A ∧ B, A' — bu ¬A.",
      equal: 'Ifodalar teng: barcha {n} qatorda natija bir xil.',
      differ: "Teng emas: {row} bo'lganda 1-ifoda = {p}, 2-ifoda = {q}.",
      rows: '{n} qator',
      errors: {
        empty: 'Ifoda yozing.',
        char: "Noma'lum belgi ({pos}-o'rinda).",
        end: 'Ifoda tugallanmagan.',
        unexpected: "Bu yerda xato bor ({pos}-o'rinda).",
        paren: 'Qavs yopilmagan.',
        vars: "O'zgaruvchilar ko'pi bilan 6 ta.",
      },
    },
    ops: {
      title: 'Amallar va ularning yozilishi',
      text: "Bul algebrasida uchta asosiy amal bor: inkor (EMAS), kon'yunksiya (VA) va diz'yunksiya (YOKI). Darsliklarda ular turlicha yoziladi — hammasi bir narsa.",
      cols: ['Amal', 'Yozilishi', "Natija 1, qachonki…"],
      rows: [
        ['Inkor — EMAS (NOT)', '¬A, Ā, A′, !A', 'A = 0'],
        ["Kon'yunksiya — VA (AND)", 'A ∧ B, A · B, AB, A & B', 'A ham, B ham 1'],
        ["Diz'yunksiya — YOKI (OR)", 'A ∨ B, A + B, A | B', 'kamida bittasi 1'],
        ['Istisno qiluvchi YOKI (XOR)', 'A ⊕ B, A ^ B', 'faqat bittasi 1'],
      ],
      order:
        "Amallar tartibi: avval inkor, keyin VA, keyin YOKI — oddiy algebrada ko'paytirish qo'shishdan oldin bajarilgani kabi. A ∨ B ∧ C — bu A ∨ (B ∧ C). Shubha bo'lsa, qavs qo'ying.",
    },
    laws: {
      title: 'Asosiy qonunlar',
      text: "Har bir qonun juft bo'lib keladi: biri VA uchun, ikkinchisi YOKI uchun. Birida ∧ ni ∨ ga, 0 ni 1 ga almashtirsangiz (va aksincha), ikkinchisi chiqadi — bu ikkiyoqlamalik (duallik) tamoyili.",
      cols: ['Qonun', 'VA uchun', 'YOKI uchun'],
      rows: [
        ['Neytral element', 'A ∧ 1 = A', 'A ∨ 0 = A'],
        ['Yutuvchi element', 'A ∧ 0 = 0', 'A ∨ 1 = 1'],
        ['Idempotentlik', 'A ∧ A = A', 'A ∨ A = A'],
        ["To'ldiruvchi", 'A ∧ ¬A = 0', 'A ∨ ¬A = 1'],
        ["O'rin almashtirish", 'A ∧ B = B ∧ A', 'A ∨ B = B ∨ A'],
        ['Guruhlash', '(A ∧ B) ∧ C = A ∧ (B ∧ C)', '(A ∨ B) ∨ C = A ∨ (B ∨ C)'],
        ['Taqsimot', 'A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)', 'A ∨ (B ∧ C) = (A ∨ B) ∧ (A ∨ C)'],
        ['Yutilish', 'A ∧ (A ∨ B) = A', 'A ∨ (A ∧ B) = A'],
        ['De Morgan', '¬(A ∧ B) = ¬A ∨ ¬B', '¬(A ∨ B) = ¬A ∧ ¬B'],
      ],
      double: 'Ikki marta inkor',
      doubleLaw: '¬¬A = A',
      tip: "Ikkinchi taqsimot qonuni oddiy algebrada yo'q: u yerda a + b·c ≠ (a + b)·(a + c). Bul algebrasida esa u to'g'ri — kalkulyatorda tekshirib ko'ring.",
    },
    demorgan: {
      title: 'De Morgan qonunlari',
      text: [
        "Ingliz matematigi Avgust De Morgan nomi bilan ataladi. Qoida: inkor qavs ichiga kirganda VA YOKI ga, YOKI esa VA ga almashadi, har bir o'zgaruvchi inkor qilinadi.",
        "Hayotiy misol: «yomg'ir ham, qor ham yog'mayapti» — bu «yomg'ir yoki qor yog'yapti» emas degani. Jadvalda ikkala tomon har bir qatorda bir xil:",
      ],
      tip: "Shuning uchun faqat VA-EMAS (NAND) elementidan istalgan boshqa elementni yig'ish mumkin. Qanday qilib — Logic Gate o'yinining «Faqat NAND» bo'limida o'zingiz topasiz.",
    },
    simplify: {
      title: 'Ifodani soddalashtirish',
      text: "Soddalashtirish — natijani o'zgartirmasdan ifodani qisqartirish. Sxemada bu kamroq element degani: tezroq, arzonroq, kam quvvat oladi. Har qadamda bitta qonun qo'llanadi.",
      example: 'Misol',
      steps: [
        [
          ['(A ∧ B) ∨ (A ∧ ¬B)', ''],
          ['A ∧ (B ∨ ¬B)', 'taqsimot'],
          ['A ∧ 1', "to'ldiruvchi"],
          ['A', 'neytral element'],
        ],
        [
          ['A ∨ (¬A ∧ B)', ''],
          ['(A ∨ ¬A) ∧ (A ∨ B)', 'taqsimot (YOKI uchun)'],
          ['1 ∧ (A ∨ B)', "to'ldiruvchi"],
          ['A ∨ B', 'neytral element'],
        ],
        [
          ['¬(A ∧ ¬B)', ''],
          ['¬A ∨ ¬¬B', 'De Morgan'],
          ['¬A ∨ B', 'ikki marta inkor'],
        ],
      ],
      check: "Har bir natijani kalkulyatorda tekshirish mumkin: birinchi maydonga boshlang'ich ifodani, ikkinchisiga oxirgisini yozing.",
    },
    sop: {
      title: 'Haqiqat jadvalidan formula',
      text: [
        "Jadval bor, formula kerak bo'lsa: natija 1 bo'lgan har bir qatorni olamiz. Qatordagi o'zgaruvchi 1 bo'lsa o'zi, 0 bo'lsa inkori yoziladi va ular VA bilan ulanadi. Hosil bo'lgan hadlar YOKI bilan birlashtiriladi.",
        "Bu usul har doim ishlaydi — mukammal diz'yunktiv normal shakl (MDNSh) deyiladi, lekin uzun ifoda beradi. Keyin uni soddalashtiramiz.",
      ],
      caption: 'Misol: uchta kirish, natija 1 bo\'lgan qatorlar ajratilgan',
      term: 'Had',
      formula: 'MDNSh',
      simplified: 'Soddalashtirilgani',
      why: "Birinchi ikki had faqat C da farq qiladi: C ∨ ¬C = 1, ular ¬A ∧ B ga birlashadi. Ikkinchi va uchinchisi faqat A da farq qiladi: B ∧ C. Ikkinchi had ikki marta ishlatildi — bu mumkin, chunki X ∨ X = X.",
    },
    kmap: {
      title: 'Karno kartasi',
      text: [
        "Karno kartasi — o'sha jadvalning boshqacha joylashuvi: qo'shni kataklar faqat bitta o'zgaruvchida farq qiladi (ustunlar 00, 01, 11, 10 tartibida — Grey kodi). Shunda birlashtirsa bo'ladigan hadlar yonma-yon turadi.",
        "1 lar 2, 4 yoki 8 talik to'g'ri to'rtburchaklarga guruhlanadi (chetlar ham qo'shni). Har bir guruh — bitta had: unda guruh ichida o'zgarmaydigan o'zgaruvchilargina qoladi.",
      ],
      caption: 'Yuqorida — B va C, chapda — A',
      groups: ['Birinchi guruh: A = 0, B = 1 → ¬A ∧ B', 'Ikkinchi guruh: B = 1, C = 1 → B ∧ C'],
      result: 'Natija',
    },
    game: {
      title: "O'yinda mashq qiling",
      text: "Logic Gate o'yinida har bir daraja — haqiqat jadvali. Uni mantiqiy elementlardan yig'asiz, uchta yulduz esa eng qisqa sxema uchun beriladi — soddalashtirish aynan shu yerda kerak. Qum qutida istalgan sxemaning formulasini ham ko'rasiz.",
    },
    more: 'Batafsil: Bul algebrasi',
    related: 'Mantiqiy elementlar va haqiqat jadvallari',
  },

  ru: {
    path: '/ru/algebra-logiki/',
    nav: 'Алгебра логики',
    title: 'Алгебра логики: законы и упрощение | Logic Gate',
    description:
      'Алгебра логики (булева алгебра): операции, основные законы, законы де Моргана, упрощение выражений, СДНФ и карты Карно — с примерами и калькулятором таблиц истинности.',
    h1: 'Алгебра логики',
    lead: [
      'Алгебра логики (булева алгебра) работает всего с двумя значениями: 0 и 1 (ложь и истина). Её создал в XIX веке английский математик Джордж Буль. Сегодня она лежит в основе каждого компьютера и телефона: любая схема внутри процессора — это булево выражение.',
      'На этой странице: операции и их обозначения, основные законы, законы де Моргана, упрощение выражений, построение формулы по таблице истинности и карты Карно. В начале — калькулятор, который строит таблицу истинности любого выражения.',
    ],
    calc: {
      title: 'Калькулятор таблиц истинности',
      text: 'Введите выражение — таблица истинности появится сразу. Если ввести второе выражение, калькулятор проверит, равны ли они: например, чтобы убедиться, что упрощение сделано верно.',
      labelA: 'Выражение 1',
      labelB: 'Выражение 2 (для сравнения, необязательно)',
      shortA: 'Выр. 1',
      shortB: 'Выр. 2',
      symbols: 'Символы',
      toSandbox: 'Собрать схему в игре →',
      syntax:
        "Запись: ¬ или ! — НЕ, ∧ или & — И, ∨ или + — ИЛИ, ⊕ или ^ — исключающее ИЛИ, скобки ( ). Переменные — латинские буквы (A, B, C…), до 6. AB — это A ∧ B, A' — это ¬A.",
      equal: 'Выражения равны: результат совпадает во всех {n} строках.',
      differ: 'Не равны: при {row} выражение 1 = {p}, выражение 2 = {q}.',
      rows: 'Строк: {n}',
      errors: {
        empty: 'Введите выражение.',
        char: 'Неизвестный символ (позиция {pos}).',
        end: 'Выражение не закончено.',
        unexpected: 'Здесь ошибка (позиция {pos}).',
        paren: 'Скобка не закрыта.',
        vars: 'Не больше 6 переменных.',
      },
    },
    ops: {
      title: 'Операции и их обозначения',
      text: 'В алгебре логики три основные операции: отрицание (НЕ), конъюнкция (И) и дизъюнкция (ИЛИ). В учебниках их записывают по-разному — это одно и то же.',
      cols: ['Операция', 'Обозначения', 'Равна 1, когда…'],
      rows: [
        ['Отрицание — НЕ (NOT)', '¬A, Ā, A′, !A', 'A = 0'],
        ['Конъюнкция — И (AND)', 'A ∧ B, A · B, AB, A & B', 'и A, и B равны 1'],
        ['Дизъюнкция — ИЛИ (OR)', 'A ∨ B, A + B, A | B', 'хотя бы одна равна 1'],
        ['Исключающее ИЛИ (XOR)', 'A ⊕ B, A ^ B', 'ровно одна равна 1'],
      ],
      order:
        'Порядок действий: сначала отрицание, затем И, затем ИЛИ — как в обычной алгебре умножение выполняется раньше сложения. A ∨ B ∧ C — это A ∨ (B ∧ C). Если сомневаетесь, ставьте скобки.',
    },
    laws: {
      title: 'Основные законы',
      text: 'Законы идут парами: один для И, другой для ИЛИ. Если в одном заменить ∧ на ∨ и 0 на 1 (и наоборот), получится второй — это принцип двойственности.',
      cols: ['Закон', 'Для И', 'Для ИЛИ'],
      rows: [
        ['Нейтральный элемент', 'A ∧ 1 = A', 'A ∨ 0 = A'],
        ['Поглощающий элемент', 'A ∧ 0 = 0', 'A ∨ 1 = 1'],
        ['Идемпотентность', 'A ∧ A = A', 'A ∨ A = A'],
        ['Дополнение', 'A ∧ ¬A = 0', 'A ∨ ¬A = 1'],
        ['Переместительный', 'A ∧ B = B ∧ A', 'A ∨ B = B ∨ A'],
        ['Сочетательный', '(A ∧ B) ∧ C = A ∧ (B ∧ C)', '(A ∨ B) ∨ C = A ∨ (B ∨ C)'],
        ['Распределительный', 'A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)', 'A ∨ (B ∧ C) = (A ∨ B) ∧ (A ∨ C)'],
        ['Поглощение', 'A ∧ (A ∨ B) = A', 'A ∨ (A ∧ B) = A'],
        ['Де Морган', '¬(A ∧ B) = ¬A ∨ ¬B', '¬(A ∨ B) = ¬A ∧ ¬B'],
      ],
      double: 'Двойное отрицание',
      doubleLaw: '¬¬A = A',
      tip: 'Второго распределительного закона нет в обычной алгебре: там a + b·c ≠ (a + b)·(a + c). А в алгебре логики он верен — проверьте в калькуляторе.',
    },
    demorgan: {
      title: 'Законы де Моргана',
      text: [
        'Названы в честь английского математика Огастеса де Моргана. Правило: когда отрицание вносится в скобки, И меняется на ИЛИ, ИЛИ — на И, а каждая переменная получает отрицание.',
        'Пример из жизни: «не идёт ни дождь, ни снег» — значит, неверно, что «идёт дождь или снег». В таблице обе стороны совпадают в каждой строке:',
      ],
      tip: 'Поэтому из одного элемента И-НЕ (NAND) можно собрать любой другой. Как именно — узнаете сами в главе «Только NAND» игры Logic Gate.',
    },
    simplify: {
      title: 'Упрощение выражений',
      text: 'Упростить — значит сократить выражение, не меняя результата. Для схемы это меньше элементов: быстрее, дешевле, меньше энергии. На каждом шаге применяется один закон.',
      example: 'Пример',
      steps: [
        [
          ['(A ∧ B) ∨ (A ∧ ¬B)', ''],
          ['A ∧ (B ∨ ¬B)', 'распределительный'],
          ['A ∧ 1', 'дополнение'],
          ['A', 'нейтральный элемент'],
        ],
        [
          ['A ∨ (¬A ∧ B)', ''],
          ['(A ∨ ¬A) ∧ (A ∨ B)', 'распределительный (для ИЛИ)'],
          ['1 ∧ (A ∨ B)', 'дополнение'],
          ['A ∨ B', 'нейтральный элемент'],
        ],
        [
          ['¬(A ∧ ¬B)', ''],
          ['¬A ∨ ¬¬B', 'де Морган'],
          ['¬A ∨ B', 'двойное отрицание'],
        ],
      ],
      check: 'Каждый результат можно проверить в калькуляторе: в первое поле — исходное выражение, во второе — последнее.',
    },
    sop: {
      title: 'Формула по таблице истинности',
      text: [
        'Если есть таблица и нужна формула, берём каждую строку, где результат равен 1. Переменную, равную 1, пишем как есть, равную 0 — с отрицанием, и соединяем их через И. Полученные слагаемые объединяем через ИЛИ.',
        'Этот способ работает всегда — это совершенная дизъюнктивная нормальная форма (СДНФ), но выражение получается длинным. Потом его упрощают.',
      ],
      caption: 'Пример: три входа, строки с результатом 1 выделены',
      term: 'Слагаемое',
      formula: 'СДНФ',
      simplified: 'После упрощения',
      why: 'Первые два слагаемых отличаются только C: C ∨ ¬C = 1, они склеиваются в ¬A ∧ B. Второе и третье отличаются только A: B ∧ C. Второе слагаемое использовано дважды — так можно, потому что X ∨ X = X.',
    },
    kmap: {
      title: 'Карта Карно',
      text: [
        'Карта Карно — та же таблица, разложенная иначе: соседние клетки отличаются только одной переменной (столбцы идут в порядке 00, 01, 11, 10 — код Грея). Поэтому слагаемые, которые можно склеить, оказываются рядом.',
        'Единицы объединяют в прямоугольные группы по 2, 4 или 8 клеток (края тоже соседние). Каждая группа — одно слагаемое: в нём остаются только переменные, которые внутри группы не меняются.',
      ],
      caption: 'Сверху — B и C, слева — A',
      groups: ['Первая группа: A = 0, B = 1 → ¬A ∧ B', 'Вторая группа: B = 1, C = 1 → B ∧ C'],
      result: 'Итог',
    },
    game: {
      title: 'Потренируйтесь в игре',
      text: 'В игре Logic Gate каждый уровень — это таблица истинности. Вы собираете её из логических элементов, а три звезды дают за самую короткую схему — тут и нужно упрощение. В песочнице можно увидеть формулу любой схемы.',
    },
    more: 'Подробнее: алгебра логики',
    related: 'Логические элементы и таблицы истинности',
  },
};

/** Jadvaldan MDNSh: har bir 1 qatori — had (o'zgaruvchi yoki inkori, VA bilan). */
export function sopTerms(fn, vars = ['A', 'B', 'C']) {
  const terms = [];
  for (let r = 0; r < fn.length; r++) {
    if (fn[r] !== '1') continue;
    const bits = r.toString(2).padStart(vars.length, '0');
    terms.push({ row: bits, term: vars.map((v, i) => (bits[i] === '1' ? v : `¬${v}`)).join(' ∧ ') });
  }
  return terms;
}

/** Karno kartasi (3 o'zgaruvchi): qatorlar A = 0, 1; ustunlar BC Grey kodi tartibida. */
export const KMAP_COLS = ['00', '01', '11', '10'];

/** Misoldagi guruhlar: [A, BC] kataklar ro'yxati. */
export const KMAP_GROUPS = [
  { cells: ['0,11', '0,10'], term: '¬A ∧ B' },
  { cells: ['0,11', '1,11'], term: 'B ∧ C' },
];
export const SOP_SIMPLIFIED = '(¬A ∧ B) ∨ (B ∧ C)';
export const SOP_FACTORED = 'B ∧ (¬A ∨ C)';
