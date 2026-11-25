import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { api, type DeviceInfo } from '../api';
import { t } from '../i18n';
import { dateText } from '../player';
import { profile } from '../state';
import { errorText, logoutOthers } from '../sync';
import { askConfirm } from './Dialogs';
import { showToast } from './Toast';
import { Icon } from './ui';

/**
 * Sozlamalar → profil: Telegram orqali kirgan qurilmalar (har biri o'z kaliti bilan) va ularni chiqarish.
 * Tiklash kodi bilan kirgan qurilmalarni sanab bo'lmaydi (bitta umumiy kod) — ularni faqat «Boshqa
 * qurilmalardan chiqish» chiqaradi: kod yangisiga almashadi. Aloqa bo'lmasa, bo'lim ko'rinmaydi.
 */
export function Devices({ telegram }: { telegram: boolean }) {
  const id = profile.value?.id;
  const list = useSignal<{ devices: DeviceInfo[]; viaCode: boolean } | null>(null);
  const busy = useSignal(false);

  const load = () =>
    api
      .devices()
      .then((r) => profile.peek()?.id === id && (list.value = r))
      .catch(() => {});

  useEffect(() => {
    list.value = null;
    if (id) void load();
  }, [id]);

  const data = list.value;
  if (!id || !data) return null;

  const remove = async (d: DeviceInfo) => {
    const name = d.label || t.devices.unknown;
    const yes = await askConfirm({ title: t.devices.removeTitle, text: t.devices.removeConfirm(name), ok: t.devices.remove, danger: true, icon: 'trash' });
    if (!yes) return;
    try {
      await api.removeDevice(d.id);
      showToast(t.devices.removed, 'ok');
    } catch (e) {
      showToast(errorText(e), 'error');
    }
    await load();
  };

  const logoutAll = async () => {
    const yes = await askConfirm({
      title: t.devices.logoutOthers,
      text: t.devices.logoutConfirm,
      note: telegram ? t.devices.logoutTgNote : undefined,
      ok: t.devices.logoutOk,
      danger: true,
      icon: 'power',
    });
    if (!yes || busy.value) return;
    busy.value = true;
    try {
      await logoutOthers();
      await load();
    } catch (e) {
      showToast(errorText(e), 'error');
    } finally {
      busy.value = false;
    }
  };

  return (
    <>
      <h3>{t.devices.title}</h3>
      <p class="muted small">{t.devices.hint}</p>
      <ul class="device-list">
        {data.viaCode && (
          <li class="device current">
            <Icon name="user" />
            <span class="device-text">
              <b>{t.devices.viaCode}</b>
            </span>
          </li>
        )}
        {data.devices.map((d) => (
          <li key={d.id} class={`device${d.current ? ' current' : ''}`}>
            <Icon name={d.label.startsWith('Telegram') ? 'telegram' : 'chip'} />
            <span class="device-text">
              <b>
                {d.label || t.devices.unknown}
                {d.current && <span class="device-badge">{t.devices.current}</span>}
              </b>
              <span class="muted small">{t.devices.meta(dateText(d.createdAt), dateText(d.usedAt))}</span>
            </span>
            {!d.current && (
              <button class="icon-btn small" onClick={() => remove(d)} title={t.devices.remove} aria-label={`${t.devices.remove}: ${d.label || t.devices.unknown}`}>
                <Icon name="trash" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button class="btn danger small device-logout" disabled={busy.value} onClick={logoutAll}>
        <Icon name="power" /> {t.devices.logoutOthers}
      </button>
    </>
  );
}
