// Kampaniya hikoyasi matnlari (uz/ru): bo'lim sahnalari va darajalar ustidagi hikoya qatorlari.
// Alohida modul: bo'limlar ro'yxati yoki daraja ochilganda yuklanadi (bosh bundle'da yo'q).
// Holat — qaysi sahna ko'rilgan, hikoya yoqilganmi — story.ts da. Dunyo va uslub: DECISIONS.md («Kampaniya hikoyasi», 2.27.0).
import { lang } from './i18n';

/** Kadr rasmi: StoryScene.tsx dagi SVG sahnalardan biri. */
export type Art = 'city' | 'workshop' | 'note' | 'orb' | 'wake' | 'talk' | 'laugh' | 'window' | 'chest' | 'chip' | 'plan' | 'bus' | 'bazaar' | 'gatelock' | 'bazaarlit' | 'tower'
  | 'towerlit' | 'scales' | 'vault' | 'fountain' | 'counter' | 'counterlit' | 'heart' | 'heartlit' | 'citylit';

/** Bitta kadr: rasm, matn; who — gapiruvchi (yo'q bo'lsa — hikoyachi), note — buvining daftaridan. */
export interface Frame {
  art: Art;
  text: string;
  who?: 'lola' | 'chiroq';
  note?: boolean;
}

export interface Scene {
  /** Sahna sarlavhasi (joy nomi). */
  title: string;
  frames: Frame[];
}

export interface ChapterStory {
  /** Bo'lim kartasidagi joy nomi (texnik nom ikkinchi qatorda qoladi). */
  place: string;
  intro: Scene;
  outro: Scene;
  /** Daraja id → masala matni ustidagi hikoya qatori. */
  lines: Record<string, string>;
}

const uz: Record<string, ChapterStory> = {
  basics: {
    place: 'Buvining ustaxonasi',
    intro: {
      title: 'Sukunat',
      frames: [
        { art: 'city', text: "Sukunatning uchinchi kechasi. Ko'hna Minor ustida birorta ham chiroq yonmaydi." },
        { art: 'workshop', text: "Lola buvisining ustaxonasiga kiradi. Stol ustida chang bosgan mis shar va buklangan qog'oz." },
        { art: 'note', note: true, text: "«Lola, buni o'qiyotgan bo'lsang, men ketganman. Ustozni qayta yoq. Sehr bilan emas — tushunib. M.»" },
        { art: 'orb', who: 'lola', text: "Shar ichida kichik kalitlar va uzilgan simlar. Ularni to'g'ri ulasam-chi?" },
      ],
    },
    outro: {
      title: 'Chiroq uyg\'ondi',
      frames: [
        { art: 'wake', who: 'chiroq', text: '…1.' },
        { art: 'talk', who: 'lola', text: 'Salom! Sen gapira olasanmi?' },
        { art: 'talk', who: 'chiroq', text: '1. 1. 0?' },
        { art: 'laugh', who: 'lola', text: "Demak, «ha». Mayli, qolganini birga o'rganamiz." },
        { art: 'window', text: "Derazadan qorong'i bozor darvozalari ko'rinadi. Chiroq antennasini cho'zadi: «…dar-vo-za.»" },
      ],
    },
    lines: {
      b1: "Buvining tungi chirog'i: tashqari yorug' (A = 1) bo'lsa o'chadi, qorong'i bo'lsa yonadi.",
      b2: 'Ustaxona eshigi ikki qulfli: ikkala kalit ham burilgandagina ochiladi.',
      b3: "Qo'ng'iroq old eshikdan ham, orqa eshikdan ham bosilsa jiringlaydi.",
      b4: "Buvining sandig'ida uchta qulf bor. Uchalasi ochilmasa, qopqoq qimirlamaydi.",
      b5: "Kavsharlagich yoqilgan (A = 1) va xavf datchigi jim (B = 0) bo'lsagina qiziydi.",
      b6: "Chiroq faqat ustaxona butunlay jim bo'lganda uyg'onadi: hech bir mashina ishlamasin.",
    },
  },
  xor: {
    place: 'Bozor darvozalari',
    intro: {
      title: 'Qulflangan bozor',
      frames: [
        { art: 'bazaar', text: "Lola va Chiroq bozorga yetib keladi. Oltita darvozaning hammasi qulf, rastalar bo'm-bo'sh." },
        { art: 'gatelock', who: 'chiroq', text: 'Dar-vo-za. 1? 0?' },
        { art: 'note', note: true, text: "Buvining daftaridan: «Har darvozaning o'z qoidasi bor. Qoidani tushunsang, kalit kerak emas.»" },
        { art: 'gatelock', who: 'lola', text: 'Demak, har bir qulf kichik sxema ekan. Bittalab ochamiz.' },
      ],
    },
    outro: {
      title: 'Bozor uyg\'ondi',
      frames: [
        { art: 'bazaarlit', text: 'Oltinchi darvoza g\'ichirlab ochiladi. Rastalarda birin-ketin fonarlar yonadi.' },
        { art: 'talk', who: 'chiroq', text: 'Yoki… faqat… ochiq!' },
        { art: 'laugh', who: 'lola', text: "Ko'rdingmi? Sen yangi so'zlar o'rganyapsan." },
        { art: 'tower', text: "Bozor o'rtasidagi Tarozi minorasi esa hamon qorong'i. Savdogarlar narxlarni hisoblay olmay, bahslashmoqda." },
      ],
    },
    lines: {
      x1: "Birinchi darvoza ikki qo'riqchi bilan: ikkalasi ham joyida (A = 1, B = 1) bo'lgandagina yopiladi, aks holda ochiq.",
      x2: "Ikki savdogarning kaliti bor. Darvoza faqat bittasi kalitini bursa ochiladi: ikkalasi birdan bursa, qulf tiqilib qoladi.",
      x3: "Ziravorlar darvozasida uchta richag bor. Ko'tarilgan richaglar soni toq bo'lsa, darvoza ochiladi.",
      x4: "Egizak qo'riqchilar darvozasi: ikkalasi bir xil javob bersa (ikkalasi «ha» yoki ikkalasi «yo'q»), darvoza ishonadi va ochiladi.",
      x5: "Bozor fonari: S kaliti kun va tunni almashtiradi. Kunduzi (S = 0) signal o'zgarmay o'tadi, tunda (S = 1) teskarisiga aylanadi.",
      x6: "Bosh darvozani oqsoqollar kengashi ochadi: uch oqsoqoldan kamida ikkitasi «ha» desa, darvoza ochiladi.",
    },
  },
  circuits: {
    place: 'Tarozi minorasi',
    intro: {
      title: "To'xtagan hisob",
      frames: [
        { art: 'tower', text: "Tarozi minorasining eshigi ochiq, lekin ichkarida hisob to'xtab qolgan. Savdogarlar narxlarni qo'sha olmay, bahslashmoqda." },
        { art: 'scales', who: 'lola', text: "Bu tarozi tanga tortmaydi — bitlarni qo'shadi! Faqat ichidagi simlari uzilgan." },
        { art: 'note', note: true, text: "«Ikki bitni qo'shishni bilsang, mingtasini ham qo'sha olasan: bittasi joyida qoladi, bittasi keyingi xonaga o'tadi. M.»" },
        { art: 'scales', who: 'chiroq', text: "Qo'sh? Qo'sh!" },
      ],
    },
    outro: {
      title: 'Minora hisoblayapti',
      frames: [
        { art: 'towerlit', text: "Minora tepasidagi tarozi yana chayqaladi. Pastda savdogarlar narxlarni bir ovozdan e'lon qiladi." },
        { art: 'talk', who: 'chiroq', text: "Qo'sh. Tanla. Qo'sh!" },
        { art: 'laugh', who: 'lola', text: 'Sen endi haqiqiy hisobchisan, Chiroq.' },
        { art: 'vault', text: "Minora daftarida g'alati yozuv: «Shahar nasoslari — Kumush omborda. U yerda faqat NAND qoldi.»" },
      ],
    },
    lines: {
      c1: "Minoraning birinchi hisob katagi ikki bitni qo'shadi: S — shu xonadagi raqam, C — keyingi xonaga o'tadigan bir.",
      c2: "Minoradan bozorga xabar yuboriladi: S qaysi rasta (Y0 yoki Y1) D xabarini olishini tanlaydi, ikkinchisi jim turadi.",
      c3: "Hakam ikki savdogardan birining narxini e'lon qiladi: S = 0 bo'lsa A ning, S = 1 bo'lsa B ning.",
      c4: "Minorada to'rtta qo'ng'iroq bor. Ikki bitli raqam (AB) qaysi biri chalinishini aytadi.",
      c5: "Tarozi pallalari: A og'irroq bo'lsa G, teng bo'lsa E, B og'irroq bo'lsa L yonadi.",
      c6: "Endi uchta bit: ikki savdogarning tangasi va oldingi xonadan o'tgan bir (Ci). Tarozi hammasini qo'shsin.",
    },
  },
  nand: {
    place: 'Kumush ombor',
    intro: {
      title: 'Bir xil quymalar',
      frames: [
        { art: 'vault', text: "Kumush ombor. Javonlarda minglab bir xil quyma: har biriga NAND deb o'yilgan, boshqa hech narsa yo'q." },
        { art: 'talk', who: 'lola', text: "NOT ham, AND ham, OR ham yo'q. Shahar nasoslarini shu quymalarning o'zidan yig'amizmi?" },
        { art: 'note', note: true, text: "«NAND — eng kamtar g'isht, lekin undan istalgan devorni ursa bo'ladi. Ishonmasang, sinab ko'r. M.»" },
        { art: 'vault', who: 'chiroq', text: 'Hammasi… bittadan?' },
      ],
    },
    outro: {
      title: 'Suv qaytdi',
      frames: [
        { art: 'fountain', text: 'Shahar hovuzlarida suv yana jildiraydi. Har bir nasos bir xil kumush quymalardan yig\'ilgan.' },
        { art: 'talk', who: 'chiroq', text: 'Hammasi bittadan!' },
        { art: 'laugh', who: 'lola', text: "To'g'ri: bitta NAND'dan butun shahar." },
        { art: 'city', text: "Tepalikdagi rasadxona esa hamon qorong'i. Uning zinasiga ko'p raqamli qulf osilgan." },
      ],
    },
    lines: {
      n1: "Birinchi nasos klapani teskari ishlaydi: signal kelsa yopiladi. Bitta NAND quymasidan inkor yasang.",
      n2: "Suv ikkala quvur ham ochiq bo'lgandagina oqsin. Omborda esa faqat NAND bor.",
      n3: "Ikki quduqdan hech bo'lmasa bittasida suv bo'lsa, nasos ishlasin — yana faqat NAND bilan.",
      n4: "Ehtiyot nasos faqat ikkala asosiy quvur ham quruq bo'lganda yoqiladi.",
      n5: "Ikki mahalla navbat bilan suv oladi: faqat bittasi so'rasa, klapan ochiladi.",
      n6: "Bosh klapan qaysi quduqdan suv olishni tanlaydi: S = 0 bo'lsa A dan, S = 1 bo'lsa B dan.",
    },
  },
  chips: {
    place: "Buvining sandig'i",
    intro: {
      title: 'Qora qutichalar',
      frames: [
        { art: 'chest', text: "Chiroq ustaxona burchagidagi eski sandiqni ochdi. Ichida — oyoqchali qora qutichalar, har biri qog'ozga o'ralgan." },
        { art: 'chip', text: "Qutichaga ikki harf o'yilgan: FA — «to'liq summator». Uchta oyog'i kiradi, ikkitasi chiqadi." },
        { art: 'note', note: true, text: "«Tushunib yig'ganing endi senga g'isht. Ichini qayta terma — oyoqlarini bil, kifoya. Ustozning yuragi shunday g'ishtlardan qurilgan. M.»" },
        { art: 'talk', who: 'lola', text: "Demak, summatorni qaytadan yig'mayman — qutichani qo'yaman, xolos. Qani, sinab ko'ramiz!" },
      ],
    },
    outro: {
      title: 'Hisob xonasi',
      frames: [
        { art: 'plan', text: "Sandiq tubida buvining chizmasi: Ustozning hisob xonasi. Unda o'nlab bo'sh uya, har birining shakli qutichalarnikiday." },
        { art: 'talk', who: 'lola', text: "Uyalar orasidagi simlarni qara — to'rttadan, yonma-yon ketyapti. Nega bittadan emas?" },
        { art: 'talk', who: 'chiroq', text: '…shi-na.' },
        { art: 'bus', text: "To'rt sim — bitta yo'l: to'rt bit bir vaqtda yuradi. Ustozning hisoblagichiga shu yo'l olib boradi." },
      ],
    },
    lines: {
      k1: "Birinchi qutichani sinash: Chiroq uchta kalitdan nechtasi burilganini bilmoqchi.",
      k2: "Ikki qutichani zanjir qilib ulang: o'tkazma bir qutichadan ikkinchisiga o'tadi.",
      k3: "Sandiq ustida to'rtta chiroq, derazada esa bitta tirqish. Ikki kalit qaysi chiroq nuri tirqishdan o'tishini tanlaydi.",
      k4: "Buvining chizmasidagi hisoblagich uch bitli: uchta summator — bitta zanjir.",
      k5: "Ustaxona javonining sakkiz tortmasi bor: uch bitli raqam qaysi biri ochilishini aytadi.",
      k6: "Lola, Chiroq va ikki qo'shni ovoz berdi. Nechta «ha» borligini qutichalar sanab bersin.",
    },
  },
  buses: {
    place: 'Hisob xonasi',
    intro: {
      title: 'Uzilgan yo\'llar',
      frames: [
        { art: 'plan', text: "Lola buvining chizmasi bo'yicha Ustozning hisob xonasini topdi. Uyalar joyida, ammo ularni bog'lovchi shinalar uzilgan." },
        { art: 'bus', who: 'chiroq', text: 'Shi-na. To\'rt… birga!' },
        { art: 'note', note: true, text: "«Bitta sim — bitta «ha» yoki «yo'q». To'rt sim yonma-yon — 0 dan 15 gacha istalgan son. M.»" },
        { art: 'counter', who: 'lola', text: "Mana Ustozning hisoblagichi. Raqamlari o'chiq: unga hali birorta son yetib kelmayapti." },
      ],
    },
    outro: {
      title: 'Hisoblagich yurdi',
      frames: [
        { art: 'counterlit', text: 'Hisoblagich raqamlari yonadi: 0, 1, 2… Ustozning ichida birinchi marta son yuradi.' },
        { art: 'talk', who: 'chiroq', text: 'Bir. Ikki. Uch. To\'rt… birga!' },
        { art: 'talk', who: 'lola', text: "Qo'shish bor, sanash bor. Ayirish-chi? Solishtirish-chi? Buni kim qiladi?" },
        { art: 'heart', text: "Xona o'rtasida eng katta uya bo'm-bo'sh. Buvining chizmasida uning ustiga bitta so'z yozilgan: «Yurak»." },
      ],
    },
    lines: {
      w1: "Ustoz eski ko'zgu-shinadan foydalangan: undan o'tgan har bir bit teskarisiga aylanadi. Shunday shinani yig'ing.",
      w2: "Hisoblagich bo'sh turganini bilishi kerak: shinadagi to'rt bitning hammasi 0 bo'lsa, Z chirog'i yonsin.",
      w3: "Ikki shina — ikki son. Ularni qo'shib, hisoblagichga bitta son yuboring.",
      w4: "Hisob xonasiga ikki yo'l kiradi. S kaliti qaysi shina hisoblagichga ulanishini tanlaydi.",
      w5: "Hisoblagichning birinchi qadami: songa bir qo'shish. 15 dan keyin raqamlar 0 ga qaytadi, C buni xabar qiladi.",
      w6: "Endi hisoblagich soatday yursin: S = 1 bo'lsa bir qadam oldinga, S = 0 bo'lsa joyida turadi.",
    },
  },
  alu: {
    place: 'Ustozning yuragi',
    intro: {
      title: 'Yurak',
      frames: [
        { art: 'heart', text: "Ustozning yuragi — arifmetik-mantiqiy qurilma. Ikki shina kiradi, bittasi chiqadi, yonida ikki kalitli amal tanlagich." },
        { art: 'note', note: true, text: "«Yurak faqat qo'shmaydi: ayiradi, solishtiradi, tanlaydi. Lekin hammasi bitta summatordan boshlanadi. M.»" },
        { art: 'talk', who: 'lola', text: "Ayirishni qanday qilamiz? Bizda faqat qo'shuvchi bor-ku." },
        { art: 'talk', who: 'chiroq', text: 'Teskari… va bir!' },
      ],
    },
    outro: {
      title: 'Yurak urdi',
      frames: [
        { art: 'heartlit', text: 'Yurak uradi. Shinalar bo\'ylab sonlar yuguradi: qo\'shiladi, ayiriladi, solishtiriladi.' },
        { art: 'talk', who: 'chiroq', text: 'His-ob-la. Hisobla! Lola, men hisoblayapman!' },
        { art: 'laugh', who: 'lola', text: 'Biz hisoblayapmiz. Buvi aynan shuni xohlagan edi.' },
        { art: 'citylit', text: "Ko'hna Minor derazalarida birin-ketin chiroqlar yonadi. Ammo Ustoz hali gapirmaydi: unga xotira va buyruqlar kerak." },
      ],
    },
    lines: {
      l1: "Chiroqning maslahati: sonning bitlarini teskarisiga aylantirib, bir qo'shsang, uning manfiysi chiqadi. Sinab ko'ring.",
      l2: "Savdogar qarzini hisoblaydi: A dan B ni ayiring. C = 1 bo'lsa, qarz qolmagan (A ≥ B).",
      l3: "Yurakning birinchi kaliti: S = 0 da qo'shadi, S = 1 da ayiradi. Bitta summator ikkala ishni qiladi.",
      l4: "Yurakning mantiqiy yarmi: F1 F0 kodi AND, OR, XOR yoki NOT ni tanlaydi, to'rtta bitda birdan.",
      l5: "Tarozi minorasining katta ukasi: to'rt bitli ikki sonni solishtiring — kichikmi, tengmi yoki kattami.",
      l6: "Hammasini bitta yurakka yig'ing: F1 F0 amalni tanlaydi, Z natija nol ekanini aytadi. Ustoz shu bilan hisoblaydi.",
    },
  },
};

const ru: Record<string, ChapterStory> = {
  basics: {
    place: 'Мастерская бабушки',
    intro: {
      title: 'Безмолвие',
      frames: [
        { art: 'city', text: 'Третья ночь Безмолвия. Над Кохна-Минором не горит ни одного огня.' },
        { art: 'workshop', text: 'Лола входит в мастерскую бабушки. На столе — пыльный медный шар и сложенный листок.' },
        { art: 'note', note: true, text: '«Лола, если ты это читаешь, меня уже нет рядом. Запусти Устоза снова. Не волшебством — пониманием. М.»' },
        { art: 'orb', who: 'lola', text: 'Внутри шара — крошечные переключатели и оборванные провода. А если соединить их правильно?' },
      ],
    },
    outro: {
      title: 'Огонёк проснулся',
      frames: [
        { art: 'wake', who: 'chiroq', text: '…1.' },
        { art: 'talk', who: 'lola', text: 'Привет! Ты умеешь говорить?' },
        { art: 'talk', who: 'chiroq', text: '1. 1. 0?' },
        { art: 'laugh', who: 'lola', text: 'Значит, «да». Ладно, остальному научимся вместе.' },
        { art: 'window', text: 'За окном — тёмные ворота базара. Огонёк вытягивает антенну: «…во-ро-та.»' },
      ],
    },
    lines: {
      b1: 'Бабушкин ночник: снаружи светло (A = 1) — гаснет, темно — горит.',
      b2: 'У двери мастерской два замка: она откроется, только если повернуть оба ключа.',
      b3: 'Звонок звенит, если нажать кнопку у парадной двери или у задней.',
      b4: 'На бабушкином сундуке три замка. Пока не открыты все три, крышка не сдвинется.',
      b5: 'Паяльник греется, только если он включён (A = 1) и датчик опасности молчит (B = 0).',
      b6: 'Огонёк проснётся, только когда в мастерской станет совсем тихо: ни одна машина не должна работать.',
    },
  },
  xor: {
    place: 'Ворота базара',
    intro: {
      title: 'Запертый базар',
      frames: [
        { art: 'bazaar', text: 'Лола и Огонёк приходят на базар. Все шесть ворот заперты, ряды пусты.' },
        { art: 'gatelock', who: 'chiroq', text: 'Во-ро-та. 1? 0?' },
        { art: 'note', note: true, text: 'Из бабушкиной тетради: «У каждых ворот своё правило. Поймёшь правило — ключ не нужен.»' },
        { art: 'gatelock', who: 'lola', text: 'Значит, каждый замок — маленькая схема. Откроем по одному.' },
      ],
    },
    outro: {
      title: 'Базар проснулся',
      frames: [
        { art: 'bazaarlit', text: 'Шестые ворота со скрипом открываются. В рядах один за другим загораются фонари.' },
        { art: 'talk', who: 'chiroq', text: 'Или… только… открыто!' },
        { art: 'laugh', who: 'lola', text: 'Видишь? Ты учишь новые слова.' },
        { art: 'tower', text: 'А Башня весов посреди базара всё ещё темна. Торговцы не могут посчитать цены и спорят.' },
      ],
    },
    lines: {
      x1: 'У первых ворот два стражника: ворота закрыты, только когда оба на месте (A = 1, B = 1), иначе открыты.',
      x2: 'У двух торговцев по ключу. Ворота откроются, только если повернуть один ключ: если оба сразу — замок заклинит.',
      x3: 'У ворот пряностей три рычага. Если поднято нечётное число рычагов, ворота открываются.',
      x4: 'Ворота стражников-близнецов: если оба ответят одинаково (оба «да» или оба «нет»), ворота поверят и откроются.',
      x5: 'Фонарь базара: ключ S переключает день и ночь. Днём (S = 0) сигнал проходит без изменений, ночью (S = 1) — наоборот.',
      x6: 'Главные ворота открывает совет старейшин: если хотя бы двое из трёх скажут «да», ворота откроются.',
    },
  },
  circuits: {
    place: 'Башня весов',
    intro: {
      title: 'Остановленный счёт',
      frames: [
        { art: 'tower', text: 'Дверь Башни весов открыта, но счёт внутри остановился. Торговцы не могут сложить цены и спорят.' },
        { art: 'scales', who: 'lola', text: 'Эти весы взвешивают не монеты — они складывают биты! Только провода внутри оборваны.' },
        { art: 'note', note: true, text: '«Умеешь сложить два бита — сложишь и тысячу: один остаётся на месте, другой переходит в следующий разряд. М.»' },
        { art: 'scales', who: 'chiroq', text: 'Сложи? Сложи!' },
      ],
    },
    outro: {
      title: 'Башня считает',
      frames: [
        { art: 'towerlit', text: 'Весы на вершине башни снова качаются. Внизу торговцы в один голос объявляют цены.' },
        { art: 'talk', who: 'chiroq', text: 'Сложи. Выбери. Сложи!' },
        { art: 'laugh', who: 'lola', text: 'Теперь ты настоящий счетовод, Огонёк.' },
        { art: 'vault', text: 'В книге башни странная запись: «Городские насосы — на Серебряном складе. Там остались только NAND.»' },
      ],
    },
    lines: {
      c1: 'Первая счётная ячейка башни складывает два бита: S — цифра этого разряда, C — единица, которая переходит в следующий.',
      c2: 'Башня шлёт весть на базар: S выбирает, какой ряд (Y0 или Y1) получит весть D, второй молчит.',
      c3: 'Судья объявляет цену одного из двух торговцев: при S = 0 — цену A, при S = 1 — цену B.',
      c4: 'В башне четыре колокола. Двухбитное число (AB) говорит, какой из них зазвонит.',
      c5: 'Чаши весов: если тяжелее A — загорается G, если поровну — E, если тяжелее B — L.',
      c6: 'Теперь три бита: монеты двух торговцев и единица из прошлого разряда (Ci). Пусть весы сложат всё.',
    },
  },
  nand: {
    place: 'Серебряный склад',
    intro: {
      title: 'Одинаковые слитки',
      frames: [
        { art: 'vault', text: 'Серебряный склад. На полках тысячи одинаковых слитков: на каждом выбито NAND, и больше ничего.' },
        { art: 'talk', who: 'lola', text: 'Ни NOT, ни AND, ни OR. Мы соберём городские насосы из одних этих слитков?' },
        { art: 'note', note: true, text: '«NAND — самый скромный кирпич, но из него можно сложить любую стену. Не веришь — попробуй. М.»' },
        { art: 'vault', who: 'chiroq', text: 'Всё… из одного?' },
      ],
    },
    outro: {
      title: 'Вода вернулась',
      frames: [
        { art: 'fountain', text: 'В городских прудах снова журчит вода. Каждый насос собран из одинаковых серебряных слитков.' },
        { art: 'talk', who: 'chiroq', text: 'Всё из одного!' },
        { art: 'laugh', who: 'lola', text: 'Верно: из одного NAND — целый город.' },
        { art: 'city', text: 'А обсерватория на холме всё ещё темна. На её лестнице висит замок с многозначным кодом.' },
      ],
    },
    lines: {
      n1: 'Клапан первого насоса работает наоборот: пришёл сигнал — закрывается. Сделайте отрицание из одного слитка NAND.',
      n2: 'Пусть вода течёт, только когда открыты обе трубы. А на складе есть только NAND.',
      n3: 'Если хотя бы в одном из двух колодцев есть вода, насос должен работать — снова только из NAND.',
      n4: 'Запасной насос включается, только когда обе главные трубы сухие.',
      n5: 'Два квартала берут воду по очереди: клапан открывается, только если просит один из них.',
      n6: 'Главный клапан выбирает колодец: при S = 0 — воду из A, при S = 1 — из B.',
    },
  },
  chips: {
    place: 'Бабушкин сундук',
    intro: {
      title: 'Чёрные коробочки',
      frames: [
        { art: 'chest', text: 'Огонёк открыл старый сундук в углу мастерской. Внутри — чёрные коробочки на ножках, каждая завёрнута в бумагу.' },
        { art: 'chip', text: 'На коробочке вырезаны две буквы: FA — «полный сумматор». Три ножки входят, две выходят.' },
        { art: 'note', note: true, text: '«То, что ты собрала с пониманием, теперь твой кирпичик. Не перебирай его заново — знай его ножки, этого довольно. Сердце Устоза сложено из таких кирпичиков. М.»' },
        { art: 'talk', who: 'lola', text: 'Значит, сумматор не надо собирать заново — просто ставлю коробочку. Ну-ка, попробуем!' },
      ],
    },
    outro: {
      title: 'Счётная палата',
      frames: [
        { art: 'plan', text: 'На дне сундука — бабушкин чертёж: счётная палата Устоза. В ней десятки пустых гнёзд, и каждое по форме как коробочка.' },
        { art: 'talk', who: 'lola', text: 'Смотри на провода между гнёздами — идут по четыре, рядом. Почему не по одному?' },
        { art: 'talk', who: 'chiroq', text: '…ши-на.' },
        { art: 'bus', text: 'Четыре провода — одна дорога: четыре бита идут разом. Эта дорога ведёт к счётчику Устоза.' },
      ],
    },
    lines: {
      k1: 'Испытание первой коробочки: Огонёк хочет знать, сколько из трёх ключей повёрнуто.',
      k2: 'Соедините две коробочки цепочкой: перенос переходит из одной в другую.',
      k3: 'На сундуке четыре фонарика, а в окне одна щель. Два ключа выбирают, чей свет пройдёт сквозь щель.',
      k4: 'Счётчик на бабушкином чертеже трёхбитный: три сумматора — одна цепочка.',
      k5: 'У полки в мастерской восемь ящиков: трёхбитное число говорит, какой из них открыть.',
      k6: 'Лола, Огонёк и двое соседей проголосовали. Пусть коробочки посчитают, сколько «да».',
    },
  },
  buses: {
    place: 'Счётная палата',
    intro: {
      title: 'Оборванные дороги',
      frames: [
        { art: 'plan', text: 'По бабушкиному чертежу Лола нашла счётную палату Устоза. Гнёзда на месте, но шины между ними оборваны.' },
        { art: 'bus', who: 'chiroq', text: 'Ши-на. Четыре… вместе!' },
        { art: 'note', note: true, text: '«Один провод — одно «да» или «нет». Четыре провода рядом — любое число от 0 до 15. М.»' },
        { art: 'counter', who: 'lola', text: 'Вот счётчик Устоза. Цифры погасли: до него пока не доходит ни одно число.' },
      ],
    },
    outro: {
      title: 'Счётчик пошёл',
      frames: [
        { art: 'counterlit', text: 'Цифры счётчика загораются: 0, 1, 2… Впервые внутри Устоза идёт число.' },
        { art: 'talk', who: 'chiroq', text: 'Раз. Два. Три. Четыре… вместе!' },
        { art: 'talk', who: 'lola', text: 'Сложение есть, счёт есть. А вычитание? А сравнение? Кто это будет делать?' },
        { art: 'heart', text: 'Посреди палаты пустует самое большое гнездо. На бабушкином чертеже над ним одно слово: «Сердце».' },
      ],
    },
    lines: {
      w1: 'Устоз пользовался старой шиной-зеркалом: каждый бит, проходя по ней, переворачивается. Соберите такую шину.',
      w2: 'Счётчик должен знать, что он пуст: если все четыре бита шины равны 0, пусть загорится Z.',
      w3: 'Две шины — два числа. Сложите их и отправьте в счётчик одно число.',
      w4: 'В счётную палату ведут две дороги. Ключ S выбирает, какая шина подключится к счётчику.',
      w5: 'Первый шаг счётчика — прибавить единицу. После 15 цифры возвращаются к 0, и C сообщает об этом.',
      w6: 'Теперь счётчик должен идти как часы: при S = 1 — шаг вперёд, при S = 0 — стоит на месте.',
    },
  },
  alu: {
    place: 'Сердце Устоза',
    intro: {
      title: 'Сердце',
      frames: [
        { art: 'heart', text: 'Сердце Устоза — арифметико-логическое устройство. Входят две шины, выходит одна, сбоку — переключатель операций на два ключа.' },
        { art: 'note', note: true, text: '«Сердце не только складывает: оно вычитает, сравнивает, выбирает. Но всё начинается с одного сумматора. М.»' },
        { art: 'talk', who: 'lola', text: 'Как же вычитать? У нас ведь есть только сумматор.' },
        { art: 'talk', who: 'chiroq', text: 'Наоборот… и один!' },
      ],
    },
    outro: {
      title: 'Сердце забилось',
      frames: [
        { art: 'heartlit', text: 'Сердце бьётся. По шинам бегут числа: складываются, вычитаются, сравниваются.' },
        { art: 'talk', who: 'chiroq', text: 'Счи-тай. Считай! Лола, я считаю!' },
        { art: 'laugh', who: 'lola', text: 'Мы считаем. Именно этого и хотела бабушка.' },
        { art: 'citylit', text: 'В окнах Кохна-Минора один за другим загораются огни. Но Устоз ещё молчит: ему нужны память и команды.' },
      ],
    },
    lines: {
      l1: 'Совет Огонька: переверни все биты числа и прибавь единицу — получится его минус. Проверьте.',
      l2: 'Торговец считает долг: вычтите B из A. Если C = 1, долга не осталось (A ≥ B).',
      l3: 'Первый ключ сердца: при S = 0 складывает, при S = 1 вычитает. Один сумматор делает обе работы.',
      l4: 'Логическая половина сердца: код F1 F0 выбирает AND, OR, XOR или NOT — сразу для всех четырёх битов.',
      l5: 'Старший брат Башни весов: сравните два четырёхбитных числа — меньше, равно или больше.',
      l6: 'Соберите всё в одно сердце: F1 F0 выбирает операцию, Z говорит, что результат — ноль. Так Устоз и считает.',
    },
  },
};

export const STORIES = { uz, ru };

/** Bo'lim hikoyasi joriy tilda (tarjima bo'lmasa — o'zbekcha); hikoyasiz bo'lim — undefined. */
export function storyFor(chapter: string): ChapterStory | undefined {
  return (STORIES[lang.value as 'uz' | 'ru'] ?? uz)[chapter] ?? uz[chapter];
}
