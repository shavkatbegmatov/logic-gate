// Matnni nusxalash. Clipboard API faqat xavfsiz kontekstda (HTTPS yoki localhost) bor,
// shuning uchun HTTP'da eski execCommand usuliga o'tiladi.

export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Ruxsat berilmagan — quyidagi usulni sinaymiz.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/** Nusxalab bo'lmasa — matnni belgilab qo'yish, foydalanuvchi o'zi nusxalaydi. */
export function selectContents(el: Element) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
