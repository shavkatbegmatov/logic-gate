// Qo'llanma sahifalarining matnlari (scripts/pages.mjs). Maktab informatikasidagi atamalar bilan:
// qidiruvda odamlar aynan shularni yozadi (inkor, konyunksiya, dizyunksiya, таблица истинности…).
// Bu sahifalar ochiq — o'yindagi bo'lim xulosalaridan farqli o'laroq darajalarning yechimini aytmaydi.

/** Ruscha ko'plik: 1 уровень, 2 уровня, 5 уровней. */
function ruPlural(n, one, few, many) {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

export const CONTENT = {
  uz: {
    lang: 'uz',
    locale: 'uz_UZ',
    path: '/mantiqiy-elementlar/',
    title: 'Mantiqiy elementlar va haqiqat jadvallari | Logic Gate',
    description:
      "Mantiqiy elementlar EMAS, VA, YOKI, XOR, NAND, NOR va D-trigger: belgilari, formulalari va haqiqat jadvallari. Inkor, konyunksiya, dizyunksiya — misollar bilan, o'yinda mashq qilib.",
    h1: 'Mantiqiy elementlar va haqiqat jadvallari',
    lead: [
      "Kompyuter ichidagi hamma narsa — protsessor, xotira, kalkulyator — ikki qiymat bilan ishlaydi: 0 (yolg'on, tok yo'q) va 1 (rost, tok bor). Mantiqiy element kirishlaridagi 0 va 1 lardan bitta chiqish qiymatini hosil qiladi.",
      "Quyida har bir elementning belgisi, formulasi va haqiqat jadvali bor. Haqiqat jadvali — barcha kirish kombinatsiyalari uchun chiqish qiymatlari: n ta kirish bo'lsa, jadvalda 2ⁿ qator bo'ladi (bitta kirish — 2 qator, ikkita — 4, uchta — 8). Ikki sxemaning jadvallari bir xil bo'lsa, ular bir xil ishlaydi.",
    ],
    play: "▶ O'yinni boshlash",
    playTg: "Telegram'da o'ynash",
    free: "Bepul, ro'yxatdan o'tmasdan — telefon va kompyuterda.",
    toc: 'Mundarija',
    notation: 'Boshqa yozilishi',
    table: 'Haqiqat jadvali',
    gates: [
      {
        type: 'NOT',
        title: 'EMAS (NOT) — inkor, inversiya',
        formula: 'Q = ¬A',
        notation: '¬A, Ā, NOT A, !A',
        text: "Bitta kirishli element: kirishni teskarisiga aylantiradi — 1 kelsa 0, 0 kelsa 1 chiqaradi. Belgi uchidagi kichik doiracha inkorni bildiradi; boshqa elementlarda ham shu ma'noda.",
      },
      {
        type: 'AND',
        title: "VA (AND) — konyunksiya, mantiqiy ko'paytirish",
        formula: 'Q = A ∧ B',
        notation: 'A ∧ B, A · B, A & B, A AND B',
        text: "Ikkala kirish ham 1 bo'lgandagina 1 chiqaradi. Oddiy ko'paytirishga o'xshaydi: 1 · 1 = 1, qolgan hollarda 0. Masalan, ikki qulfli eshik ikkala kalit ham burilgandagina ochiladi.",
      },
      {
        type: 'OR',
        title: "YOKI (OR) — dizyunksiya, mantiqiy qo'shish",
        formula: 'Q = A ∨ B',
        notation: 'A ∨ B, A + B, A | B, A OR B',
        text: "Kamida bitta kirish 1 bo'lsa, 1 chiqaradi; ikkalasi 0 bo'lsagina 0. Masalan, ikki tugmali qo'ng'iroq qaysi tugma bosilsa ham chalinadi.",
      },
      {
        type: 'XOR',
        title: "Istisno YOKI (XOR) — 2 modul bo'yicha qo'shish",
        formula: 'Q = A ⊕ B',
        notation: 'A ⊕ B, A XOR B, A ^ B',
        text: "Kirishlar har xil bo'lsa 1, bir xil bo'lsa 0 chiqaradi. Ikki bitni qo'shganda yig'indining oxirgi raqami aynan A ⊕ B bo'ladi (ikkilikda 1 + 1 = 10), shuning uchun XOR qo'shuvchi sxemalarda ko'p uchraydi.",
      },
      {
        type: 'NAND',
        title: 'VA-EMAS (NAND) — Sheffer shtrixi',
        formula: 'Q = ¬(A ∧ B)',
        notation: 'A ↑ B, A NAND B',
        text: "AND natijasining teskarisi: faqat ikkala kirish 1 bo'lganda 0 chiqaradi. NAND universal element — istalgan mantiqiy sxemani faqat NAND'lardan yig'ish mumkin; mikrosxemalarda u eng ko'p ishlatiladi.",
      },
      {
        type: 'NOR',
        title: 'YOKI-EMAS (NOR) — Pirs strelkasi',
        formula: 'Q = ¬(A ∨ B)',
        notation: 'A ↓ B, A NOR B',
        text: "OR natijasining teskarisi: faqat ikkala kirish 0 bo'lganda 1 chiqaradi. NOR ham universal element.",
      },
      {
        type: 'XNOR',
        title: 'Tenglik (XNOR) — ekvivalensiya',
        formula: 'Q = ¬(A ⊕ B)',
        notation: 'A ≡ B, A ↔ B, A XNOR B',
        text: "XOR natijasining teskarisi: kirishlar bir xil bo'lsa 1 chiqaradi. Ikki bitni taqqoslash uchun qulay.",
      },
    ],
    memory: {
      title: 'Xotira: D-trigger',
      formula: 'q⁺ = D',
      text: [
        "Yuqoridagi elementlar faqat hozirgi kirishlarga qaraydi. D-trigger esa xotiraga ega: har bir taktda D kirishidagi qiymatni eslab qoladi va uni keyingi taktda Q chiqishida beradi. Boshida Q = 0.",
        'Triggerlar va mantiqiy elementlardan hisoblagichlar, registrlar va chekli avtomatlar yig\'iladi — masalan, turniket yoki svetofor boshqaruvi.',
      ],
      step: 'Takt',
    },
    laws: {
      title: 'Bul algebrasining asosiy qonunlari',
      rows: [
        ['Ikki marta inkor', '¬¬A = A'],
        ['0 va 1 bilan', 'A ∧ 1 = A,  A ∧ 0 = 0,  A ∨ 0 = A,  A ∨ 1 = 1'],
        ["O'zi bilan", 'A ∧ A = A,  A ∨ A = A,  A ∧ ¬A = 0,  A ∨ ¬A = 1'],
        ['De Morgan qonunlari', '¬(A ∧ B) = ¬A ∨ ¬B,  ¬(A ∨ B) = ¬A ∧ ¬B'],
        ['Taqsimot qonuni', 'A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)'],
        ['XOR xossalari', 'A ⊕ 0 = A,  A ⊕ 1 = ¬A,  A ⊕ A = 0'],
      ],
      tip: "Ifodani soddalashtirish — sxemadagi elementlarni kamaytirish demak. Logic Gate o'yinida aynan shunga yulduz beriladi.",
    },
    game: {
      title: "Logic Gate o'yini",
      text: "Logic Gate — mantiqiy elementlardan sxema yig'ib, boshqotirma yechadigan bepul o'yin. Har bir darajada vazifa va haqiqat jadvali beriladi: elementlarni maydonga qo'yasiz, simlar bilan ulaysiz va sxemani tekshirasiz. Elementlar qancha kam bo'lsa, yulduz shuncha ko'p.",
      chapters: (n, levels) => `${n} ta bo'lim, ${levels} ta daraja:`,
      levels: (n) => `${n} daraja`,
      features: [
        'Har kuni yangi boshqotirma va kunlik reyting',
        "Qum quti: istalgan sxemani yig'ib, haqiqat jadvali va formulasini ko'rish",
        "O'z masalangizni havola orqali do'stlarga yuborish",
        "O'zbek va rus tillarida; internet bo'lmasa ham ishlaydi",
      ],
    },
    daily: 'Bugungi boshqotirma',
    other: { label: 'Русский', lang: 'ru' },
  },

  ru: {
    lang: 'ru',
    locale: 'ru_RU',
    path: '/ru/logicheskie-elementy/',
    title: 'Логические элементы и таблицы истинности | Logic Gate',
    description:
      'Логические элементы НЕ, И, ИЛИ, XOR, И-НЕ, ИЛИ-НЕ и D-триггер: обозначения, формулы и таблицы истинности. Инверсия, конъюнкция, дизъюнкция — с примерами и практикой в игре.',
    h1: 'Логические элементы и таблицы истинности',
    lead: [
      'Всё внутри компьютера — процессор, память, калькулятор — работает с двумя значениями: 0 (ложь, тока нет) и 1 (истина, ток есть). Логический элемент из нулей и единиц на входах получает одно значение на выходе.',
      'Ниже для каждого элемента — обозначение, формула и таблица истинности, то есть значения выхода для всех комбинаций входов. Если входов n, в таблице 2ⁿ строк (один вход — 2 строки, два — 4, три — 8). Схемы с одинаковыми таблицами работают одинаково.',
    ],
    play: '▶ Начать игру',
    playTg: 'Играть в Telegram',
    free: 'Бесплатно и без регистрации — на телефоне и компьютере.',
    toc: 'Содержание',
    notation: 'Другие обозначения',
    table: 'Таблица истинности',
    gates: [
      {
        type: 'NOT',
        title: 'НЕ (NOT) — инверсия, отрицание',
        formula: 'Q = ¬A',
        notation: '¬A, Ā, NOT A, !A',
        text: 'Элемент с одним входом: меняет значение на противоположное — из 1 делает 0, из 0 делает 1. Кружок на конце обозначения означает отрицание, и у других элементов тоже.',
      },
      {
        type: 'AND',
        title: 'И (AND) — конъюнкция, логическое умножение',
        formula: 'Q = A ∧ B',
        notation: 'A ∧ B, A · B, A & B, A AND B',
        text: 'Даёт 1, только когда оба входа равны 1. Похоже на обычное умножение: 1 · 1 = 1, в остальных случаях 0. Например, дверь с двумя замками открывается, только если повернуть оба ключа.',
      },
      {
        type: 'OR',
        title: 'ИЛИ (OR) — дизъюнкция, логическое сложение',
        formula: 'Q = A ∨ B',
        notation: 'A ∨ B, A + B, A | B, A OR B',
        text: 'Даёт 1, если хотя бы один вход равен 1; 0 — только когда оба входа 0. Например, звонок с двумя кнопками звенит от любой из них.',
      },
      {
        type: 'XOR',
        title: 'Исключающее ИЛИ (XOR) — сложение по модулю 2',
        formula: 'Q = A ⊕ B',
        notation: 'A ⊕ B, A XOR B, A ^ B',
        text: 'Даёт 1, если входы разные, и 0, если одинаковые. При сложении двух битов последняя цифра суммы — это как раз A ⊕ B (в двоичной системе 1 + 1 = 10), поэтому XOR часто встречается в сумматорах.',
      },
      {
        type: 'NAND',
        title: 'И-НЕ (NAND) — штрих Шеффера',
        formula: 'Q = ¬(A ∧ B)',
        notation: 'A ↑ B, A NAND B',
        text: 'Отрицание AND: даёт 0, только когда оба входа равны 1. NAND — универсальный элемент: любую логическую схему можно собрать только из NAND; в микросхемах он встречается чаще всего.',
      },
      {
        type: 'NOR',
        title: 'ИЛИ-НЕ (NOR) — стрелка Пирса',
        formula: 'Q = ¬(A ∨ B)',
        notation: 'A ↓ B, A NOR B',
        text: 'Отрицание OR: даёт 1, только когда оба входа равны 0. NOR тоже универсальный элемент.',
      },
      {
        type: 'XNOR',
        title: 'Равенство (XNOR) — эквивалентность',
        formula: 'Q = ¬(A ⊕ B)',
        notation: 'A ≡ B, A ↔ B, A XNOR B',
        text: 'Отрицание XOR: даёт 1, если входы одинаковые. Удобен для сравнения двух битов.',
      },
    ],
    memory: {
      title: 'Память: D-триггер',
      formula: 'q⁺ = D',
      text: [
        'Элементы выше смотрят только на текущие входы. У D-триггера есть память: на каждом такте он запоминает значение на входе D и выдаёт его на выходе Q на следующем такте. В начале Q = 0.',
        'Из триггеров и логических элементов собирают счётчики, регистры и конечные автоматы — например, управление турникетом или светофором.',
      ],
      step: 'Такт',
    },
    laws: {
      title: 'Основные законы алгебры логики',
      rows: [
        ['Двойное отрицание', '¬¬A = A'],
        ['С 0 и 1', 'A ∧ 1 = A,  A ∧ 0 = 0,  A ∨ 0 = A,  A ∨ 1 = 1'],
        ['С самим собой', 'A ∧ A = A,  A ∨ A = A,  A ∧ ¬A = 0,  A ∨ ¬A = 1'],
        ['Законы де Моргана', '¬(A ∧ B) = ¬A ∨ ¬B,  ¬(A ∨ B) = ¬A ∧ ¬B'],
        ['Распределительный закон', 'A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)'],
        ['Свойства XOR', 'A ⊕ 0 = A,  A ⊕ 1 = ¬A,  A ⊕ A = 0'],
      ],
      tip: 'Упростить выражение — значит убрать лишние элементы из схемы. В игре Logic Gate звёзды дают именно за это.',
    },
    game: {
      title: 'Игра Logic Gate',
      text: 'Logic Gate — бесплатная игра-головоломка, в которой нужно собирать схемы из логических элементов. На каждом уровне есть задание и таблица истинности: ставите элементы на поле, соединяете проводами и проверяете схему. Чем меньше элементов, тем больше звёзд.',
      chapters: (n, levels) => `${n} ${ruPlural(n, 'глава', 'главы', 'глав')}, ${levels} ${ruPlural(levels, 'уровень', 'уровня', 'уровней')}:`,
      levels: (n) => `${n} ${ruPlural(n, 'уровень', 'уровня', 'уровней')}`,
      features: [
        'Каждый день новая головоломка и рейтинг дня',
        'Песочница: соберите любую схему и посмотрите её таблицу истинности и формулу',
        'Свои задачи можно отправить друзьям ссылкой',
        'На узбекском и русском языках; работает и без интернета',
      ],
    },
    daily: 'Головоломка дня',
    other: { label: "O'zbekcha", lang: 'uz' },
  },
};
