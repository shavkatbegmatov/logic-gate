// "Ikkilik sanoq sistemasi" qo'llanmasining matnlari (scripts/pages.mjs). Maktab informatikasidagi
// mavzu: o'nlikdan ikkilikka va qaytib, bitlar, ikkilikda qo'shish. Darajalarning yechimini aytmaydi
// (qo'shuvchi sxema qanday yig'ilishi — o'yinning o'zida).

export const BINARY = {
  uz: {
    path: '/ikkilik-sanoq-sistemasi/',
    nav: 'Ikkilik sanoq sistemasi',
    title: "Ikkilik sanoq sistemasi: o'tkazish va misollar | Logic Gate",
    description:
      "Ikkilik sanoq sistemasi: o'nlik sonni ikkilikka va ikkilikni o'nlikka o'tkazish, bitlar va o'rin qiymatlari, ikkilikda qo'shish — misollar va interaktiv o'tkazgich bilan.",
    h1: 'Ikkilik sanoq sistemasi',
    lead: [
      "Biz o'nlik sistemada sanaymiz: 10 ta raqam (0–9), har bir o'rin o'ngdagisidan 10 marta katta. Kompyuter esa faqat ikki holatni ajratadi — tok bor (1) yoki yo'q (0), shuning uchun u ikkilik sistemada ishlaydi: raqamlar faqat 0 va 1, har bir o'rin o'ngdagisidan 2 marta katta.",
      "Ikkilik sonning har bir raqami bit deyiladi. 8 bit — 1 bayt: u 0 dan 255 gacha bo'lgan sonni saqlaydi.",
    ],
    toy: {
      title: "Bitlarni bosib ko'ring",
      text: "Har bir yoqilgan bit o'z o'rin qiymatini qo'shadi: yoqilgan bitlar qiymatlarining yig'indisi — o'nlik son. Yoki pastga son yozing — bitlar o'zi yonadi.",
      input: "O'nlik son (0–255)",
    },
    toBin: {
      title: "O'nlikdan ikkilikka: 2 ga bo'lish",
      text: "Sonni 2 ga bo'lib, qoldiqni yozib boring — bo'linma 0 bo'lguncha. Keyin qoldiqlarni pastdan yuqoriga o'qing.",
      cols: ["Bo'linuvchi", "Bo'linma", 'Qoldiq'],
      result: 'Qoldiqlar pastdan yuqoriga:',
    },
    toDec: {
      title: "Ikkilikdan o'nlikka: o'rin qiymatlari",
      text: "O'ngdan chapga o'rin qiymatlari: 1, 2, 4, 8, 16, 32… Qaysi o'rinda 1 tursa, o'sha qiymatni qo'shing.",
      rows: ['Bit', 'Qiymat'],
    },
    table: { title: "0 dan 15 gacha: o'nlik va ikkilik", cols: ["O'nlik", 'Ikkilik'] },
    add: {
      title: "Ikkilikda qo'shish",
      text: "Qoidalar: 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10 — ya'ni 0 yoziladi, 1 keyingi o'ringa ko'chadi; 1 + 1 + 1 = 11. Ustun qilib, o'ngdan chapga qo'shiladi — xuddi o'nlikdagidek.",
      carry: "Ko'chish",
      tip: "Logic Gate o'yinida bitlarni qo'shadigan sxemalarni mantiqiy elementlardan o'zingiz yig'asiz — kompyuter aynan shunday hisoblaydi.",
    },
    related: "Mantiqiy elementlar va haqiqat jadvallari",
  },

  ru: {
    path: '/ru/dvoichnaya-sistema/',
    nav: 'Двоичная система',
    title: 'Двоичная система счисления: перевод и примеры | Logic Gate',
    description:
      'Двоичная система счисления: перевод из десятичной в двоичную и обратно, биты и веса разрядов, сложение в двоичной системе — с примерами и интерактивным переводчиком.',
    h1: 'Двоичная система счисления',
    lead: [
      'Мы считаем в десятичной системе: 10 цифр (0–9), и каждый разряд в 10 раз больше соседа справа. Компьютер различает только два состояния — ток есть (1) или нет (0), поэтому он работает в двоичной системе: цифры только 0 и 1, и каждый разряд в 2 раза больше соседа справа.',
      'Каждая цифра двоичного числа называется битом. 8 бит — 1 байт: он хранит число от 0 до 255.',
    ],
    toy: {
      title: 'Пощёлкайте битами',
      text: 'Каждый включённый бит добавляет свой вес: сумма весов включённых битов — это десятичное число. Или введите число ниже — биты загорятся сами.',
      input: 'Десятичное число (0–255)',
    },
    toBin: {
      title: 'Из десятичной в двоичную: деление на 2',
      text: 'Делите число на 2 и записывайте остаток, пока частное не станет 0. Затем прочитайте остатки снизу вверх.',
      cols: ['Делимое', 'Частное', 'Остаток'],
      result: 'Остатки снизу вверх:',
    },
    toDec: {
      title: 'Из двоичной в десятичную: веса разрядов',
      text: 'Веса разрядов справа налево: 1, 2, 4, 8, 16, 32… Сложите веса тех разрядов, где стоит 1.',
      rows: ['Бит', 'Вес'],
    },
    table: { title: 'От 0 до 15: десятичные и двоичные', cols: ['Десятичное', 'Двоичное'] },
    add: {
      title: 'Сложение в двоичной системе',
      text: 'Правила: 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10 — то есть пишем 0 и переносим 1 в следующий разряд; 1 + 1 + 1 = 11. Складываем столбиком справа налево — как в десятичной.',
      carry: 'Перенос',
      tip: 'В игре Logic Gate вы сами собираете из логических элементов схемы, которые складывают биты, — именно так считает компьютер.',
    },
    related: 'Логические элементы и таблицы истинности',
  },
};

/** Misollar (sahifa va testlar uchun bir xil). */
export const EXAMPLES = { toBin: 13, toDec: '101101', add: ['0110', '0111'] };

/** O'nlikdan ikkilikka: [bo'linuvchi, bo'linma, qoldiq] qadamlari va natija. */
export function divisionSteps(n) {
  const steps = [];
  for (let x = n; x > 0; x = Math.floor(x / 2)) steps.push([x, Math.floor(x / 2), x % 2]);
  return { steps, bin: steps.length ? steps.map((s) => s[2]).reverse().join('') : '0' };
}

/** Ikkilik sonni qo'shish ustunlari: ko'chishlar, yig'indi (o'ngdan chapga). */
export function binaryAdd(a, b) {
  const w = Math.max(a.length, b.length);
  const x = a.padStart(w, '0');
  const y = b.padStart(w, '0');
  const carry = Array(w + 1).fill(0);
  const sum = Array(w + 1).fill(0);
  for (let i = w - 1; i >= 0; i--) {
    const s = Number(x[i]) + Number(y[i]) + carry[i + 1];
    sum[i + 1] = s % 2;
    carry[i] = s >> 1;
  }
  sum[0] = carry[0];
  return { a: x, b: y, carry: carry.join(''), sum: sum.join('').replace(/^0(?=.)/, '') };
}
