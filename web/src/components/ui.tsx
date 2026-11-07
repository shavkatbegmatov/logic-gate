import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n';

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

export function Modal({ children, onClose }: { children: ComponentChildren; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="modal" role="dialog" aria-modal="true">
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
  return (
    <header class="topbar">
      {onBack && (
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
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  sound: 'M4 9v6h4l5 4V5L8 9H4ZM16 9a4 4 0 0 1 0 6',
  mute: 'M4 9v6h4l5 4V5L8 9H4ZM17 9l4 6M21 9l-4 6',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  share: 'M4 13v7h16v-7M12 3v12M7 8l5-5 5 5',
  telegram: 'M21 4 3 11.5l6 2.2L18 7l-7 8 .3 5 3.2-3.6 4.5 3.6z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3v3H8z',
} as const;

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
