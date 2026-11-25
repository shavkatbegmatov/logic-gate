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
  nor: {
    title: 'NOR — ikkinchi universal element',
    blocks: [
      {
        p: "NOR — teskari OR: kirishlardan hech biri 1 bo'lmagandagina 1 beradi. NAND kabi u ham universal: faqat NOR lardan istalgan sxemani yig'ish mumkin.",
      },
      { h: 'Asosiy amallar NOR orqali' },
      { f: ['¬A    = NOR(A, A)', 'A ∨ B = ¬NOR(A, B)', 'A ∧ B = NOR(¬A, ¬B)'] },
      {
        p: "NAND bilan solishtiring: u yerda AND arzon (2 ta), OR qimmat (3 ta); NOR da aksincha — OR 2 ta, AND 3 ta. De Morgan qonuni ikkalasini bir-biriga ko'zgudek aks ettiradi.",
      },
      { h: 'Nechta NOR kerak' },
      {
        table: [
          ['Amal', 'NOR'],
          ['NOT', '1'],
          ['OR', '2'],
          ['AND', '3'],
          ['XNOR', '4'],
          ['XOR', '5'],
          ['MUX', '4'],
        ],
      },
      {
        p: "NAND da XOR 4 ta bo'lgani kabi, NOR da 4 ta element XNOR beradi; XOR uchun uni yana bittasi bilan teskarisiga aylantirish kerak. Bu sonlar barcha sxemalarni birma-bir tekshirib isbotlangan — kamroq element bilan bo'lmaydi.",
      },
      {
        tip: "1969-yilda Oyga uchgan «Apollon» kemasining bort kompyuteri deyarli butunlay bir xil mikrosxemalardan yig'ilgan — har birida ikkita 3 kirishli NOR. Bir xil katakchalardan qurish ishlab chiqarishni oson va ishonchli qiladi.",
      },
    ],
  },
  chips: {
    title: "Bloklar — kattaroq mashinaning g'ishtlari",
    blocks: [
      {
        p: "Yechilgan qurilmani har safar qaytadan yig'ish shart emas: u bitta blokka (mikrosxemaga) aylanadi. Blokning ichi emas, faqat oyoqlari va nima qilishi muhim — haqiqiy muhandislar ham shunday ishlaydi.",
      },
      { h: "Qo'lingizdagi bloklar" },
      {
        table: [
          ['Blok', 'Kirish', 'Chiqish', 'Ichida'],
          ['HA', 'A, B', 'S, C', 'XOR + AND'],
          ['FA', 'A, B, Ci', 'S, Co', '2 HA + OR'],
          ['MUX', 'A, B, S', 'Q', '2 AND + OR + NOT'],
          ['DEC', 'A, B', 'Y0–Y3', '4 AND + 2 NOT'],
        ],
      },
      { h: "Ko'chirish zanjiri" },
      { f: ['S0 = A0 ⊕ B0,  C1 = A0 ∧ B0', 'Sk, Ck+1 = FA(Ak, Bk, Ck)'] },
      {
        p: "Ko'p bitli summator — to'liq summatorlar zanjiri: har xonaning ko'chirish biti keyingi xonaga o'tadi. Qog'ozda ustun qilib qo'shganingiz aynan shu.",
      },
      {
        p: "Multipleksorlar daraxti istalgan sonli kirishdan birini tanlaydi: 4 tadan biriga 3 ta MUX, 8 tadan biriga 7 ta. Dekoder esa teskarisini qiladi — sondan bitta yonib turgan chiziq.",
      },
      {
        tip: "Birinchi mikrosxemalar (1960-yillar) bir nechta elementdan iborat edi. Bugungi protsessorda milliardlab tranzistor bor, lekin u ham bloklar ichidagi bloklardan qurilgan: summator → ALU → protsessor.",
      },
    ],
  },
  buses: {
    title: "Shinalar — to'rt bit bitta yo'lda",
    blocks: [
      {
        p: "Protsessor bitlar bilan emas, sonlar bilan ishlaydi. To'rt bitli son to'rtta sim bo'ylab bir vaqtda yuradi — bunday simlar to'plami shina deyiladi. Maydonda shina bitta qalin chiziq, ustida esa uning qiymati (0–15).",
      },
      { h: 'Shina bilan ishlash' },
      {
        table: [
          ['Blok', 'Kirish', 'Chiqish', 'Ichida'],
          ['SPLIT', 'A[3:0]', 'A3, A2, A1, A0', '—'],
          ['JOIN', 'A3, A2, A1, A0', 'Q[3:0]', '—'],
          ['NOT4', 'A', 'Q', '4 NOT'],
          ['ADD4', 'A, B, Ci', 'S, Co', '4 FA'],
          ['MUX4', 'A, B, S', 'Q', '4 MUX'],
          ['INC4', 'A', 'Q, C', 'NOT + 3 HA'],
        ],
      },
      { h: 'Ikkilik son' },
      { f: ['A = 8·A3 + 4·A2 + 2·A1 + A0', '0111 + 1 = 1000,  1111 + 1 = 0000 (C = 1)'] },
      {
        p: "Shina faqat bir xil kenglikdagi shinaga ulanadi. Bitta bitni olish kerak bo'lsa — bo'laklovchi, bitlardan son yasash kerak bo'lsa — birlashtiruvchi. Shina bloklari esa bir xil ishni har bitda takrorlaydi: NOT4 — to'rtta NOT, MUX4 — umumiy S bilan to'rtta MUX.",
      },
      {
        tip: "Kompyuterdagi «64 bitli protsessor» degani — uning shinalari va registrlari 64 bit kenglikda. Birinchi mikroprotsessor Intel 4004 (1971) esa xuddi shu bo'limdagidek to'rt bitli edi.",
      },
    ],
  },
  alu: {
    title: 'ALU — protsessorning hisoblovchi yuragi',
    blocks: [
      {
        p: "Protsessorning deyarli har bir buyrug'i bitta qurilmadan o'tadi: arifmetik-mantiqiy qurilma (ALU). Unga ikki son va amal kodi beriladi, u esa natija va bayroqlarni qaytaradi. Bu bo'limda ALU ni qadamma-qadam yig'asiz.",
      },
      { h: 'Manfiy son va ayirish' },
      { f: ["−A = NOT A + 1   (ikkilik to'ldiruvchi kod)", 'A − B = A + NOT B + 1', '3 − 5 = 3 + 1010 + 1 = 1110 = 14   (C = 0 — qarz bor)'] },
      {
        p: "To'rt bitda son 16 ga yetganda yana 0 dan boshlanadi — soat 12 dan keyin 1 ga o'tgani kabi. Shuning uchun ayirish uchun alohida qurilma kerak emas: summator B ning teskarisini qo'shadi, Ci = 1 esa yetishmagan birni beradi. Summator ko'chirishi Co = 1 bo'lsa, qarz yo'q (A ≥ B).",
      },
      { h: 'Amal kodi' },
      {
        table: [
          ['F1 F0', 'Buyruq', 'R', 'C'],
          ['00', 'ADD', 'A + B', 'Co'],
          ['01', 'SUB', 'A − B', 'Co'],
          ['10', 'AND', 'A AND B', '0'],
          ['11', 'OR', 'A OR B', '0'],
        ],
      },
      {
        p: "Z bayrog'i natija 0 ekanini bildiradi. Taqqoslash ham shunga tayanadi: A − B = 0 bo'lsa, sonlar teng, qarz bo'lsa, A < B. Keyingi bo'limlarda protsessor dasturda aynan shu bayroqlarga qarab sakraydi.",
      },
      {
        tip: "Mashhur 74181 mikrosxemasi (1970) — to'rt bitli ALU: bitta korpusda 32 ta amal. Bir nechtasini yonma-yon qo'yib, o'sha davrning ko'plab kompyuterlari yig'ilgan.",
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
  nor: {
    title: 'NOR — второй универсальный элемент',
    blocks: [
      {
        p: 'NOR — это OR с инверсией: даёт 1, только когда ни один вход не равен 1. Как и NAND, он универсален: из одних NOR можно собрать любую схему.',
      },
      { h: 'Основные операции через NOR' },
      { f: ['¬A    = NOR(A, A)', 'A ∨ B = ¬NOR(A, B)', 'A ∧ B = NOR(¬A, ¬B)'] },
      {
        p: 'Сравните с NAND: там AND дешёвый (2), а OR дорогой (3); у NOR наоборот — OR за 2, AND за 3. Закон де Моргана отражает их друг в друге, как в зеркале.',
      },
      { h: 'Сколько нужно NOR' },
      {
        table: [
          ['Операция', 'NOR'],
          ['NOT', '1'],
          ['OR', '2'],
          ['AND', '3'],
          ['XNOR', '4'],
          ['XOR', '5'],
          ['MUX', '4'],
        ],
      },
      {
        p: 'Как из NAND XOR собирается из 4 элементов, так из 4 NOR получается XNOR; для XOR его нужно инвертировать ещё одним. Эти числа доказаны полным перебором всех схем — меньшим числом элементов не обойтись.',
      },
      {
        tip: 'Бортовой компьютер «Аполлона», летавшего к Луне в 1969 году, собран почти целиком из одинаковых микросхем — в каждой по два трёхвходовых NOR. Одинаковые ячейки делают производство проще и надёжнее.',
      },
    ],
  },
  chips: {
    title: 'Блоки — кирпичи для машины побольше',
    blocks: [
      {
        p: 'Решённое устройство не нужно каждый раз собирать заново: оно превращается в один блок (микросхему). Важно не то, что внутри, а только его выводы и что он делает — так работают и настоящие инженеры.',
      },
      { h: 'Блоки в вашем распоряжении' },
      {
        table: [
          ['Блок', 'Входы', 'Выходы', 'Внутри'],
          ['HA', 'A, B', 'S, C', 'XOR + AND'],
          ['FA', 'A, B, Ci', 'S, Co', '2 HA + OR'],
          ['MUX', 'A, B, S', 'Q', '2 AND + OR + NOT'],
          ['DEC', 'A, B', 'Y0–Y3', '4 AND + 2 NOT'],
        ],
      },
      { h: 'Цепочка переносов' },
      { f: ['S0 = A0 ⊕ B0,  C1 = A0 ∧ B0', 'Sk, Ck+1 = FA(Ak, Bk, Ck)'] },
      {
        p: 'Многобитный сумматор — цепочка полных сумматоров: бит переноса каждого разряда идёт в следующий. Именно так вы складываете столбиком на бумаге.',
      },
      {
        p: 'Дерево мультиплексоров выбирает один из любого числа входов: один из 4 — 3 MUX, один из 8 — 7. Дешифратор делает обратное — из числа получается одна горящая линия.',
      },
      {
        tip: 'Первые микросхемы (1960-е) содержали несколько элементов. В современном процессоре миллиарды транзисторов, но и он собран из блоков внутри блоков: сумматор → АЛУ → процессор.',
      },
    ],
  },
  buses: {
    title: 'Шины — четыре бита по одной дороге',
    blocks: [
      {
        p: 'Процессор работает не с битами, а с числами. Четырёхбитное число идёт по четырём проводам одновременно — такой пучок проводов называется шиной. На поле шина — одна толстая линия, а над ней её значение (0–15).',
      },
      { h: 'Работа с шиной' },
      {
        table: [
          ['Блок', 'Вход', 'Выход', 'Внутри'],
          ['SPLIT', 'A[3:0]', 'A3, A2, A1, A0', '—'],
          ['JOIN', 'A3, A2, A1, A0', 'Q[3:0]', '—'],
          ['NOT4', 'A', 'Q', '4 NOT'],
          ['ADD4', 'A, B, Ci', 'S, Co', '4 FA'],
          ['MUX4', 'A, B, S', 'Q', '4 MUX'],
          ['INC4', 'A', 'Q, C', 'NOT + 3 HA'],
        ],
      },
      { h: 'Двоичное число' },
      { f: ['A = 8·A3 + 4·A2 + 2·A1 + A0', '0111 + 1 = 1000,  1111 + 1 = 0000 (C = 1)'] },
      {
        p: 'Шина соединяется только с шиной той же ширины. Нужен один бит — разделитель, нужно собрать число из битов — объединитель. А блоки шины повторяют одно и то же для каждого бита: NOT4 — четыре NOT, MUX4 — четыре MUX с общим S.',
      },
      {
        tip: '«64-битный процессор» значит, что его шины и регистры шириной 64 бита. А первый микропроцессор Intel 4004 (1971) был четырёхбитным — как в этом разделе.',
      },
    ],
  },
  alu: {
    title: 'АЛУ — вычислительное сердце процессора',
    blocks: [
      {
        p: 'Почти каждая команда процессора проходит через одно устройство — арифметико-логическое (АЛУ). Ему дают два числа и код операции, а оно возвращает результат и флаги. В этом разделе вы соберёте АЛУ шаг за шагом.',
      },
      { h: 'Отрицательное число и вычитание' },
      { f: ['−A = NOT A + 1   (дополнительный код)', 'A − B = A + NOT B + 1', '3 − 5 = 3 + 1010 + 1 = 1110 = 14   (C = 0 — есть заём)'] },
      {
        p: 'В четырёх битах число, дойдя до 16, снова начинается с 0 — как часы после 12 переходят на 1. Поэтому отдельное устройство для вычитания не нужно: сумматор прибавляет инверсию B, а Ci = 1 даёт недостающую единицу. Если перенос сумматора Co = 1, заёма нет (A ≥ B).',
      },
      { h: 'Код операции' },
      {
        table: [
          ['F1 F0', 'Команда', 'R', 'C'],
          ['00', 'ADD', 'A + B', 'Co'],
          ['01', 'SUB', 'A − B', 'Co'],
          ['10', 'AND', 'A AND B', '0'],
          ['11', 'OR', 'A OR B', '0'],
        ],
      },
      {
        p: 'Флаг Z говорит, что результат равен 0. На этом держится и сравнение: если A − B = 0, числа равны, если был заём, A < B. В следующих разделах процессор будет переходить по программе именно по этим флагам.',
      },
      {
        tip: 'Знаменитая микросхема 74181 (1970) — четырёхбитное АЛУ: 32 операции в одном корпусе. Ставя несколько таких рядом, собирали многие компьютеры той эпохи.',
      },
    ],
  },
};

export const LESSONS: Record<'uz' | 'ru', Record<string, Lesson>> = { uz, ru };

export function lessonFor(chapter: string): Lesson | undefined {
  return (LESSONS[lang.value as 'uz' | 'ru'] ?? uz)[chapter] ?? uz[chapter];
}
