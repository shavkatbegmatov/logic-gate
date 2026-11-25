// levels/levels.json ni brauzer uchun ikki bo'lakka ajratadi (vite.config.ts → levelData()). Server va
// testlar to'liq faylni o'qiydi.
//  - meta — bosh yuklamada: bo'limlar, daraja nomlari, oyoqlari va elementlari (xarita, bosh sahifa);
//  - detail — alohida bo'lakda: jadvallar, avtomatlar, vazifa matni va maslahatlar (src/levels.ts).
// Avval hammasi bosh yuklamada edi: 66 daraja bilan ~16 KB (gzip), shundan ~12 KB faqat daraja ochilganda kerak.

/** Daraja maydonlaridan bosh yuklamadan chiqariladiganlari: faqat ish stolida (Workbench) kerak. */
export const DETAIL = ['task', 'hint', 'hints', 'target', 'seq'];

/**
 * @param {{ chapters: object[], levels: Record<string, any>[] }} data levels.json
 * @returns {{ meta: { chapters: object[], levels: object[] }, detail: Record<string, object> }}
 */
export function splitLevels(data) {
  const detail = {};
  const levels = data.levels.map((level) => {
    const meta = {};
    const more = {};
    for (const [key, value] of Object.entries(level)) {
      if (key !== 'i18n') (DETAIL.includes(key) ? more : meta)[key] = value;
    }
    // Tarjimalar ham shu tartibda: nom — bosh yuklamada, vazifa va maslahat — tafsilotlarda.
    for (const [lang, texts] of Object.entries(level.i18n ?? {})) {
      for (const [key, value] of Object.entries(texts)) {
        const part = DETAIL.includes(key) ? more : meta;
        ((part.i18n ??= {})[lang] ??= {})[key] = value;
      }
    }
    detail[level.id] = more;
    return meta;
  });
  return { meta: { chapters: data.chapters, levels }, detail };
}
