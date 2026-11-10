// Tilni almashtirish tugmalari uchun (bosh sahifa va Sozlamalar).
import { showToast } from './components/Toast';
import { loadLang, t, type Lang } from './i18n';
import { settings } from './state';

/** Oxirgi tanlov: sekin yuklangan lug'at keyinroq bosilgan tugmaning ustidan yozmasin. */
let chosen: Lang | undefined;

/**
 * O'yinchi tanlagan til. Lug'ati alohida bo'lakda (i18n.ts): avval u yuklanadi, keyin tanlov saqlanadi
 * va til almashadi (state.ts). Yuklanmasa (oflayn, keshda yo'q) — eski til qoladi va xabar chiqadi.
 */
export function switchLang(l: Lang): Promise<void> {
  chosen = l;
  return loadLang(l).then(
    () => {
      if (chosen === l && settings.value.lang !== l) settings.value = { ...settings.value, lang: l };
    },
    () => {
      if (chosen === l) showToast(t.langFailed, 'error');
    },
  );
}
