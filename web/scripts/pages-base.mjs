// "Sanoq sistemalari" qo'llanmasining matnlari (scripts/pages.mjs): 2, 8, 10, 16 lik sistemalar,
// o'tkazish usullari va bosqichma-bosqich yechim ko'rsatadigan kalkulyator (scripts/numbase.mjs).
// Misollar build'da hisoblanadi — qo'lda yozilgan son yo'q.

/** Misollar: kalkulyatorning boshlang'ich qiymati va bo'limlardagi yechimlar. */
export const BASE_EXAMPLES = {
  calc: ['2026', 10, 16],
  toBase: ['2026', 10, 16],
  toDec: ['7EA', 16, 10],
  group8: ['11111101010', 2, 8],
  group16: ['11111101010', 2, 16],
};

export const BASES = {
  uz: {
    path: '/sanoq-sistemalari/',
    nav: 'Sanoq sistemalari',
    title: "Sanoq sistemalari: o'tkazish kalkulyatori | Logic Gate",
    description:
      "Sanoq sistemalari: sonni o'nlikdan ikkilik, sakkizlik va o'n oltilik sistemaga o'tkazish va aksincha — yechimini bosqichma-bosqich ko'rsatadigan kalkulyator, jadval va misollar.",
    h1: 'Sanoq sistemalari',
    lead: [
      "Sanoq sistemasi — sonlarni raqamlar bilan yozish usuli. Biz o'nlik sistemadan foydalanamiz: 10 ta raqam (0–9), har bir o'rin o'ngdagisidan 10 marta katta. Sistemaning asosi — undagi raqamlar soni.",
      "Kompyuter ikkilik sistemada (asos 2) ishlaydi, ikkilik sonlarni qisqa yozish uchun esa sakkizlik (8) va o'n oltilik (16) sistemalar ishlatiladi. O'n oltilik sistemada 9 dan keyin harflar keladi: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.",
    ],
    calc: {
      title: "O'tkazish kalkulyatori",
      text: "Sonni yozing va sistemalarni tanlang — natija va yechim bosqichlari darhol chiqadi. Butun musbat sonlar, 2⁶⁴ gacha; 2 dan 16 gacha istalgan asos.",
      number: 'Son',
      from: 'Qaysi sistemadan',
      to: 'Qaysi sistemaga',
      swap: 'Sistemalarni almashtirish',
      names: { 2: 'ikkilik', 8: 'sakkizlik', 10: "o'nlik", 16: "o'n oltilik" },
      steps: {
        division: "{to} lik sistemaga: sonni {to} ga bo'lib, qoldiqni yozib boramiz — bo'linma 0 bo'lguncha.",
        expansion: "O'nlikka: har bir raqamni o'z o'rin qiymatiga ({from} ning darajasiga) ko'paytirib, qo'shamiz.",
        group: "{from} va {to} — ikkining darajalari, shuning uchun ikkilik orqali guruhlab o'tkazamiz: sakkizlik raqam — 3 bit, o'n oltilik — 4 bit.",
        via10: "{from} likdan {to} likka to'g'ridan-to'g'ri qoida yo'q: avval o'nlikka, keyin {to} likka o'tkazamiz.",
        dividend: "Bo'lish",
        quotient: "Bo'linma",
        remainder: 'Qoldiq',
        readUp: 'Qoldiqlar pastdan yuqoriga:',
        digitsTo: "Har bir raqam — {n} bit:",
        bitsTo: "Bitlar o'ngdan {n} tadan guruhlanadi, har guruh — bitta raqam:",
        same: "Sistemalar bir xil — son o'zgarmaydi.",
      },
      errors: {
        empty: 'Son yozing.',
        digit: '«{d}» raqami {from} lik sistemada yo\'q.',
        big: 'Son juda katta (2⁶⁴ gacha).',
        base: 'Asos 2 dan 16 gacha bo\'lsin.',
      },
    },
    table: { title: "0 dan 16 gacha: to'rt sistemada", cols: ["O'nlik", 'Ikkilik', 'Sakkizlik', "O'n oltilik"] },
    toBase: {
      title: "O'nlikdan boshqa sistemaga: bo'lish",
      text: "Sonni yangi asosga bo'lamiz, qoldiqni yozamiz va bo'linmani yana bo'lamiz — 0 bo'lguncha. Qoldiqlar pastdan yuqoriga o'qiladi: bu natija. Misol — 2026 ni o'n oltilikka:",
    },
    toDec: {
      title: "Boshqa sistemadan o'nlikka: yoyish",
      text: "Har bir raqam o'z o'rin qiymatiga ko'paytiriladi: o'ngdagi raqam — asos⁰ = 1 ga, keyingisi — asos¹ ga, undan keyingisi — asos² ga… Natijalar qo'shiladi. Misol — 7EA₁₆:",
    },
    groups: {
      title: "Ikkilik, sakkizlik va o'n oltilik: guruhlash",
      text: "8 = 2³ va 16 = 2⁴, shuning uchun bo'lish shart emas: ikkilik son o'ngdan 3 tadan (sakkizlikka) yoki 4 tadan (o'n oltilikka) guruhlanadi, har bir guruh bitta raqamga aylanadi. Teskarisi — har bir raqam 3 yoki 4 bitga yoyiladi.",
    },
    tip: "Logic Gate o'yinida bitlar bilan ishlaydigan sxemalarni — qo'shuvchi, taqqoslagich, hisoblagich — mantiqiy elementlardan o'zingiz yig'asiz.",
    related: ['Ikkilik sanoq sistemasi: bitlar va qo\'shish', 'Mantiqiy elementlar va haqiqat jadvallari'],
    more: "Boshqa sistemalar: 8, 16 lik va kalkulyator",
  },

  ru: {
    path: '/ru/sistemy-schisleniya/',
    nav: 'Системы счисления',
    title: 'Системы счисления: калькулятор перевода | Logic Gate',
    description:
      'Системы счисления: перевод чисел из десятичной в двоичную, восьмеричную и шестнадцатеричную и обратно — калькулятор с подробным решением, таблица и примеры.',
    h1: 'Системы счисления',
    lead: [
      'Система счисления — способ записи чисел цифрами. Мы пользуемся десятичной: 10 цифр (0–9), и каждый разряд в 10 раз больше соседа справа. Основание системы — число цифр в ней.',
      'Компьютер работает в двоичной системе (основание 2), а для краткой записи двоичных чисел используют восьмеричную (8) и шестнадцатеричную (16). В шестнадцатеричной после 9 идут буквы: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.',
    ],
    calc: {
      title: 'Калькулятор перевода',
      text: 'Введите число и выберите системы — результат и шаги решения появятся сразу. Целые неотрицательные числа до 2⁶⁴; любое основание от 2 до 16.',
      number: 'Число',
      from: 'Из системы',
      to: 'В систему',
      swap: 'Поменять системы местами',
      names: { 2: 'двоичная', 8: 'восьмеричная', 10: 'десятичная', 16: 'шестнадцатеричная' },
      steps: {
        division: 'В систему с основанием {to}: делим число на {to} и записываем остатки, пока частное не станет 0.',
        expansion: 'В десятичную: умножаем каждую цифру на вес её разряда (степень {from}) и складываем.',
        group: '{from} и {to} — степени двойки, поэтому переводим через двоичную группами: восьмеричная цифра — 3 бита, шестнадцатеричная — 4 бита.',
        via10: 'Прямого правила из {from} в {to} нет: сначала переводим в десятичную, потом в систему с основанием {to}.',
        dividend: 'Деление',
        quotient: 'Частное',
        remainder: 'Остаток',
        readUp: 'Остатки снизу вверх:',
        digitsTo: 'Каждая цифра — {n} бита:',
        bitsTo: 'Биты группируем справа по {n}, каждая группа — одна цифра:',
        same: 'Системы совпадают — число не меняется.',
      },
      errors: {
        empty: 'Введите число.',
        digit: 'Цифры «{d}» нет в системе с основанием {from}.',
        big: 'Слишком большое число (до 2⁶⁴).',
        base: 'Основание — от 2 до 16.',
      },
    },
    table: { title: 'От 0 до 16 в четырёх системах', cols: ['Десятичная', 'Двоичная', 'Восьмеричная', 'Шестнадцатеричная'] },
    toBase: {
      title: 'Из десятичной в другую: деление',
      text: 'Делим число на новое основание, записываем остаток и снова делим частное — пока оно не станет 0. Остатки читаем снизу вверх: это и есть результат. Пример — 2026 в шестнадцатеричную:',
    },
    toDec: {
      title: 'Из другой системы в десятичную: развёрнутая запись',
      text: 'Каждую цифру умножаем на вес её разряда: правую — на основание⁰ = 1, следующую — на основание¹, затем на основание²… Результаты складываем. Пример — 7EA₁₆:',
    },
    groups: {
      title: 'Двоичная, восьмеричная и шестнадцатеричная: группировка',
      text: '8 = 2³ и 16 = 2⁴, поэтому делить не нужно: двоичное число разбивают справа на группы по 3 (для восьмеричной) или по 4 (для шестнадцатеричной) бита, и каждая группа становится одной цифрой. Обратно — каждую цифру расписывают 3 или 4 битами.',
    },
    tip: 'В игре Logic Gate вы сами собираете из логических элементов схемы, которые работают с битами: сумматор, компаратор, счётчик.',
    related: ['Двоичная система: биты и сложение', 'Логические элементы и таблицы истинности'],
    more: 'Другие системы: 8, 16 и калькулятор',
  },
};
