// Kam ochiladigan ekranlar (o'qituvchi, sertifikat, bo'lim xulosasi) alohida bo'lakda yuklanadi —
// bosh bundle kichik bo'ladi. Service worker barcha bo'laklarni oldindan keshlaydi, shuning uchun
// o'rnatilgandan keyin ular oflayn ham ochiladi.
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';

export function lazy<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const get = () => {
    pending ??= load().then(
      (c) => (Loaded = c),
      (e) => {
        pending = null; // Keyingi urinishda qayta yuklanadi.
        throw e;
      },
    );
    return pending;
  };

  return function Lazy(props: P) {
    const [, rerender] = useState(0);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      if (Loaded || failed) return;
      let alive = true;
      get().then(
        () => alive && rerender((n) => n + 1),
        () => alive && setFailed(true),
      );
      return () => {
        alive = false;
      };
    }, [failed]);

    if (Loaded) return <Loaded {...props} />;
    if (failed) {
      // Yangi versiya joylangandan keyin eski sahifa o'chirilgan bo'lakni so'rashi mumkin — sahifani yangilash yordam beradi.
      return (
        <div class="screen lazy-failed">
          <p class="muted">{t.loadFailed}</p>
          <button class="btn" onClick={() => (navigator.onLine ? location.reload() : setFailed(false))}>
            {t.retry}
          </button>
        </div>
      );
    }
    return (
      <div class="screen lazy-loading" aria-busy="true">
        <p class="muted">{t.loading}</p>
      </div>
    );
  };
}
