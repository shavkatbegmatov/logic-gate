// Bo'lim xulosalari matnlari (uz/ru). Alohida modul: faqat xulosa ekrani ochilganda yuklanadi
// (bosh bundle'da yo'q). Holat — ochilganmi, o'qilganmi — lessons.ts da.
import { lang } from './i18n';

/** h — sarlavha, p — matn, f — formulalar (monospace), table — jadval (1-qator — sarlavha), tip — maslahat. */
export type Block = { h: string } | { p: string } | { f: string[] } | { table: string[][] } | { tip: string };

export interface Lesson {
  title: string;
  blocks: Block[];
}

const uz: Record<string, Lesson> = {
  basics: {
    title: 'Mantiqiy elementlar va haqiqat jadvali',
    blocks: [
      {
        p: "Raqamli sxemada har bir sim faqat ikki holatda bo'ladi: 0 (tok yo'q) yoki 1 (tok bor). Mantiqiy element kirishlaridagi qiymatlardan chiqish qiymatini hisoblaydi.",
      },
      { h: 'Uchta asosiy amal' },
      {
        table: [
          ['A', 'B', '¬A', 'A ∧ B', 'A ∨ B'],
          ['0', '0', '1', '0', '0'],
          ['0', '1', '1', '0', '1'],
          ['1', '0', '0', '0', '1'],
          ['1', '1', '0', '1', '1'],
        ],
      },
      {
        p: "¬ — inkor (EMAS), ∧ — kon'yunksiya (VA), ∨ — diz'yunksiya (YOKI). Darsliklarda ular Ā, A·B va A + B deb ham yoziladi.",
      },
      { h: 'Haqiqat jadvali' },
      {
        p: "n ta kirishli sxemada 2ⁿ xil holat bor: 1 kirish — 2 qator, 2 kirish — 4, 3 kirish — 8. Qatorlar ikkilik sanoq tartibida: 000, 001, 010, … 111. Jadval — sxemaning to'liq «pasporti»: ikki sxemaning jadvali bir xil bo'lsa, ular teng kuchli.",
      },
      { h: "Bu bo'limdagi formulalar" },
      { f: ['Uchta kalit:  Q = A ∧ B ∧ C', 'Taqiq:        Q = A ∧ ¬B', 'Hech biri:    Q = ¬(A ∨ B)'] },
      {
        tip: "Jadvaldan formula tuzishning universal usuli: Q = 1 bo'lgan har bir qator uchun kirishlarning VA sini yozing (0 bo'lgan kirish — inkor bilan), so'ng ularni YOKI bilan birlashtiring. Bu har doim ishlaydi, lekin ko'pincha eng qisqa yo'l emas — o'yinda yulduzlar aynan shu farq uchun beriladi.",
      },
    ],
  },
  xor: {
    title: 'XOR, NAND va De Morgan qonunlari',
    blocks: [
      {
        p: "XOR (⊕) — «istisno YOKI»: kirishlar har xil bo'lsa, 1. Uni asosiy elementlardan ham yig'ish mumkin — «Faqat bittasi» darajasida shunday qildingiz:",
      },
      { f: ['A ⊕ B = (A ∨ B) ∧ ¬(A ∧ B)'] },
      { h: 'XOR ning xossalari' },
      { f: ['A ⊕ 0 = A', 'A ⊕ 1 = ¬A', 'A ⊕ A = 0', "A ⊕ B ⊕ C = 1, agar birlar soni toq bo'lsa"] },
      {
        p: "Ikkinchi xossa — «Boshqariladigan inkor»ning siri: S = 1 bo'lsa, XOR signalni teskarisiga aylantiradi, S = 0 bo'lsa — o'zgartirmay o'tkazadi. Oxirgisi juftlik nazoratining asosi: ma'lumot uzatishda xatoni sezish uchun ishlatiladi.",
      },
      { h: 'Inkorli elementlar' },
      { f: ['NAND = ¬(A ∧ B)', 'NOR  = ¬(A ∨ B)', 'XNOR = ¬(A ⊕ B) — tenglik'] },
      { h: 'De Morgan qonunlari' },
      { f: ['¬(A ∧ B) = ¬A ∨ ¬B', '¬(A ∨ B) = ¬A ∧ ¬B'] },
      {
        p: "Inkorni qavs ichiga kiritsangiz, VA — YOKI ga, YOKI esa VA ga aylanadi. Bu qoida elementlarni bir-biriga almashtirishda (masalan, faqat NAND bilan yig'ishda) asosiy vosita.",
      },
      { h: "Ko'pchilik ovozi" },
      { f: ['Q = (A ∧ B) ∨ (C ∧ (A ∨ B))'] },
      {
        p: "Uch ovozdan kamida ikkitasi 1. To'g'ridan-to'g'ri yozilgan (A ∧ B) ∨ (A ∧ C) ∨ (B ∧ C) — 5 element; C ni qavsdan tashqariga chiqarib, 4 ta bilan bo'ladi.",
      },
      { tip: "Umumiy ko'paytuvchini qavsdan chiqarish — element tejashning eng oddiy usuli, xuddi algebradagi ab + ac = a(b + c) kabi." },
    ],
  },
  circuits: {
    title: 'Kombinatsion sxemalar',
    blocks: [
      {
        p: "Kombinatsion sxemaning chiqishi faqat hozirgi kirishlarga bog'liq — u hech narsani eslab qolmaydi. Protsessorning hisoblash qismi aynan shunday bloklardan yig'iladi.",
      },
      { h: 'Summatorlar' },
      { p: "Ikki bitni qo'shganda natija ikki xonali: S — yig'indi biti, C — ko'chirma (keyingi xonaga o'tadigan 1)." },
      {
        table: [
          ['A', 'B', 'C', 'S'],
          ['0', '0', '0', '0'],
          ['0', '1', '0', '1'],
          ['1', '0', '0', '1'],
          ['1', '1', '1', '0'],
        ],
      },
      { f: ['Yarim summator:  S = A ⊕ B,  C = A ∧ B', "To'liq summator: S  = A ⊕ B ⊕ Ci", '                 Co = (A ∧ B) ∨ ((A ⊕ B) ∧ Ci)'] },
      {
        p: "To'liq summator oldingi xonadan kelgan ko'chirmani (Ci) ham qo'shadi. Ularni zanjir qilib ulab, istalgan uzunlikdagi sonlarni qo'shish mumkin. A ⊕ B ikki joyda ishlatiladi — uni bir marta hisoblash bitta element tejaydi.",
      },
      { h: "Tanlash va yo'naltirish" },
      { f: ['Multipleksor:   Q  = (A ∧ ¬S) ∨ (B ∧ S)', 'Demultipleksor: Y0 = D ∧ ¬S,  Y1 = D ∧ S', 'Dekoder:        Y0 = ¬A ∧ ¬B, …, Y3 = A ∧ B'] },
      {
        p: "Multipleksor S bo'yicha ikki kirishdan birini tanlaydi (xotiradan ma'lumot o'qish shunday ishlaydi), demultipleksor esa bitta signalni tanlangan chiqishga yuboradi. Dekoder ikki bitli raqamga mos bitta chiqishni yoqadi — masalan, xotira katakchasini tanlash uchun.",
      },
      { h: 'Taqqoslagich' },
      { f: ['A > B:  (A ⊕ B) ∧ A', 'A = B:  ¬(A ⊕ B)', 'A < B:  (A ⊕ B) ∧ B'] },
      { tip: "Ko'p chiqishli sxemada chiqishlar umumiy qismni bo'lishishi mumkin — taqqoslagichda uchala javob ham bitta XOR dan boshlanadi." },
    ],
  },
  nand: {
    title: 'NAND — universal element',
    blocks: [
      {
        p: "Faqat NAND elementlaridan istalgan mantiqiy funksiyani yig'ish mumkin. Shuning uchun mikrosxemalar ko'pincha bir xil NAND (yoki NOR) kataklaridan quriladi — ishlab chiqarish arzonroq.",
      },
      { h: 'Asosiy amallar NAND orqali' },
      { f: ['¬A    = NAND(A, A)', 'A ∧ B = ¬NAND(A, B)', 'A ∨ B = NAND(¬A, ¬B)'] },
      { p: 'Uchinchisi — De Morgan qonuni: ¬(¬A ∧ ¬B) = A ∨ B. Shu tariqa NOT, AND, OR — demak, hamma narsa — NAND dan chiqadi.' },
      { h: 'Nechta NAND kerak' },
      {
        table: [
          ['Amal', 'NAND'],
          ['NOT', '1'],
          ['AND', '2'],
          ['OR', '3'],
          ['NOR', '4'],
          ['XOR', '4'],
        ],
      },
      {
        p: "Odatdagi usulda — (A ∧ ¬B) ∨ (¬A ∧ B) — XOR uchun 5 ta NAND kerak bo'lardi. 4 ta bilan bo'lishining siri: birinchi NAND ning natijasi ikki joyda ishlatiladi.",
      },
      { f: ['t     = NAND(A, B)', 'A ⊕ B = NAND(NAND(A, t), NAND(B, t))'] },
      { tip: 'NOR ham universal: ¬A = NOR(A, A), A ∨ B = ¬NOR(A, B), A ∧ B = NOR(¬A, ¬B).' },
    ],
  },
  master: {
    title: "Ko'p bitli sonlar",
    blocks: [
      {
        p: "Ikkilik sanoq tizimida har bir xona oldingisidan ikki baravar «og'ir»: A1A0 = 2·A1 + A0. Masalan, 10 = 2, 11 = 3. Ko'p bitli sxemalar sonlarni xonama-xona qayta ishlaydi.",
      },
      { h: 'Ayirish' },
      { f: ['Yarim ayirgich: D = A ⊕ B,  Bo = ¬A ∧ B'] },
      {
        p: "Ayirma biti — yig'indi biti kabi XOR. Bo («qarz») — kichik raqamdan kattasini ayirganda yuqori xonadan olinadigan 1. ¬A ∧ B ni (A ⊕ B) ∧ B deb ham yozish mumkin — A ⊕ B allaqachon hisoblangan bo'lsa, bu tejamliroq. To'liq ayirgich, xuddi to'liq summator kabi, oldingi xonadagi qarzni (Bi) ham hisobga oladi.",
      },
      { h: 'Tenglik va juftlik' },
      { f: ['A1A0 = B1B0:  ¬((A1 ⊕ B1) ∨ (A0 ⊕ B0))', "Juftlik:      ¬(A ⊕ B ⊕ C ⊕ D) — birlar soni juft bo'lsa 1"] },
      {
        p: "Sonlar teng — har bir xonasi teng, ya'ni hech bir xonada farq (XOR = 1) yo'q. Juftlik biti ma'lumotga qo'shib yuboriladi: qabul qiluvchi birlarni sanab, bitta bit buzilganini sezadi.",
      },
      { h: "Ko'paytirish" },
      {
        p: "Bitlarni ko'paytirish — bu VA: 1·1 = 1, qolganlari 0. Ikki bitli sonlar maktabdagi «ustun» usulida ko'paytiriladi: qisman ko'paytmalar (A0∧B0, A1∧B0, A0∧B1, A1∧B1) xonalar bo'yicha qo'shiladi.",
      },
      { f: ['P0 = A0 ∧ B0', 'P1 = (A1 ∧ B0) ⊕ (A0 ∧ B1)', 'P3 = (A1 ∧ B0) ∧ (A0 ∧ B1)', 'P2 = (A1 ∧ B1) ⊕ P3'] },
      {
        tip: "Katta masalani bo'laklarga ajrating: avval har bir chiqishni alohida yozing, keyin qaysi qismlar takrorlanayotganini toping — ularni bir marta hisoblash yetarli.",
      },
    ],
  },
  memory: {
    title: 'Xotira: ketma-ket sxemalar',
    blocks: [
      {
        p: "Ketma-ket sxemaning chiqishi nafaqat hozirgi kirishlarga, balki o'tmishga ham bog'liq. O'tmish D-triggerlarda saqlanadi: har bir taktda trigger kirishidagi qiymatni eslab qoladi.",
      },
      { f: ['q⁺ = D'] },
      {
        p: "q — triggerning hozirgi holati, q⁺ — keyingi taktdagisi. Haqiqiy kompyuterda takt sekundiga milliardlab marta beriladi — protsessor chastotasi (GHz) aynan shu.",
      },
      { h: "Bu bo'limdagi formulalar" },
      {
        f: [
          'Kechikish:         Q = q,  q⁺ = A',
          'Front:             Q = A ∧ ¬q,  q⁺ = A',
          'Almashtirgich:     q⁺ = T ⊕ q',
          'Xotira katakchasi: q⁺ = (S ∨ q) ∧ ¬R',
          'Hisoblagich:       q0⁺ = E ⊕ q0,  q1⁺ = q1 ⊕ (E ∧ q0)',
        ],
      },
      {
        p: "Front detektori oldingi qiymatni eslab, o'zgarish paytini topadi. Almashtirgich (T-trigger) va hisoblagich holatni XOR bilan almashtiradi: hisoblagichda E = 1 bo'lgan har taktda kichik bit q0 o'zgaradi, katta bit q1 esa E = 1 va q0 = 1 bo'lganda o'zgaradi. Kod qulfi — triggerlar zanjiri, siljitish registri: har taktda qiymatlar bir katakka suriladi.",
      },
      {
        tip: "Trigger orqali o'tgan teskari bog'lanish (aylana) ruxsat etiladi va xotira hosil qiladi. Triggersiz aylana esa beqaror — o'yinda u sikl deb rad etiladi.",
      },
    ],
  },
  automata: {
    title: 'Chekli avtomatlar',
    blocks: [
      {
        p: "Xotirali har qanday sxema — chekli avtomat: u bir nechta holatdan birida turadi va har taktda kirishlarga qarab keyingi holatga o'tadi. k ta trigger 2ᵏ tagacha holatni saqlaydi.",
      },
      { h: 'Avtomatni loyihalash' },
      {
        p: "1) Qanday holatlar kerakligini aniqlang (turniket: yopiq va ochiq). 2) Holatlarni triggerlar bitlari bilan kodlang (yopiq — 0, ochiq — 1). 3) Har bir trigger uchun q⁺ formulasini va chiqish formulasini yozing — ular odatdagi kombinatsion sxemalar.",
      },
      { f: ['Turniket:  O = P ∧ q,  q⁺ = C ∨ (q ⊕ O)'] },
      { p: "q ⊕ O — «ochiq va itarilmadi» ning qisqa yozuvi: odam o'tganda (O = 1) holatni 0 ga qaytaradi." },
      { h: "Ketma-ket qo'shuvchi" },
      { f: ['S  = A ⊕ B ⊕ q', 'q⁺ = (A ∧ B) ∨ ((A ⊕ B) ∧ q)'] },
      {
        p: "Bitta to'liq summator va ko'chirmani saqlaydigan bitta trigger istalgan uzunlikdagi sonlarni bitma-bit qo'shadi: joy tejaladi, lekin vaqt ko'proq ketadi — har bir bit uchun bitta takt. Bu — apparat loyihalashdagi asosiy tanlov: tezlik yoki o'lcham.",
      },
      { h: 'Mealy va Moore' },
      {
        p: "Chiqish faqat holatga bog'liq bo'lsa (Tugmali chiroq: Q = q), bu Moore avtomati; hozirgi kirishga ham bog'liq bo'lsa (Navbatchi: X = A ∧ …), Mealy avtomati. O'yindagi tekshiruv sxemangizni kerakli avtomat bilan har bir holat va kirish juftligida solishtiradi.",
      },
      {
        tip: "Holatlarni chiqishga moslab kodlang: chiqish to'g'ridan-to'g'ri trigger qiymati bo'lsa (Tugmali chiroq: Q = q), chiqish uchun alohida element kerak bo'lmaydi.",
      },
    ],
  },
};

const ru: Record<string, Lesson> = {
  basics: {
    title: 'Логические элементы и таблица истинности',
    blocks: [
      {
        p: 'В цифровой схеме каждый провод находится только в одном из двух состояний: 0 (тока нет) или 1 (ток есть). Логический элемент вычисляет выход по значениям на входах.',
      },
      { h: 'Три основные операции' },
      {
        table: [
          ['A', 'B', '¬A', 'A ∧ B', 'A ∨ B'],
          ['0', '0', '1', '0', '0'],
          ['0', '1', '1', '0', '1'],
          ['1', '0', '0', '0', '1'],
          ['1', '1', '0', '1', '1'],
        ],
      },
      { p: '¬ — отрицание (НЕ), ∧ — конъюнкция (И), ∨ — дизъюнкция (ИЛИ). В учебниках их пишут также как Ā, A·B и A + B.' },
      { h: 'Таблица истинности' },
      {
        p: 'У схемы с n входами 2ⁿ различных состояний: 1 вход — 2 строки, 2 входа — 4, 3 входа — 8. Строки идут в порядке двоичного счёта: 000, 001, 010, … 111. Таблица — полный «паспорт» схемы: если таблицы двух схем совпадают, схемы равносильны.',
      },
      { h: 'Формулы этой главы' },
      { f: ['Три ключа:   Q = A ∧ B ∧ C', 'Запрет:      Q = A ∧ ¬B', 'Ни один:     Q = ¬(A ∨ B)'] },
      {
        tip: 'Универсальный способ составить формулу по таблице: для каждой строки с Q = 1 запишите И входов (вход, равный 0, — с отрицанием), затем объедините их через ИЛИ. Это работает всегда, но редко даёт самую короткую схему — звёзды в игре даются именно за эту разницу.',
      },
    ],
  },
  xor: {
    title: 'XOR, NAND и законы де Моргана',
    blocks: [
      {
        p: 'XOR (⊕) — «исключающее ИЛИ»: 1, если входы различаются. Его можно собрать и из основных элементов — так вы сделали на уровне «Только один»:',
      },
      { f: ['A ⊕ B = (A ∨ B) ∧ ¬(A ∧ B)'] },
      { h: 'Свойства XOR' },
      { f: ['A ⊕ 0 = A', 'A ⊕ 1 = ¬A', 'A ⊕ A = 0', 'A ⊕ B ⊕ C = 1, если число единиц нечётно'] },
      {
        p: 'Второе свойство — секрет «Управляемого отрицания»: при S = 1 XOR инвертирует сигнал, при S = 0 пропускает без изменений. Последнее — основа контроля чётности: так обнаруживают ошибки при передаче данных.',
      },
      { h: 'Элементы с отрицанием' },
      { f: ['NAND = ¬(A ∧ B)', 'NOR  = ¬(A ∨ B)', 'XNOR = ¬(A ⊕ B) — равенство'] },
      { h: 'Законы де Моргана' },
      { f: ['¬(A ∧ B) = ¬A ∨ ¬B', '¬(A ∨ B) = ¬A ∧ ¬B'] },
      {
        p: 'Если внести отрицание в скобки, И превращается в ИЛИ, а ИЛИ — в И. Это главный инструмент при замене одних элементов другими (например, когда можно использовать только NAND).',
      },
      { h: 'Большинство голосов' },
      { f: ['Q = (A ∧ B) ∨ (C ∧ (A ∨ B))'] },
      {
        p: 'Хотя бы два голоса из трёх равны 1. Прямая запись (A ∧ B) ∨ (A ∧ C) ∨ (B ∧ C) — 5 элементов; если вынести C за скобки, хватит 4.',
      },
      { tip: 'Вынесение общего множителя за скобки — самый простой способ сэкономить элементы, как ab + ac = a(b + c) в алгебре.' },
    ],
  },
  circuits: {
    title: 'Комбинационные схемы',
    blocks: [
      {
        p: 'Выход комбинационной схемы зависит только от текущих входов — она ничего не запоминает. Из таких блоков собрана вычислительная часть процессора.',
      },
      { h: 'Сумматоры' },
      { p: 'При сложении двух битов результат двузначный: S — бит суммы, C — перенос (единица, которая уходит в следующий разряд).' },
      {
        table: [
          ['A', 'B', 'C', 'S'],
          ['0', '0', '0', '0'],
          ['0', '1', '0', '1'],
          ['1', '0', '0', '1'],
          ['1', '1', '1', '0'],
        ],
      },
      { f: ['Полусумматор:     S = A ⊕ B,  C = A ∧ B', 'Полный сумматор:  S  = A ⊕ B ⊕ Ci', '                  Co = (A ∧ B) ∨ ((A ⊕ B) ∧ Ci)'] },
      {
        p: 'Полный сумматор добавляет ещё и перенос из предыдущего разряда (Ci). Соединив их цепочкой, можно складывать числа любой длины. A ⊕ B используется в двух местах — если вычислить его один раз, экономится элемент.',
      },
      { h: 'Выбор и маршрутизация' },
      { f: ['Мультиплексор:    Q  = (A ∧ ¬S) ∨ (B ∧ S)', 'Демультиплексор:  Y0 = D ∧ ¬S,  Y1 = D ∧ S', 'Дешифратор:       Y0 = ¬A ∧ ¬B, …, Y3 = A ∧ B'] },
      {
        p: 'Мультиплексор по S выбирает один из двух входов (так устроено чтение из памяти), демультиплексор направляет сигнал на выбранный выход. Дешифратор включает один выход, соответствующий двухбитному числу, — например, чтобы выбрать ячейку памяти.',
      },
      { h: 'Компаратор' },
      { f: ['A > B:  (A ⊕ B) ∧ A', 'A = B:  ¬(A ⊕ B)', 'A < B:  (A ⊕ B) ∧ B'] },
      { tip: 'В схеме с несколькими выходами выходы могут делить общую часть — в компараторе все три ответа начинаются с одного XOR.' },
    ],
  },
  nand: {
    title: 'NAND — универсальный элемент',
    blocks: [
      {
        p: 'Только из элементов NAND можно собрать любую логическую функцию. Поэтому микросхемы часто строят из одинаковых ячеек NAND (или NOR) — так дешевле производство.',
      },
      { h: 'Основные операции через NAND' },
      { f: ['¬A    = NAND(A, A)', 'A ∧ B = ¬NAND(A, B)', 'A ∨ B = NAND(¬A, ¬B)'] },
      { p: 'Третье — закон де Моргана: ¬(¬A ∧ ¬B) = A ∨ B. Значит, NOT, AND, OR — а с ними и всё остальное — получаются из NAND.' },
      { h: 'Сколько нужно NAND' },
      {
        table: [
          ['Операция', 'NAND'],
          ['NOT', '1'],
          ['AND', '2'],
          ['OR', '3'],
          ['NOR', '4'],
          ['XOR', '4'],
        ],
      },
      {
        p: 'Обычным способом — (A ∧ ¬B) ∨ (¬A ∧ B) — на XOR ушло бы 5 NAND. Секрет четырёх: результат первого NAND используется в двух местах.',
      },
      { f: ['t     = NAND(A, B)', 'A ⊕ B = NAND(NAND(A, t), NAND(B, t))'] },
      { tip: 'NOR тоже универсален: ¬A = NOR(A, A), A ∨ B = ¬NOR(A, B), A ∧ B = NOR(¬A, ¬B).' },
    ],
  },
  master: {
    title: 'Многобитные числа',
    blocks: [
      {
        p: 'В двоичной системе каждый разряд «весит» вдвое больше предыдущего: A1A0 = 2·A1 + A0. Например, 10 = 2, 11 = 3. Многобитные схемы обрабатывают числа поразрядно.',
      },
      { h: 'Вычитание' },
      { f: ['Полувычитатель: D = A ⊕ B,  Bo = ¬A ∧ B'] },
      {
        p: 'Бит разности, как и бит суммы, — это XOR. Bo («заём») — единица, которую берут из старшего разряда, когда из меньшей цифры вычитают большую. ¬A ∧ B можно записать и как (A ⊕ B) ∧ B — это экономнее, если A ⊕ B уже вычислено. Полный вычитатель, как и полный сумматор, учитывает заём из предыдущего разряда (Bi).',
      },
      { h: 'Равенство и чётность' },
      { f: ['A1A0 = B1B0:  ¬((A1 ⊕ B1) ∨ (A0 ⊕ B0))', 'Чётность:     ¬(A ⊕ B ⊕ C ⊕ D) — 1, если число единиц чётно'] },
      {
        p: 'Числа равны, если равен каждый разряд, то есть ни в одном разряде нет различия (XOR = 1). Бит чётности отправляют вместе с данными: получатель считает единицы и замечает, что один бит испортился.',
      },
      { h: 'Умножение' },
      {
        p: 'Умножение битов — это И: 1·1 = 1, остальное 0. Двухбитные числа умножаются «столбиком», как в школе: частичные произведения (A0∧B0, A1∧B0, A0∧B1, A1∧B1) складываются по разрядам.',
      },
      { f: ['P0 = A0 ∧ B0', 'P1 = (A1 ∧ B0) ⊕ (A0 ∧ B1)', 'P3 = (A1 ∧ B0) ∧ (A0 ∧ B1)', 'P2 = (A1 ∧ B1) ⊕ P3'] },
      {
        tip: 'Разбивайте большую задачу на части: сначала запишите каждый выход отдельно, затем найдите повторяющиеся части — их достаточно вычислить один раз.',
      },
    ],
  },
  memory: {
    title: 'Память: последовательностные схемы',
    blocks: [
      {
        p: 'Выход последовательностной схемы зависит не только от текущих входов, но и от прошлого. Прошлое хранится в D-триггерах: на каждом такте триггер запоминает значение на своём входе.',
      },
      { f: ['q⁺ = D'] },
      {
        p: 'q — текущее состояние триггера, q⁺ — состояние на следующем такте. В настоящем компьютере такты идут миллиарды раз в секунду — это и есть частота процессора (ГГц).',
      },
      { h: 'Формулы этой главы' },
      {
        f: [
          'Задержка:       Q = q,  q⁺ = A',
          'Фронт:          Q = A ∧ ¬q,  q⁺ = A',
          'Переключатель:  q⁺ = T ⊕ q',
          'Ячейка памяти:  q⁺ = (S ∨ q) ∧ ¬R',
          'Счётчик:        q0⁺ = E ⊕ q0,  q1⁺ = q1 ⊕ (E ∧ q0)',
        ],
      },
      {
        p: 'Детектор фронта помнит прошлое значение и находит момент изменения. Переключатель (T-триггер) и счётчик меняют состояние через XOR: в счётчике младший бит q0 меняется на каждом такте с E = 1, а старший q1 — когда E = 1 и q0 = 1. Кодовый замок — цепочка триггеров, сдвиговый регистр: на каждом такте значения сдвигаются на одну ячейку.',
      },
      {
        tip: 'Обратная связь (петля) через триггер разрешена и создаёт память. Петля без триггера неустойчива — в игре она отклоняется как цикл.',
      },
    ],
  },
  automata: {
    title: 'Конечные автоматы',
    blocks: [
      {
        p: 'Любая схема с памятью — конечный автомат: она находится в одном из нескольких состояний и на каждом такте, в зависимости от входов, переходит в следующее. k триггеров хранят до 2ᵏ состояний.',
      },
      { h: 'Как спроектировать автомат' },
      {
        p: '1) Определите нужные состояния (турникет: закрыт и открыт). 2) Закодируйте состояния битами триггеров (закрыт — 0, открыт — 1). 3) Для каждого триггера запишите формулу q⁺ и формулу выхода — это обычные комбинационные схемы.',
      },
      { f: ['Турникет:  O = P ∧ q,  q⁺ = C ∨ (q ⊕ O)'] },
      { p: 'q ⊕ O — короткая запись «открыт и не толкнули»: когда человек проходит (O = 1), состояние возвращается в 0.' },
      { h: 'Последовательный сумматор' },
      { f: ['S  = A ⊕ B ⊕ q', 'q⁺ = (A ∧ B) ∨ ((A ⊕ B) ∧ q)'] },
      {
        p: 'Один полный сумматор и один триггер для переноса складывают побитно числа любой длины: места нужно меньше, зато времени больше — по такту на бит. Это главный выбор в проектировании аппаратуры: скорость или размер.',
      },
      { h: 'Мили и Мур' },
      {
        p: 'Если выход зависит только от состояния (Лампа с кнопкой: Q = q), это автомат Мура; если и от текущего входа (Дежурный: X = A ∧ …) — автомат Мили. Проверка в игре сравнивает вашу схему с нужным автоматом для каждой пары «состояние — вход».',
      },
      {
        tip: 'Кодируйте состояния с оглядкой на выход: если выход — это прямо значение триггера (Лампа с кнопкой: Q = q), для выхода не нужен отдельный элемент.',
      },
    ],
  },
};

export const LESSONS: Record<'uz' | 'ru', Record<string, Lesson>> = { uz, ru };

export function lessonFor(chapter: string): Lesson | undefined {
  return (LESSONS[lang.value as 'uz' | 'ru'] ?? uz)[chapter] ?? uz[chapter];
}
