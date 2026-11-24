import { useMemo } from 'preact/hooks';
import { qrEncode, qrPath, type QrLevel } from '../qr';

/**
 * QR kod SVG'da (chop etishda ham aniq). Atrofida standartdagi 4 modulli hoshiya — shaffof: kod yorug'
 * fonga (qog'oz, «Daftar» varag'i) qo'yiladi, modullar rangi — CSS `color`.
 */
export function QrCode({ text, label, level = 'M', class: cls = '' }: { text: string; label: string; level?: QrLevel; class?: string }) {
  const { d, n } = useMemo(() => {
    const q = qrEncode(text, level);
    return { d: qrPath(q.modules), n: q.modules.length };
  }, [text, level]);
  return (
    <svg class={`qr ${cls}`} viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label={label}>
      <path d={d} />
    </svg>
  );
}
