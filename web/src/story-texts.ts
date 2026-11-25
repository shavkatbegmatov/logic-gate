// Kampaniya hikoyasi matnlari (uz/ru): bo'lim sahnalari va darajalar ustidagi hikoya qatorlari.
// Alohida modul: bo'limlar ro'yxati yoki daraja ochilganda yuklanadi (bosh bundle'da yo'q).
// Holat — qaysi sahna ko'rilgan, hikoya yoqilganmi — story.ts da. Dunyo va uslub: DECISIONS.md («Kampaniya hikoyasi», 2.27.0).
import { lang } from './i18n';

/** Kadr rasmi: StoryScene.tsx dagi SVG sahnalardan biri. */
export type Art =
  | 'city'
  | 'workshop'
  | 'note'
  | 'orb'
  | 'wake'
  | 'talk'
  | 'laugh'
  | 'window'
  | 'bazaar'
  | 'gatelock'
  | 'bazaarlit'
  | 'tower';

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
};

export const STORIES = { uz, ru };

/** Bo'lim hikoyasi joriy tilda (tarjima bo'lmasa — o'zbekcha); hikoyasiz bo'lim — undefined. */
export function storyFor(chapter: string): ChapterStory | undefined {
  return (STORIES[lang.value as 'uz' | 'ru'] ?? uz)[chapter] ?? uz[chapter];
}
