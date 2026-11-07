// Interfeys matnlari. Yangi til qo'shish uchun shu tuzilmadagi obyekt yarating va `t` ni almashtiring.
import type { ErrorCode } from './sim/sim';
import type { GateType } from './sim/types';

export const uz = {
  appName: 'Logic Gate',
  tagline: "Mantiqiy elementlardan sxema yig'ing",
  back: 'Orqaga',
  close: 'Yopish',
  cancel: 'Bekor qilish',
  save: 'Saqlash',
  retry: 'Qayta urinish',
  loading: 'Yuklanmoqda…',

  home: {
    play: "O'ynash",
    continue: 'Davom etish',
    levels: 'Darajalar',
    sandbox: 'Qum quti',
    leaderboard: 'Reyting',
    settings: 'Sozlamalar',
    stars: (n: number, max: number) => `${n} / ${max} ★`,
    solved: (n: number, max: number) => `${n} / ${max} daraja`,
    joinTitle: 'Reytingda qatnashing',
    joinText: "Taxallus kiriting — natijalaringiz reytingga qo'shiladi. Ro'yxatdan o'tish shart emas.",
    nicknamePlaceholder: 'Taxallusingiz',
    join: 'Qatnashish',
    hello: (name: string) => `Salom, ${name}!`,
  },

  chapters: {
    title: 'Darajalar',
    locked: (need: number, have: number) => `Ochilishi uchun ${need} ★ kerak (sizda ${have} ★)`,
    chapterStars: (n: number, max: number) => `${n} / ${max} ★`,
  },

  play: {
    goal: (n: number) => `Maqsad: ${n} element`,
    used: (n: number) => `Ishlatildi: ${n}`,
    check: 'Tekshirish',
    checking: 'Tekshirilmoqda',
    skip: "O'tkazib yuborish",
    rowLabel: (r: number) => `${r + 1}-qator`,
    table: 'Jadval',
    task: 'Vazifa',
    undo: 'Bekor qilish',
    redo: 'Qaytarish',
    clear: 'Tozalash',
    clearConfirm: "Maydondagi barcha elementlar o'chirilsinmi?",
    fit: "Hammasini ko'rsatish",
    zoomIn: 'Kattalashtirish',
    zoomOut: 'Kichiklashtirish',
    remove: "O'chirish",
    expected: 'Kerak',
    got: 'Sizda',
    inputs: 'Kirishlar',
    outputs: 'Chiqishlar',
    allowed: 'Elementlar',
    cycle: "Bunday ulab bo'lmaydi: signal o'ziga qaytib keladi.",
    sameKind: "Chiqishni kirishga ulang: bitta sim manbadan qabul qiluvchiga boradi.",
    rowsOk: "Barcha qatorlar to'g'ri — endi tekshiring!",
    newGate: 'Yangi element',
    newGates: 'Yangi elementlar',
    gotIt: 'Tushunarli',
  },

  success: {
    title: 'Daraja yechildi!',
    gates: (n: number, goal: number) => `Elementlar: ${n} (maqsad: ${goal})`,
    tryFewer: (goal: number) => `3 ★ uchun ko'pi bilan ${goal} ta element ishlating.`,
    improved: 'Yangi shaxsiy rekord!',
    record: (gates: number, names: string) => `Eng yaxshi natija: ${gates} element — ${names}`,
    beatRecord: "Bu — hozirgacha eng kam elementli yechim!",
    joinHint: "Natijangizni reytingga qo'shish uchun taxallus kiriting:",
    solvers: (n: number) => `Bu darajani ${n} kishi yechgan`,
    next: 'Keyingi daraja',
    again: 'Yana yaxshilash',
    toLevels: 'Darajalar',
    nextLocked: (need: number) => `Keyingi bo'lim ${need} ★ da ochiladi`,
    allDone: "Tabriklaymiz! Barcha darajalarni yechdingiz.",
    offline: 'Natija qurilmada saqlandi. Server bilan aloqa tiklanganda yuboriladi.',
  },

  share: {
    telegram: "Telegram'da ulashish",
    native: 'Ulashish',
    invite: "Do'stlarni taklif qilish",
    copy: 'Matnni nusxalash',
    copied: "Matn nusxalandi — xohlagan joyga joylang.",
    copyManual: "Matnni nusxalab oling:",
    level: (num: number, title: string, stars: string, gates: number, goal: number) =>
      `Logic Gate · ${num}-daraja «${title}»
${stars} — ${gates} ta element (maqsad: ${goal})
Sen ham yechib ko'r!`,
    inviteText: "Logic Gate — mantiqiy elementlardan sxema yig'ib, boshqotirma yechadigan o'yin. 30 daraja, bepul!",
  },

  hints: {
    show: 'Maslahat',
    next: (n: number, total: number) => `Keyingi maslahat (${n}/${total})`,
    gates: (parts: string) => `3 ★ yechim tarkibi: ${parts}.`,
    first: (type: GateType, srcs: string[]) =>
      srcs.length === 1
        ? `Boshlang: ${srcs[0]} ni ${type} ga ulang.`
        : srcs[0] === srcs[1]
          ? `Boshlang: ${srcs[0]} ni ${type} ning ikkala kirishiga ulang.`
          : `Boshlang: ${srcs[0]} va ${srcs[1]} ni ${type} ga ulang.`,
    place: "Maydonga qo'yish",
    placed: 'Maydonda bor',
  },

  daily: {
    title: 'Kunlik boshqotirma',
    home: 'Kunlik boshqotirma',
    homeNew: 'Bugungi masala kutmoqda',
    homeDone: (stars: string, gates: number) => `Bugun yechildi: ${stars} · ${gates} element`,
    streak: (n: number) => `🔥 ${n} kun ketma-ket`,
    sub: (num: number, date: string, tier: string) => `#${num} · ${date} · ${tier}`,
    tiers: ['', 'Oson', 'Yengil', "O'rtacha", 'Qiyin', 'Juda qiyin'],
    task: (outputs: string[]) =>
      outputs.length === 1
        ? `Jadvaldagi ${outputs[0]} ustunini eng kam element bilan hosil qiling.`
        : `Jadvaldagi ${outputs.join(' va ')} ustunlarini eng kam element bilan hosil qiling.`,
    strategy: (outputs: number) =>
      outputs === 1
        ? "Jadvalda Q = 1 bo'lgan qatorlarga qarang: ularda kirishlar nimasi bilan o'xshash?"
        : "Avval har bir chiqishni alohida o'ylang, keyin ikkalasiga umumiy qismni toping — shunda element tejaladi.",
    date: (day: number, month: number) =>
      `${day}-${['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][month]}`,
    solved: 'Bugungi masala yechildi!',
    rank: (rank: number, solvers: number) => `Bugungi reytingda: ${rank}-o'rin (${solvers} kishidan)`,
    best: (gates: number) => `Bugungi eng kam yechim: ${gates} element`,
    first: "Bugungi reytingda 1-o'rindasiz!",
    next: (time: string) => `Keyingi masala ${time}dan keyin`,
    hours: (h: number, m: number) => (h ? `${h} soat ${m} daqiqa` : `${m} daqiqa`),
    toBoard: 'Bugungi reyting',
    offline: "Bugungi masalani yuklab bo'lmadi. Kunlik boshqotirma uchun internet kerak.",
    joinHint: "Bugungi reytingda qatnashish uchun taxallus kiriting:",
    share: (num: number, date: string, stars: string, gates: number, goal: number, streak: number) =>
      `Logic Gate · Kunlik boshqotirma #${num} (${date})
${stars} — ${gates} ta element (minimum: ${goal})${streak > 1 ? `\n🔥 ${streak} kun ketma-ket` : ''}
Sen ham yechib ko'r!`,
  },

  custom: {
    create: 'Masala qilish',
    createTitle: "Do'stlarga masala",
    createText:
      "Sxemangizning haqiqat jadvali masala bo'ladi. Do'stingiz uni sizdan kamroq element bilan yecha oladimi?",
    titlePlaceholder: 'Masala nomi (ixtiyoriy)',
    summary: (ins: number, outs: number, goal: number, gates: string) =>
      `${ins} kirish, ${outs} chiqish · maqsad: ${goal} element · ${gates}`,
    try: "O'zim sinab ko'raman",
    empty: "Avval maydonga element qo'yib, barcha chiqishlarni ulang.",
    shareText: (title: string, goal: number) =>
      `Logic Gate · ${title ? `«${title}» ` : ''}masala
Men buni ${goal} ta element bilan yig'dim. Sen-chi?`,
    untitled: "Do'stdan masala",
    sub: "Do'stdan masala",
    by: (name: string) => `Muallif: ${name}`,
    task: (outputs: string[], goal: number) =>
      `Jadvaldagi ${listOf(outputs)} ${outputs.length === 1 ? 'ustunini' : 'ustunlarini'} hosil qiling. Muallif ${goal} ta element ishlatgan.`,
    hint: "Jadvalga qarang: chiqish qaysi qatorlarda 1 bo'lyapti va bu qatorlarda kirishlar nimasi bilan o'xshash?",
    bad: "Havola noto'g'ri yoki buzilgan. Masalani yuborgan do'stingizdan qayta so'rang.",
    solved: 'Masala yechildi!',
    gates: (n: number, goal: number) => `Elementlar: ${n} (muallif: ${goal})`,
    beatAuthor: "Muallifdan ham kam element — zo'r!",
    resultText: (title: string, stars: string, gates: number, goal: number) =>
      `Logic Gate · ${title ? `«${title}»` : "do'st masalasi"}
${stars} — ${gates} ta element (muallif: ${goal})
Sen ham urinib ko'r!`,
    makeOwn: "O'z masalamni yarataman",
    toHome: 'Bosh sahifa',
  },

  achievements: {
    title: 'Yutuqlar',
    home: (n: number, max: number) => `Yutuqlar ${n}/${max}`,
    summary: (n: number, max: number) => `${n} / ${max} ochilgan`,
    unlocked: (names: string[]) =>
      names.length === 1 ? `Yangi yutuq: ${names[0]}` : `Yangi yutuqlar: ${names.join(', ')}`,
    first: { title: 'Birinchi qadam', text: 'Birinchi darajani yeching.' },
    chapter: {
      title: (name: string) => `«${name}»`,
      text: (n: number) => `Bo'limdagi barcha ${n} ta darajani yeching.`,
    },
    starsHalf: (n: number) => ({ title: "Yarim yo'l", text: `${n} ★ to'plang.` }),
    starsAll: (n: number) => ({ title: 'Mukammal', text: `Barcha ${n} ★ ni to'plang.` }),
    independent: (n: number) => ({ title: 'Mustaqil', text: `${n} ta darajani maslahatsiz 3 ★ bilan yeching.` }),
    nandMaster: { title: 'NAND ustasi', text: "«Faqat NAND» bo'limidagi barcha darajalarni 3 ★ bilan yeching." },
    dailyFirst: { title: 'Kunlik boshlanish', text: 'Birinchi kunlik boshqotirmani yeching.' },
    dailyPerfect: { title: 'Minimum topildi', text: 'Kunlik masalani eng kam element bilan (3 ★) yeching.' },
    streak: (n: number) => ({ title: `${n} kun ketma-ket`, text: `Kunlik masalani ${n} kun ketma-ket yeching.` }),
    creator: { title: 'Ijodkor', text: "Qum qutida masala yaratib, do'stlarga yuboring." },
    friend: { title: "Do'stona", text: "Do'stingiz yuborgan masalani yeching." },
    beatAuthor: { title: "Muallifdan o'tdingiz", text: "Do'st masalasini muallifdan kam element bilan yeching." },
  },

  sandbox: {
    title: 'Qum quti',
    text: "Istalgan sxemani erkin yig'ing va uning haqiqat jadvalini kuzating. Tayyor sxemani «Masala qilish» bilan do'stlarga yuboring.",
    inputs: 'Kirishlar',
    outputs: 'Chiqishlar',
  },

  leaderboard: {
    title: 'Reyting',
    overall: 'Umumiy',
    today: 'Bugun',
    gates: 'Element',
    dailyEmpty: "Bugungi masalani hali hech kim yechmagan. Birinchi bo'ling!",
    rank: '#',
    player: "O'yinchi",
    stars: '★',
    solved: 'Daraja',
    empty: "Hali hech kim daraja yechmagan. Birinchi bo'ling!",
    you: 'Siz',
    yourRank: (rank: number) => `Sizning o'rningiz: ${rank}`,
    notJoined: "Reytingda ko'rinish uchun taxallus kiriting.",
    offline: "Reytingni yuklab bo'lmadi. Internet aloqasini tekshiring.",
  },

  settings: {
    title: 'Sozlamalar',
    profile: 'Profil',
    nickname: 'Taxallus',
    rename: "O'zgartirish",
    code: 'Tiklash kodi',
    codeText: "Bu kodni saqlab qo'ying: u bilan boshqa qurilmada progressingizni tiklaysiz. Kodni hech kimga bermang.",
    copy: 'Nusxalash',
    copied: 'Nusxalandi',
    copyManual: "Avtomatik nusxalab bo'lmadi — kod belgilandi, uni qo'lda nusxalang.",
    restore: 'Progressni tiklash',
    restoreText: 'Boshqa qurilmadagi tiklash kodini kiriting.',
    restoreButton: 'Tiklash',
    restored: 'Progress tiklandi',
    badCode: "Kod noto'g'ri yoki topilmadi.",
    sound: 'Ovoz effektlari',
    on: 'Yoqilgan',
    off: "O'chirilgan",
    reset: "Progressni o'chirish",
    resetText: "Qurilmadagi barcha natijalar va qoralamalar o'chiriladi.",
    resetTextProfile:
      "Qurilmadagi natijalar, qoralamalar va profil o'chiriladi. Serverdagi natijalaringiz saqlanib qoladi — ularni tiklash kodi bilan qaytarish mumkin, shuning uchun avval kodni saqlab qo'ying.",
    resetConfirm: "Haqiqatan ham qurilmadagi progress o'chirilsinmi?",
    resetConfirmProfile:
      "Qurilmadagi progress va profil o'chirilsinmi? Qaytarish uchun tiklash kodi kerak bo'ladi — uni saqlab qo'ydingizmi?",
    resetDone: "Qurilmadagi progress o'chirildi.",
    about: 'Dastur haqida',
    version: (v: string) => `Versiya ${v}`,
  },

  tutorial: [
    "Pastdagi palitradan NOT elementini bosing yoki uni maydonga sudrang.",
    "A kirishining o'ngidagi nuqtadan NOT ning chap nuqtasiga sim torting. Ikki nuqtani ketma-ket bosish ham mumkin.",
    "Endi NOT ning o'ngidagi chiqish nuqtasini Q ga ulang.",
    "A ni bosib 0 va 1 qilib ko'ring, keyin «Tekshirish» tugmasini bosing.",
  ],

  errors: {
    too_many_gates: "Elementlar juda ko'p (ko'pi bilan 64 ta).",
    too_many_wires: "Simlar juda ko'p.",
    bad_gate: 'Sxemada xato bor. Elementni o\'chirib, qayta qo\'ying.',
    dup_gate: 'Sxemada xato bor. Elementni o\'chirib, qayta qo\'ying.',
    gate_not_allowed: 'Bu darajada bunday element ishlatib bo\'lmaydi.',
    bad_wire: "Sxemada noto'g'ri sim bor.",
    sink_taken: 'Bitta kirishga faqat bitta sim ulanadi.',
    cycle: "Sxemada sikl bor: signal o'ziga qaytib kelyapti.",
    unconnected_input: 'Belgilangan elementning kirishi ulanmagan.',
    unconnected_output: 'Chiqish ulanmagan.',
  } satisfies Record<ErrorCode, string>,
  unconnectedOutput: (name: string) => `${name} chiqishi ulanmagan.`,
  wrongRows: (n: number) => `${n} ta qatorda natija noto'g'ri. Jadvalda qizil qatorlarga qarang.`,
  network: "Server bilan aloqa yo'q.",
  badNickname: "Taxallus 2–20 belgidan iborat bo'lsin: harflar, raqamlar, bo'shliq, _ - .",
  nicknameNotAllowed: "Bu taxallusni ishlatib bo'lmaydi. Boshqasini tanlang.",
  rateLimited: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",

  gates: {
    NOT: { name: 'EMAS', text: 'Kirishni teskarisiga aylantiradi: 0 → 1, 1 → 0.' },
    AND: { name: 'VA', text: 'Ikkala kirish 1 bo\'lsa, 1.' },
    OR: { name: 'YOKI', text: 'Kamida bitta kirish 1 bo\'lsa, 1.' },
    XOR: { name: 'Istisno YOKI', text: 'Kirishlar har xil bo\'lsa, 1.' },
    NAND: { name: 'VA-EMAS', text: 'AND ning teskarisi.' },
    NOR: { name: 'YOKI-EMAS', text: 'OR ning teskarisi.' },
    XNOR: { name: 'Tenglik', text: 'Kirishlar bir xil bo\'lsa, 1.' },
  } satisfies Record<GateType, { name: string; text: string }>,
};

/** "A", "A va B", "A, B va C". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} va ${items[items.length - 1]}`;
}

export const t = uz;
