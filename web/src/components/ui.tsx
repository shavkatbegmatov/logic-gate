import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { nativeBack, registerBack } from '../telegram';

export function Stars({ n, max = 3, size = 'md' }: { n: number; max?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span class={`stars stars-${size}`} aria-label={`${n} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} class={i < n ? 'star on' : 'star'} style={{ animationDelay: `${i * 0.18}s` }}>
          ★
        </span>
      ))}
    </span>
  );
}

let modalSeq = 0;
/** Ochiq oynalar, eng ustidagisi oxirida: Esc va Tab faqat o'shanga tegishli. */
const openModals: number[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Oyna: ochilganda fokus ichiga o'tadi (autoFocus tugmasiga yoki oynaning o'ziga), Tab oyna ichida
 * aylanadi, yopilganda fokus oldingi joyiga qaytadi. Birinchi sarlavha — oynaning nomi (ekran o'quvchi).
 * Oyna ustida ikkinchisi ochilsa (natija oynasidan «nusxalab bo'lmadi» oynasi), klaviatura faqat
 * ustidagisida ishlaydi — aks holda Esc ikkalasini yopardi, Tab esa fokusni pastdagiga tortardi.
 */
export function Modal({ children, onClose, class: cls }: { children: ComponentChildren; onClose?: () => void; class?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current!;
    const id = ++modalSeq;
    openModals.push(id);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const title = el.querySelector('h1, h2, h3');
    if (title) {
      title.id ||= `modal-title-${id}`;
      el.setAttribute('aria-labelledby', title.id);
    }
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[autofocus]') ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== id) return;
      if (e.key === 'Escape') {
        close.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      openModals.splice(openModals.indexOf(id), 1);
      // Oyna ochilishidan oldingi joy (masalan, «Tekshirish» tugmasi) hali sahifada bo'lsa — fokus o'shanga.
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class={cls ? `modal ${cls}` : 'modal'} role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, sub, onBack, children }: {
  title: string;
  sub?: string;
  onBack?: () => void;
  children?: ComponentChildren;
}) {
  // Telegram ichida sarlavhadagi orqaga tugmasi shu amalni bajaradi.
  const back = useRef(onBack);
  back.current = onBack;
  const hasBack = !!onBack;
  useEffect(() => (hasBack ? registerBack(() => back.current?.()) : undefined), [hasBack]);
  return (
    <header class="topbar">
      {onBack && !nativeBack.value && (
        <button class="icon-btn" onClick={onBack} aria-label={t.back} title={t.back}>
          <Icon name="back" />
        </button>
      )}
      <div class="topbar-title">
        {sub && <div class="topbar-sub">{sub}</div>}
        <h1>{title}</h1>
      </div>
      <div class="topbar-actions">{children}</div>
    </header>
  );
}

const ICONS = {
  back: 'M15 5 8 12l7 7',
  chevron: 'M9 5l7 7-7 7',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  printer: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  sound: 'M4 9v6h4l5 4V5L8 9H4ZM16 9a4 4 0 0 1 0 6',
  mute: 'M4 9v6h4l5 4V5L8 9H4ZM17 9l4 6M21 9l-4 6',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  share: 'M4 13v7h16v-7M12 3v12M7 8l5-5 5 5',
  telegram: 'M21 4 3 11.5l6 2.2L18 7l-7 8 .3 5 3.2-3.6 4.5 3.6z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3v3H8z',
  // Takt signali (to'rtburchak to'lqin) va vaqtni boshiga qaytarish.
  clock: 'M3 17h4V7h5v10h5V7h4',
  reset: 'M4 4v6h6M4.6 15A8 8 0 1 0 6 6.3L4 10',
  // Emoji o'rniga: elementlar bilan bir xil chiziq, yumaloq uchlar.
  book: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5ZM12 6.5V19',
  archive: 'M4 8h16v12H4zM6 5h12M8 2h8M9 12h6',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 15v2',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  bellOff: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4M4 3l17 17',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-2 4-2 6-1-1-2-2-2-4-2 2-4 5-4 8a6 6 0 0 0 6 6ZM12 21a2.5 2.5 0 0 1-2.5-2.5c0-2 2.5-3.5 2.5-3.5s2.5 1.5 2.5 3.5A2.5 2.5 0 0 1 12 21Z',
  power: 'M12 3v8M7.5 6.5a7 7 0 1 0 9 0',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z',
  crown: 'M4 18h16M5 15 4 7l5 4 3-6 3 6 5-4-1 8Z',
  gem: 'M7 4h10l4 5-9 11L3 9ZM3 9h18M10 4 8 9l4 11 4-11-2-5',
  nand: 'M2 9h3M2 15h3M5 5h6a7 7 0 0 1 0 14H5ZM18 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 12h.01',
  pencil: 'M4 20l1-4L16 5l3 3L8 19ZM14 7l3 3',
  formula: 'M13 4c-2.5 0-3.5 1.2-4 3.5L6.5 20M5 10h7M14 12l6 7M20 12l-6 7',
  tidy: 'M3 5h5v4H3zM3 15h5v4H3zM14 10h5v4h-5zM8 7h2.5v10H8M10.5 12H14M19 12h2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.5-3.5 3.3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .7 3.2 2.5 3.5 5.2',
  medal: 'M8 3l3 6M16 3l-3 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 13v4',
  play: 'M8 5.5v13l10-6.5Z',
  levels: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5a2 2 0 1 0 0 4 2 2 0 1 0 0-4M9 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4',
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9ZM4 7.5 12 12l8-4.5M12 12v9',
  layers: 'M12 4 3 9l9 5 9-5ZM3 14l9 5 9-5',
  schematic: 'M3 9h4M3 15h4M7 6h5a6 6 0 0 1 0 12H7ZM18 12h3',
  orbit: 'M12 12a2 2 0 1 0 0 .01M4.5 14.5c2 2.5 13 2.5 15 0 .9-1.1.3-2.5-1.5-3.4M6 10.6c-1.8.9-2.4 2.3-1.5 3.4M12 3v3M9.5 5.5 12 3l2.5 2.5',
  palette: 'M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1-2-2v-.5a2 2 0 0 1 2-2h4.5a4.5 4.5 0 0 0 4.5-4.5C21 5.8 17 3 12 3ZM7.5 10.5h.01M10.5 7.5h.01M15.5 7.5h.01',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M15.5 8.5l-2.2 5.2-5.3 2.3 2.2-5.2Z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
