// Interfeys matnlari. Til `setLang` bilan almashtiriladi; yangi til — `typeof uz` tuzilmasidagi obyekt.
import { signal } from '@preact/signals';
import type { ErrorCode } from './sim/sim';
import type { GateType } from './sim/types';

export const uz = {
  appName: 'Logic Gate',
  tagline: "Mantiqiy elementlardan sxema yig'ing",
  language: 'Til',
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
    chapter: (n: number, title: string) => `${n}-bo'lim · ${title}`,
    chapterProgress: (solved: number, total: number, stars: number, max: number) => `${solved}/${total} daraja · ${stars}/${max} ★`,
    allDone: 'Hamma darajalar yechildi!',
    allDoneSub: "Endi yulduzlarni to'plang",
    // Statik qo'llanma (scripts/pages.mjs) — qidiruv tizimlari uchun ham.
    guide: "Mantiqiy elementlar qo'llanmasi",
    guideUrl: '/mantiqiy-elementlar/',
  },

  chapters: {
    title: 'Darajalar',
    locked: (need: number, have: number) => `Ochilishi uchun ${need} ★ kerak (sizda ${have} ★)`,
    chapterStars: (n: number, max: number) => `${n} / ${max} ★`,
  },

  play: {
    formula: 'Formula',
    formulaEmpty: "Elementlarni ulang — sxemaning formulasi shu yerda paydo bo'ladi.",
    formulaLegend: '¬ EMAS, ∧ VA, ∨ YOKI, ⊕ XOR',
    formulaTmp: "t1 — bir necha joyga ulangan element",
    formulaNext: "q1 — D-trigger, q1⁺ — uning keyingi taktdagi qiymati",
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
    // Xotira (ketma-ket sxemalar).
    tick: 'Takt',
    resetClock: 'Vaqtni boshiga qaytarish',
    stepLabel: (i: number) => `${i + 1}-takt`,
    diagram: 'Diagramma',
    example: 'Namuna',
    yourRun: 'Sizning sxemangiz',
    liveHint: "Kirishlarni o'zgartirib, «Takt» ni bosing — har takt shu yerda yoziladi.",
    now: 'hozir',
    seqWrong: (step: number, names: string) => `${step}-taktda ${names} noto'g'ri. Diagrammadagi qizil katakchaga qarang.`,
    seqOk: "Sxema to'g'ri ishlayapti — endi tekshiring!",
    clockText: "«Takt» tugmasi vaqtni bir qadam oldinga suradi: shu paytda barcha D-triggerlar kirishidagi qiymatni eslab qoladi.",
    nextTick: 'keyingi taktda',
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

  telegram: {
    play: "Telegram'da o'ynash",
    remindOn: 'Har kuni eslatish',
    remindOff: "Eslatmani o'chirish",
    remindText: 'Har kuni ertalab bot bugungi masala haqida yozadi. Yechgan kuningiz yozmaydi.',
    remindEnabled: 'Eslatma yoqildi: har kuni ertalab bot bugungi masala haqida yozadi.',
    remindDisabled: "Eslatma o'chirildi.",
    remindDenied: 'Bot sizga yozishi uchun ruxsat kerak.',
    remindBlocked: 'Bot sizga yoza olmadi: @LogicGateUzBot ni ochib, /start bosing.',
    restored: (name: string) => `Telegram orqali profil tiklandi: ${name}`,
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
    inviteText: "Logic Gate — mantiqiy elementlardan sxema yig'ib, boshqotirma yechadigan o'yin. 42 daraja, bepul!",
  },

  hints: {
    show: 'Maslahat',
    next: (n: number, total: number) => `Keyingi maslahat (${n}/${total})`,
    gates: (parts: string) => `3 ★ yechim tarkibi: ${parts}.`,
    first: (type: GateType, srcs: string[]) =>
      srcs.length === 0
        ? `Boshlang: maydonga ${type} qo'ying.`
        : srcs.length === 1
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
    streak: (n: number) => `${n} kun ketma-ket`,
    sub: (num: number, date: string, tier: string) => `#${num} · ${date} · ${tier}`,
    tiers: ['', 'Oson', 'Yengil', "O'rtacha", 'Qiyin', 'Juda qiyin'],
    task: (outputs: string[]) =>
      outputs.length === 1
        ? `Jadvaldagi ${outputs[0]} ustunini eng kam element bilan hosil qiling.`
        : `Jadvaldagi ${outputs.join(' va ')} ustunlarini eng kam element bilan hosil qiling.`,
    taskSeq: (outputs: string[]) =>
      `Bugun — xotira kuni: ${outputs.join(' va ')} vaqt diagrammasidagi namunadek bo'lsin. Eng kam element bilan yig'ing.`,
    strategySeq:
      "Diagrammaga qarang: chiqish faqat hozirgi kirishgami yoki oldingi taktlarga ham bog'liqmi? Nimani eslab qolish kerakligini toping — o'shani D-trigger saqlaydi.",
    strategy: (outputs: number): string =>
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
    archive: "O'tgan kunlar",
    archiveLink: "O'tgan kunlar masalalari",
    archiveSub: (n: number) => `${n} ta masala`,
    archiveNote: "Kechagi masala hali ochiq — yechsangiz, seriya va reytingga kiradi. Undan oldingilari — mashq uchun.",
    archiveEmpty: "Hali o'tgan kunlar yo'q — birinchi masala bugun.",
    archiveOffline: "Arxivni yuklab bo'lmadi. Buning uchun internet kerak.",
    open: 'Hali ochiq',
    memoryDay: 'Xotira kuni',
    dayStats: (solvers: number, best: number) =>
      solvers ? `${solvers} kishi yechgan · eng kami ${best} element` : 'Hali hech kim yechmagan',
    mine: (stars: number, gates: number) => `Natijangiz: ${stars} yulduz, ${gates} element`,
    notSolved: 'Yechilmagan',
    gatesShort: (n: number) => `${n} el.`,
    solvedPast: 'Masala yechildi!',
    rankPast: (rank: number, solvers: number) => `O'sha kun reytingida: ${rank}-o'rin (${solvers} kishidan)`,
    firstPast: "O'sha kun reytingida 1-o'rindasiz!",
    bestPast: (gates: number) => `O'sha kungi eng kam yechim: ${gates} element`,
    practiceTag: 'mashq',
    practice: 'Mashq: bu kun yopilgan, natija faqat shu qurilmada saqlanadi — reyting va seriyaga kirmaydi.',
    practiceBest: (gates: number) => `Eng yaxshi natijangiz: ${gates} element`,
    thatDay: (solvers: number, best: number) => `O'sha kuni ${solvers} kishi yechgan, eng kami — ${best} element.`,
    toArchive: 'Arxivga',
    share: (num: number, date: string, stars: string, gates: number, goal: number, streak: number) =>
      `Logic Gate · Kunlik boshqotirma #${num} (${date})
${stars} — ${gates} ta element (minimum: ${goal})${streak > 1 ? `\n🔥 ${streak} kun ketma-ket` : ''}
Sen ham yechib ko'r!`,
  },

  lesson: {
    button: "Bo'lim xulosasi",
    unlocked: "Bo'lim xulosasi ochildi — o'qib chiqing",
    note: (solved: number, total: number) => `Bo'lim xulosasi barcha darajalar yechilgach ochiladi (${solved}/${total})`,
    sub: (n: number, title: string) => `${n}-bo'lim xulosasi · ${title}`,
    locked: (solved: number, total: number) =>
      `Bu xulosa bo'limning barcha darajalari yechilgach ochiladi (${solved}/${total}) — avval o'zingiz kashf qilib ko'ring!`,
    toLevels: 'Darajalarga',
  },

  classes: {
    title: 'Sinf',
    teacher: "O'qituvchilar uchun",
    teacherIntro:
      "Sinf yarating va havolani o'quvchilarga yuboring: ular taxallus bilan qo'shiladi, siz esa kim qaysi darajani yechganini va kunlik masalani ko'rasiz.",
    namePlaceholder: '8-B sinf, 12-maktab',
    nameLabel: 'Sinf nomi',
    create: 'Sinf yaratish',
    myClasses: 'Sinflaringiz',
    noClasses: 'Hali sinf yaratmagansiz.',
    addExisting: 'Boshqa qurilmada yaratilgan sinf',
    addExistingText: "Sinf kodi va o'qituvchi kalitini kiriting.",
    codePlaceholder: 'Sinf kodi',
    keyPlaceholder: "O'qituvchi kaliti",
    add: "Qo'shish",
    members: (n: number) => `${n} o'quvchi`,
    code: 'Sinf kodi',
    joinLink: "O'quvchilar uchun havola",
    joinLinkText: "Havolani yoki kodni o'quvchilarga yuboring — ular taxallus bilan qo'shiladi.",
    shareText: (name: string) => `«${name}» sinfiga qo'shiling — Logic Gate'da mantiqiy sxemalar yig'amiz:`,
    copy: 'Nusxalash',
    copied: 'Nusxalandi',
    key: "O'qituvchi kaliti",
    keyText: "Shu kalit bilan hisobotni boshqa qurilmada ham ochasiz. O'quvchilarga bermang.",
    refresh: 'Yangilash',
    empty: "Hali hech kim qo'shilmagan. Havolani o'quvchilarga yuboring.",
    student: "O'quvchi",
    levels: 'Daraja',
    today: 'Bugun',
    week: '7 kun',
    lastSeen: 'Faollik',
    sortName: 'Ism',
    sortStars: 'Yulduz',
    sort: 'Tartib',
    todayCount: (n: number, total: number) => `Bugungi kunlik masalani ${n}/${total} o'quvchi yechgan`,
    seen: (days: number) => (days <= 0 ? 'bugun' : days === 1 ? 'kecha' : `${days} kun oldin`),
    chapterHint: (title: string, solved: number, total: number, stars: number) => `${title}: ${solved}/${total} daraja, ${stars} ★`,
    remove: 'Sinfdan chiqarish',
    removeConfirm: (nick: string) => `${nick} sinfdan chiqarilsinmi? Uning natijalari o'zida qoladi.`,
    deleteClass: "Sinfni o'chirish",
    deleteConfirm: "Sinf o'chirilsinmi? O'quvchilarning natijalari o'zlarida qoladi, lekin hisobot yo'qoladi.",
    noKey: "Bu sinfning kaliti shu qurilmada yo'q. Kod va kalit bilan qo'shing.",
    joinTitle: 'Sinfga taklif',
    joinText: "Qo'shilsangiz, o'qituvchingiz natijalaringizni ko'radi, siz esa sinfdoshlar reytingini.",
    join: "Sinfga qo'shilish",
    joinNeedsProfile: 'Qo\'shilish uchun avval taxallus kiriting:',
    joined: 'Siz shu sinfdasiz',
    leave: 'Sinfdan chiqish',
    leaveConfirm: 'Sinfdan chiqasizmi? Natijalaringiz o\'zingizda qoladi.',
    board: 'Sinf reytingi',
    yourClasses: 'Sinflaringiz',
    enterCode: "Sinf kodi bilan qo'shilish",
    open: 'Ochish',
    teacherLink: "O'qituvchilar uchun: sinf yaratish",
    errors: {
      no_class: 'Bunday sinf topilmadi. Kodni tekshiring.',
      class_full: "Sinfda o'rin qolmagan (ko'pi bilan 200 o'quvchi).",
      bad_key: "O'qituvchi kaliti noto'g'ri.",
      bad_class_name: "Sinf nomi 2–50 belgidan iborat bo'lsin: harflar, raqamlar va oddiy belgilar.",
      not_member: 'Siz bu sinfda emassiz.',
    } as Record<string, string>,
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
    tooComplex: "Sxemaning xatti-harakati havolaga sig'maydi (holatlar juda ko'p). Kamroq trigger yoki kirish ishlating.",
    createTextSeq:
      "Sxemangizning vaqt bo'yicha xatti-harakati masala bo'ladi. Do'stingiz uni sizdan kamroq element bilan yig'a oladimi?",
    shareText: (title: string, goal: number) =>
      `Logic Gate · ${title ? `«${title}» ` : ''}masala
Men buni ${goal} ta element bilan yig'dim. Sen-chi?`,
    untitled: "Do'stdan masala",
    sub: "Do'stdan masala",
    by: (name: string) => `Muallif: ${name}`,
    task: (outputs: string[], goal: number) =>
      `Jadvaldagi ${listOf(outputs, 'va')} ${outputs.length === 1 ? 'ustunini' : 'ustunlarini'} hosil qiling. Muallif ${goal} ta element ishlatgan.`,
    hint: "Jadvalga qarang: chiqish qaysi qatorlarda 1 bo'lyapti va bu qatorlarda kirishlar nimasi bilan o'xshash?",
    taskSeq: (outputs: string[], goal: number) =>
      `Namunadagidek ishlaydigan xotirali sxema yig'ing: ${listOf(outputs, 'va')} vaqt diagrammasidagidek bo'lsin. Muallif ${goal} ta element ishlatgan.`,
    hintSeq: "Diagrammaga qarang: chiqish oldingi taktlardagi kirishlarga qanday bog'liq? Nimani eslab qolish kerak?",
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

  migrate: {
    title: (host: string) => `O'yin yangi manzilga ko'chdi: ${host}`,
    text: "Natijalaringiz shu manzilda saqlangan. Ularni yangi manzilga o'zingiz bilan olib o'ting — bir bosish kifoya.",
    button: "Natijalarim bilan o'tish",
    done: "Natijalaringiz yangi manzilga ko'chirildi.",
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
    levelsN: (n: number) => `${n} daraja`,
    gatesN: (n: number) => `${n} element`,
    place: (n: number) => `${n}-o'rin`,
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
    theme: 'Mavzu',
    themes: { plata: 'Plata', daftar: 'Daftar', auto: 'Avto' },
    themeHint: {
      plata: "Qorong'i: yashil plata va mis yo'llar",
      daftar: "Yorug': katakli daftar — kunduzi va darsda proyektorda qulay",
      auto: "Telefon yoki Telegram'ning yorug'/qorong'i rejimiga qarab",
    },
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
  /** Birinchi xotira darajasi uchun o'rgatuvchi qadamlar. */
  tutorialSeq: [
    "Palitradan DFF (D-trigger) ni maydonga qo'ying.",
    'A ni DFF kirishiga, DFF chiqishini Q ga ulang.',
    "A ni 1 qiling: Q hali 0. Endi «Takt» ni bosing — DFF A ni eslab qoladi va Q = 1 bo'ladi.",
    "A ni o'zgartirib, yana «Takt» bosib ko'ring. Tayyor bo'lsa — «Tekshirish».",
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
    too_many_flipflops: "D-triggerlar juda ko'p (ko'pi bilan 8 ta).",
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
    DFF: { name: 'Xotira', text: "D-trigger: D kirishidagi qiymatni eslab qoladi va keyingi taktda Q da chiqaradi. Boshida 0." },
  } satisfies Record<GateType, { name: string; text: string }>,
};


export const ru: typeof uz = {
  appName: 'Logic Gate',
  tagline: 'Собирайте схемы из логических элементов',
  language: 'Язык',
  back: 'Назад',
  close: 'Закрыть',
  cancel: 'Отмена',
  save: 'Сохранить',
  retry: 'Повторить',
  loading: 'Загрузка…',

  home: {
    play: 'Играть',
    continue: 'Продолжить',
    levels: 'Уровни',
    sandbox: 'Песочница',
    leaderboard: 'Рейтинг',
    settings: 'Настройки',
    stars: (n: number, max: number) => `${n} / ${max} ★`,
    solved: (n: number, max: number) => `${n} / ${max} ур.`,
    joinTitle: 'Участвуйте в рейтинге',
    joinText: 'Введите никнейм — ваши результаты попадут в рейтинг. Регистрация не нужна.',
    nicknamePlaceholder: 'Ваш никнейм',
    join: 'Участвовать',
    hello: (name: string) => `Привет, ${name}!`,
    chapter: (n: number, title: string) => `Глава ${n} · ${title}`,
    chapterProgress: (solved: number, total: number, stars: number, max: number) => `${solved}/${total} ур. · ${stars}/${max} ★`,
    allDone: 'Все уровни пройдены!',
    allDoneSub: 'Теперь соберите все звёзды',
    guide: 'Справочник: логические элементы',
    guideUrl: '/ru/logicheskie-elementy/',
  },

  chapters: {
    title: 'Уровни',
    locked: (need: number, have: number) => `Откроется при ${need} ★ (у вас ${have} ★)`,
    chapterStars: (n: number, max: number) => `${n} / ${max} ★`,
  },

  play: {
    formula: 'Формула',
    formulaEmpty: 'Соедините элементы — здесь появится формула схемы.',
    formulaLegend: '¬ НЕ, ∧ И, ∨ ИЛИ, ⊕ XOR',
    formulaTmp: 't1 — элемент, подключённый в нескольких местах',
    formulaNext: 'q1 — D-триггер, q1⁺ — его значение на следующем такте',
    goal: (n: number) => `Цель: ${n} эл.`,
    used: (n: number) => `Использовано: ${n}`,
    check: 'Проверить',
    checking: 'Проверка',
    skip: 'Пропустить',
    rowLabel: (r: number) => `Строка ${r + 1}`,
    table: 'Таблица',
    task: 'Задание',
    undo: 'Отменить',
    redo: 'Повторить',
    clear: 'Очистить',
    clearConfirm: 'Удалить все элементы с поля?',
    fit: 'Показать всё',
    zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить',
    remove: 'Удалить',
    expected: 'Нужно',
    got: 'У вас',
    inputs: 'Входы',
    outputs: 'Выходы',
    allowed: 'Элементы',
    cycle: 'Так соединить нельзя: сигнал вернётся сам в себя.',
    sameKind: 'Соедините выход со входом: провод идёт от источника к приёмнику.',
    rowsOk: 'Все строки верны — проверяйте!',
    newGate: 'Новый элемент',
    newGates: 'Новые элементы',
    gotIt: 'Понятно',
    tick: 'Такт',
    resetClock: 'Вернуть время к началу',
    stepLabel: (i: number) => `Такт ${i + 1}`,
    diagram: 'Диаграмма',
    example: 'Пример',
    yourRun: 'Ваша схема',
    liveHint: 'Меняйте входы и нажимайте «Такт» — каждый такт записывается здесь.',
    now: 'сейчас',
    seqWrong: (step: number, names: string) => `На такте ${step} неверно: ${names}. Смотрите красную клетку на диаграмме.`,
    seqOk: 'Схема работает верно — теперь проверьте!',
    clockText: 'Кнопка «Такт» продвигает время на один шаг: в этот момент все D-триггеры запоминают значение на входе.',
    nextTick: 'на следующем такте',
  },

  success: {
    title: 'Уровень пройден!',
    gates: (n: number, goal: number) => `Элементов: ${n} (цель: ${goal})`,
    tryFewer: (goal: number) => `Для 3 ★ используйте не больше ${goal} эл.`,
    improved: 'Новый личный рекорд!',
    record: (gates: number, names: string) => `Лучший результат: ${gates} эл. — ${names}`,
    beatRecord: 'Это решение с наименьшим числом элементов!',
    joinHint: 'Чтобы попасть в рейтинг, введите никнейм:',
    solvers: (n: number) => `Этот уровень прошли: ${n}`,
    next: 'Следующий уровень',
    again: 'Улучшить',
    toLevels: 'Уровни',
    nextLocked: (need: number) => `Следующий раздел откроется при ${need} ★`,
    allDone: 'Поздравляем! Вы прошли все уровни.',
    offline: 'Результат сохранён на устройстве. Он отправится, когда появится связь с сервером.',
  },

  telegram: {
    play: 'Играть в Telegram',
    remindOn: 'Напоминать каждый день',
    remindOff: 'Выключить напоминание',
    remindText: 'Каждое утро бот напишет о задаче дня. В день, когда вы её решили, не пишет.',
    remindEnabled: 'Напоминание включено: каждое утро бот напишет о задаче дня.',
    remindDisabled: 'Напоминание выключено.',
    remindDenied: 'Нужно разрешить боту писать вам.',
    remindBlocked: 'Бот не смог вам написать: откройте @LogicGateUzBot и нажмите /start.',
    restored: (name: string) => `Профиль восстановлен через Telegram: ${name}`,
  },

  share: {
    telegram: 'Поделиться в Telegram',
    native: 'Поделиться',
    invite: 'Пригласить друзей',
    copy: 'Скопировать текст',
    copied: 'Текст скопирован — вставьте его куда угодно.',
    copyManual: 'Скопируйте текст:',
    level: (num: number, title: string, stars: string, gates: number, goal: number) =>
      `Logic Gate · уровень ${num} «${title}»\n${stars} — ${gates} эл. (цель: ${goal})\nПопробуй и ты!`,
    inviteText: 'Logic Gate — игра-головоломка: собирай схемы из логических элементов. 42 уровня, бесплатно!',
  },

  hints: {
    show: 'Подсказка',
    next: (n: number, total: number) => `Следующая подсказка (${n}/${total})`,
    gates: (parts: string) => `Решение на 3 ★: ${parts}.`,
    first: (type: GateType, srcs: string[]) =>
      srcs.length === 0
        ? `Начните так: поставьте на поле ${type}.`
        : srcs.length === 1
        ? `Начните так: подайте ${srcs[0]} на ${type}.`
        : srcs[0] === srcs[1]
          ? `Начните так: подайте ${srcs[0]} на оба входа ${type}.`
          : `Начните так: подайте ${srcs[0]} и ${srcs[1]} на ${type}.`,
    place: 'Поставить на поле',
    placed: 'Уже на поле',
  },

  daily: {
    title: 'Задача дня',
    home: 'Задача дня',
    homeNew: 'Сегодняшняя задача ждёт',
    homeDone: (stars: string, gates: number) => `Сегодня решено: ${stars} · ${gates} эл.`,
    streak: (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')} подряд`,
    sub: (num: number, date: string, tier: string) => `#${num} · ${date} · ${tier}`,
    tiers: ['', 'Легко', 'Несложно', 'Средне', 'Сложно', 'Очень сложно'],
    task: (outputs: string[]) =>
      outputs.length === 1
        ? `Получите столбец ${outputs[0]} из таблицы наименьшим числом элементов.`
        : `Получите столбцы ${outputs.join(' и ')} из таблицы наименьшим числом элементов.`,
    taskSeq: (outputs: string[]) =>
      `Сегодня день памяти: ${outputs.join(' и ')} — как в примере на временной диаграмме. Соберите наименьшим числом элементов.`,
    strategySeq:
      'Посмотрите на диаграмму: зависит ли выход только от текущего входа или и от прошлых тактов? Найдите, что нужно запомнить, — это хранит D-триггер.',
    strategy: (outputs: number) =>
      outputs === 1
        ? 'Посмотрите на строки, где Q = 1: чем похожи в них входы?'
        : 'Сначала продумайте каждый выход отдельно, затем найдите общую часть — так вы сэкономите элементы.',
    date: (day: number, month: number) =>
      `${day} ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][month]}`,
    solved: 'Задача дня решена!',
    rank: (rank: number, solvers: number) => `В рейтинге дня: ${rank}-е место (из ${solvers})`,
    best: (gates: number) => `Лучшее решение дня: ${gates} эл.`,
    first: 'Вы на 1-м месте в рейтинге дня!',
    next: (time: string) => `Следующая задача через ${time}`,
    hours: (h: number, m: number) => (h ? `${h} ч ${m} мин` : `${m} мин`),
    toBoard: 'Рейтинг дня',
    offline: 'Не удалось загрузить задачу дня. Для неё нужен интернет.',
    joinHint: 'Чтобы попасть в рейтинг дня, введите никнейм:',
    archive: 'Прошлые дни',
    archiveLink: 'Задачи прошлых дней',
    archiveSub: (n: number) => `${n} ${plural(n, 'задача', 'задачи', 'задач')}`,
    archiveNote: 'Вчерашняя задача ещё открыта — решите её, и она пойдёт в серию и рейтинг. Более ранние — для тренировки.',
    archiveEmpty: 'Прошлых дней пока нет — первая задача сегодня.',
    archiveOffline: 'Не удалось загрузить архив. Для него нужен интернет.',
    open: 'Ещё открыта',
    memoryDay: 'День памяти',
    dayStats: (solvers: number, best: number) =>
      solvers ? `Решили: ${solvers} · лучшее — ${best} эл.` : 'Пока никто не решил',
    mine: (stars: number, gates: number) => `Ваш результат: ${stars} ${plural(stars, 'звезда', 'звезды', 'звёзд')}, ${gates} эл.`,
    notSolved: 'Не решена',
    gatesShort: (n: number) => `${n} эл.`,
    solvedPast: 'Задача решена!',
    rankPast: (rank: number, solvers: number) => `В рейтинге того дня: ${rank}-е место (из ${solvers})`,
    firstPast: 'Вы на 1-м месте в рейтинге того дня!',
    bestPast: (gates: number) => `Лучшее решение того дня: ${gates} эл.`,
    practiceTag: 'тренировка',
    practice: 'Тренировка: этот день закрыт, результат хранится только на этом устройстве и не идёт в рейтинг и серию.',
    practiceBest: (gates: number) => `Ваш лучший результат: ${gates} эл.`,
    thatDay: (solvers: number, best: number) => `В тот день решили ${solvers}, лучшее решение — ${best} эл.`,
    toArchive: 'В архив',
    share: (num: number, date: string, stars: string, gates: number, goal: number, streak: number) =>
      `Logic Gate · Задача дня #${num} (${date})\n${stars} — ${gates} эл. (минимум: ${goal})` +
      (streak > 1 ? `\n🔥 ${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд` : '') +
      '\nПопробуй и ты!',
  },

  lesson: {
    button: 'Итоги главы',
    unlocked: 'Открыты итоги главы — прочитайте',
    note: (solved: number, total: number) => `Итоги главы откроются, когда будут решены все уровни (${solved}/${total})`,
    sub: (n: number, title: string) => `Итоги ${n}-й главы · ${title}`,
    locked: (solved: number, total: number) =>
      `Итоги откроются, когда будут решены все уровни главы (${solved}/${total}) — сначала попробуйте разобраться сами!`,
    toLevels: 'К уровням',
  },

  classes: {
    title: 'Класс',
    teacher: 'Для учителей',
    teacherIntro:
      'Создайте класс и отправьте ссылку ученикам: они присоединятся со своим никнеймом, а вы увидите, кто какие уровни решил и как дела с задачей дня.',
    namePlaceholder: '8 «Б», школа № 12',
    nameLabel: 'Название класса',
    create: 'Создать класс',
    myClasses: 'Ваши классы',
    noClasses: 'Вы ещё не создали ни одного класса.',
    addExisting: 'Класс, созданный на другом устройстве',
    addExistingText: 'Введите код класса и ключ учителя.',
    codePlaceholder: 'Код класса',
    keyPlaceholder: 'Ключ учителя',
    add: 'Добавить',
    members: (n: number) => `${n} ${plural(n, 'ученик', 'ученика', 'учеников')}`,
    code: 'Код класса',
    joinLink: 'Ссылка для учеников',
    joinLinkText: 'Отправьте ученикам ссылку или код — они присоединятся со своим никнеймом.',
    shareText: (name: string) => `Присоединяйтесь к классу «${name}» — собираем логические схемы в Logic Gate:`,
    copy: 'Копировать',
    copied: 'Скопировано',
    key: 'Ключ учителя',
    keyText: 'С этим ключом отчёт откроется и на другом устройстве. Не давайте его ученикам.',
    refresh: 'Обновить',
    empty: 'Пока никто не присоединился. Отправьте ссылку ученикам.',
    student: 'Ученик',
    levels: 'Уровни',
    today: 'Сегодня',
    week: '7 дней',
    lastSeen: 'Активность',
    sortName: 'Имя',
    sortStars: 'Звёзды',
    sort: 'Сортировка',
    todayCount: (n: number, total: number) => `Задачу дня решили ${n} из ${total}`,
    seen: (days: number) => (days <= 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`),
    chapterHint: (title: string, solved: number, total: number, stars: number) => `${title}: ${solved}/${total} ур., ${stars} ★`,
    remove: 'Удалить из класса',
    removeConfirm: (nick: string) => `Удалить ${nick} из класса? Его результаты останутся у него.`,
    deleteClass: 'Удалить класс',
    deleteConfirm: 'Удалить класс? Результаты учеников останутся у них, но отчёт пропадёт.',
    noKey: 'Ключа этого класса нет на этом устройстве. Добавьте класс по коду и ключу.',
    joinTitle: 'Приглашение в класс',
    joinText: 'Если присоединитесь, учитель увидит ваши результаты, а вы — рейтинг одноклассников.',
    join: 'Присоединиться к классу',
    joinNeedsProfile: 'Чтобы присоединиться, сначала введите никнейм:',
    joined: 'Вы в этом классе',
    leave: 'Выйти из класса',
    leaveConfirm: 'Выйти из класса? Ваши результаты останутся у вас.',
    board: 'Рейтинг класса',
    yourClasses: 'Ваши классы',
    enterCode: 'Присоединиться по коду класса',
    open: 'Открыть',
    teacherLink: 'Для учителей: создать класс',
    errors: {
      no_class: 'Такой класс не найден. Проверьте код.',
      class_full: 'В классе нет мест (не больше 200 учеников).',
      bad_key: 'Неверный ключ учителя.',
      bad_class_name: 'Название класса — 2–50 символов: буквы, цифры и обычные знаки.',
      not_member: 'Вы не состоите в этом классе.',
    } as Record<string, string>,
  },

  custom: {
    create: 'Сделать задачу',
    createTitle: 'Задача для друзей',
    createText: 'Таблица истинности вашей схемы станет задачей. Сможет ли друг решить её меньшим числом элементов?',
    titlePlaceholder: 'Название задачи (необязательно)',
    summary: (ins: number, outs: number, goal: number, gates: string) =>
      `входов: ${ins}, выходов: ${outs} · цель: ${goal} эл. · ${gates}`,
    try: 'Попробовать самому',
    empty: 'Сначала поставьте элементы на поле и подключите все выходы.',
    tooComplex: 'Поведение схемы не помещается в ссылку (слишком много состояний). Используйте меньше триггеров или входов.',
    createTextSeq: 'Задачей станет поведение вашей схемы во времени. Сможет ли друг собрать её из меньшего числа элементов?',
    shareText: (title: string, goal: number) =>
      `Logic Gate · задача${title ? ` «${title}»` : ''}\nЯ собрал её из ${goal} эл. А ты?`,
    untitled: 'Задача от друга',
    sub: 'Задача от друга',
    by: (name: string) => `Автор: ${name}`,
    task: (outputs: string[], goal: number) =>
      `Получите ${outputs.length === 1 ? 'столбец' : 'столбцы'} ${listOf(outputs, 'и')} из таблицы. Автор использовал ${goal} эл.`,
    hint: 'Посмотрите на таблицу: в каких строках выход равен 1 и чем похожи в них входы?',
    taskSeq: (outputs: string[], goal: number) =>
      `Соберите схему с памятью, которая работает как в примере: ${listOf(outputs, 'и')} — как на временной диаграмме. Автор использовал ${goal} эл.`,
    hintSeq: 'Посмотрите на диаграмму: как выход зависит от входов на прошлых тактах? Что нужно запомнить?',
    bad: 'Ссылка неверна или повреждена. Попросите друга отправить задачу ещё раз.',
    solved: 'Задача решена!',
    gates: (n: number, goal: number) => `Элементов: ${n} (у автора: ${goal})`,
    beatAuthor: 'Меньше, чем у автора — отлично!',
    resultText: (title: string, stars: string, gates: number, goal: number) =>
      `Logic Gate · ${title ? `«${title}»` : 'задача друга'}\n${stars} — ${gates} эл. (у автора: ${goal})\nПопробуй и ты!`,
    makeOwn: 'Создать свою задачу',
    toHome: 'На главную',
  },

  achievements: {
    title: 'Достижения',
    home: (n: number, max: number) => `Достижения ${n}/${max}`,
    summary: (n: number, max: number) => `открыто ${n} из ${max}`,
    unlocked: (names: string[]) =>
      names.length === 1 ? `Новое достижение: ${names[0]}` : `Новые достижения: ${names.join(', ')}`,
    first: { title: 'Первый шаг', text: 'Пройдите первый уровень.' },
    chapter: {
      title: (name: string) => `«${name}»`,
      text: (n: number) => `Пройдите все ${n} уровней раздела.`,
    },
    starsHalf: (n: number) => ({ title: 'Полпути', text: `Соберите ${n} ★.` }),
    starsAll: (n: number) => ({ title: 'Безупречно', text: `Соберите все ${n} ★.` }),
    independent: (n: number) => ({ title: 'Самостоятельный', text: `Пройдите ${n} уровней на 3 ★ без подсказок.` }),
    nandMaster: { title: 'Мастер NAND', text: 'Пройдите все уровни раздела «Только NAND» на 3 ★.' },
    dailyFirst: { title: 'Начало дня', text: 'Решите первую задачу дня.' },
    dailyPerfect: { title: 'Минимум найден', text: 'Решите задачу дня наименьшим числом элементов (3 ★).' },
    streak: (n: number) => ({
      title: `${n} ${plural(n, 'день', 'дня', 'дней')} подряд`,
      text: `Решайте задачу дня ${n} ${plural(n, 'день', 'дня', 'дней')} подряд.`,
    }),
    creator: { title: 'Создатель', text: 'Создайте задачу в песочнице и отправьте друзьям.' },
    friend: { title: 'Дружеский', text: 'Решите задачу, присланную другом.' },
    beatAuthor: { title: 'Лучше автора', text: 'Решите задачу друга меньшим числом элементов, чем автор.' },
  },

  migrate: {
    title: (host: string) => `Игра переехала на новый адрес: ${host}`,
    text: 'Ваши результаты сохранены на этом адресе. Возьмите их с собой на новый — достаточно одного нажатия.',
    button: 'Перейти с результатами',
    done: 'Ваши результаты перенесены на новый адрес.',
  },

  sandbox: {
    title: 'Песочница',
    text: 'Свободно собирайте любые схемы и смотрите их таблицу истинности. Готовую схему отправьте друзьям через «Сделать задачу».',
    inputs: 'Входы',
    outputs: 'Выходы',
  },

  leaderboard: {
    title: 'Рейтинг',
    overall: 'Общий',
    today: 'Сегодня',
    gates: 'Эл.',
    dailyEmpty: 'Сегодняшнюю задачу ещё никто не решил. Будьте первым!',
    rank: '#',
    player: 'Игрок',
    stars: '★',
    solved: 'Уровни',
    empty: 'Ещё никто не прошёл ни одного уровня. Будьте первым!',
    you: 'Вы',
    yourRank: (rank: number) => `Ваше место: ${rank}`,
    levelsN: (n: number) => `${n} ${plural(n, 'уровень', 'уровня', 'уровней')}`,
    gatesN: (n: number) => `${n} эл.`,
    place: (n: number) => `${n}-е место`,
    notJoined: 'Чтобы появиться в рейтинге, введите никнейм.',
    offline: 'Не удалось загрузить рейтинг. Проверьте подключение к интернету.',
  },

  settings: {
    title: 'Настройки',
    profile: 'Профиль',
    nickname: 'Никнейм',
    rename: 'Изменить',
    code: 'Код восстановления',
    codeText: 'Сохраните этот код: с ним вы восстановите прогресс на другом устройстве. Никому его не передавайте.',
    copy: 'Копировать',
    copied: 'Скопировано',
    copyManual: 'Не удалось скопировать автоматически — код выделен, скопируйте его вручную.',
    restore: 'Восстановить прогресс',
    restoreText: 'Введите код восстановления с другого устройства.',
    restoreButton: 'Восстановить',
    restored: 'Прогресс восстановлен',
    badCode: 'Код неверный или не найден.',
    theme: 'Тема',
    themes: { plata: 'Плата', daftar: 'Тетрадь', auto: 'Авто' },
    themeHint: {
      plata: 'Тёмная: зелёная плата и медные дорожки',
      daftar: 'Светлая: тетрадь в клетку — удобно днём и на проекторе в классе',
      auto: 'По светлому/тёмному режиму телефона или Telegram',
    },
    sound: 'Звуковые эффекты',
    on: 'Включены',
    off: 'Выключены',
    reset: 'Сбросить прогресс',
    resetText: 'Все результаты и черновики на устройстве будут удалены.',
    resetTextProfile:
      'Результаты, черновики и профиль на устройстве будут удалены. Результаты на сервере сохранятся — их можно вернуть кодом восстановления, поэтому сначала сохраните код.',
    resetConfirm: 'Точно удалить прогресс на устройстве?',
    resetConfirmProfile:
      'Удалить прогресс и профиль на устройстве? Для возврата понадобится код восстановления — вы его сохранили?',
    resetDone: 'Прогресс на устройстве удалён.',
    about: 'О программе',
    version: (v: string) => `Версия ${v}`,
  },

  tutorial: [
    'Нажмите на элемент NOT в палитре внизу или перетащите его на поле.',
    'Протяните провод от точки справа от входа A к левой точке NOT. Можно и просто нажать на обе точки по очереди.',
    'Теперь соедините выходную точку справа от NOT с Q.',
    'Нажимайте на A, чтобы переключать 0 и 1, затем нажмите «Проверить».',
  ],
  tutorialSeq: [
    'Поставьте на поле DFF (D-триггер) из палитры.',
    'Подайте A на вход DFF, а выход DFF соедините с Q.',
    'Сделайте A = 1: Q пока 0. Теперь нажмите «Такт» — DFF запомнит A, и Q станет 1.',
    'Меняйте A и снова нажимайте «Такт». Когда будете готовы — «Проверить».',
  ],

  errors: {
    too_many_gates: 'Слишком много элементов (не больше 64).',
    too_many_wires: 'Слишком много проводов.',
    bad_gate: 'В схеме ошибка. Удалите элемент и поставьте заново.',
    dup_gate: 'В схеме ошибка. Удалите элемент и поставьте заново.',
    gate_not_allowed: 'На этом уровне такой элемент использовать нельзя.',
    bad_wire: 'В схеме неверный провод.',
    sink_taken: 'К одному входу подключается только один провод.',
    cycle: 'В схеме цикл: сигнал возвращается сам в себя.',
    unconnected_input: 'Вход отмеченного элемента не подключён.',
    unconnected_output: 'Выход не подключён.',
    too_many_flipflops: 'Слишком много D-триггеров (не больше 8).',
  },
  unconnectedOutput: (name: string) => `Выход ${name} не подключён.`,
  wrongRows: (n: number) =>
    `Неверно в ${n} ${plural(n, 'строке', 'строках', 'строках')}. Посмотрите на красные строки в таблице.`,
  network: 'Нет связи с сервером.',
  badNickname: 'Никнейм — 2–20 символов: буквы, цифры, пробел, _ - .',
  nicknameNotAllowed: 'Этот никнейм использовать нельзя. Выберите другой.',
  rateLimited: 'Слишком много попыток. Попробуйте чуть позже.',

  gates: {
    NOT: { name: 'НЕ', text: 'Меняет вход на противоположный: 0 → 1, 1 → 0.' },
    AND: { name: 'И', text: '1, если оба входа равны 1.' },
    OR: { name: 'ИЛИ', text: '1, если хотя бы один вход равен 1.' },
    XOR: { name: 'Искл. ИЛИ', text: '1, если входы разные.' },
    NAND: { name: 'И-НЕ', text: 'Отрицание AND.' },
    NOR: { name: 'ИЛИ-НЕ', text: 'Отрицание OR.' },
    XNOR: { name: 'Равенство', text: '1, если входы одинаковые.' },
    DFF: { name: 'Память', text: 'D-триггер: запоминает значение на входе D и выдаёт его на выходе Q на следующем такте. В начале 0.' },
  },
};

/** "A", "A va B", "A, B va C" (ruschada — "и"). */
function listOf(items: string[], and: string): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/** Ruscha ko'plik shakli: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const dicts = { uz, ru };
export type Lang = keyof typeof dicts;
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'uz', name: "O'zbekcha" },
  { id: 'ru', name: 'Русский' },
];

/** Joriy til lug'ati. `export let` — import qilgan modullar har doim joriy qiymatni ko'radi. */
export let t: typeof uz = uz;
export const lang = signal<Lang>('uz');

export function setLang(l: Lang) {
  const next: Lang = l in dicts ? l : 'uz';
  t = dicts[next];
  try {
    document.documentElement.lang = next;
  } catch {
    // Testlarda document yo'q.
  }
  lang.value = next;
}
