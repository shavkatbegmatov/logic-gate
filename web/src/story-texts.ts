// Kampaniya hikoyasi matnlari (uz/ru): bo'lim sahnalari va darajalar ustidagi hikoya qatorlari.
// Alohida modul: bo'limlar ro'yxati yoki daraja ochilganda yuklanadi (bosh bundle'da yo'q).
// Holat — qaysi sahna ko'rilgan, hikoya yoqilganmi — story.ts da. Dunyo va uslub: DECISIONS.md («Kampaniya hikoyasi», 2.27.0).
import { lang } from './i18n';

/** Kadr rasmi: StoryScene.tsx dagi SVG sahnalardan biri. */
export type Art = 'city' | 'workshop' | 'note' | 'orb' | 'wake' | 'talk' | 'laugh' | 'window';

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
};

export const STORIES = { uz, ru };

/** Bo'lim hikoyasi joriy tilda (tarjima bo'lmasa — o'zbekcha); hikoyasiz bo'lim — undefined. */
export function storyFor(chapter: string): ChapterStory | undefined {
  return (STORIES[lang.value as 'uz' | 'ru'] ?? uz)[chapter] ?? uz[chapter];
}
