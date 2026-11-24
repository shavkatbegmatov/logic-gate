import { useEffect } from 'preact/hooks';
import { t } from '../i18n';
import { avatarColor, currentRank, initials, refreshMyRank, shortId } from '../player';
import { go } from '../router';
import { profile, totalStars } from '../state';
import { Icon } from './ui';

/** O'yinchi avatari: taxallusning bosh harflari, rangi id'dan. id bo'lmasa — mehmon belgisi. */
export function Avatar({ id, name, size = 'md' }: { id?: string; name?: string; size?: 'md' | 'lg' }) {
  return (
    <span class={`avatar ${size}`} style={id ? { '--avatar-bg': avatarColor(id) } : undefined} aria-hidden="true">
      {id && name ? initials(name) : <Icon name="user" />}
    </span>
  );
}

/**
 * Bosh sahifa sarlavhasida — kim o'ynayapti: avatar, taxallus, qisqa ID va reytingdagi o'rin. Bir xil ismli
 * profillar (har qurilmada yangi ochilgan) shu ID va rang bilan farqlanadi. Bosilsa — profil (Sozlamalar).
 * Profil yo'q bo'lsa — «Mehmon»: natijalar faqat shu qurilmada, profil ochish yoki kod bilan kirish Sozlamalarda.
 */
export function PlayerChip() {
  const p = profile.value;
  const stars = totalStars.value;
  useEffect(() => {
    void refreshMyRank();
  }, [p?.id, stars]);

  if (!p) {
    return (
      <button class="player-chip guest" onClick={() => go('settings')} aria-label={t.player.guestLabel} title={t.player.guestLabel}>
        <Avatar />
        <span class="player-chip-text">
          <strong>{t.player.guest}</strong>
          <span class="player-chip-sub accent">{t.player.signIn}</span>
        </span>
      </button>
    );
  }

  const rank = currentRank();
  const id = shortId(p.id);
  const label = t.player.label(p.nickname, id, rank ?? null);
  return (
    <button class="player-chip" onClick={() => go('settings')} aria-label={label} title={label}>
      <Avatar id={p.id} name={p.nickname} />
      <span class="player-chip-text">
        <strong>{p.nickname}</strong>
        <span class="player-chip-sub">
          <span class="player-id">ID {id}</span>
          {rank != null && (
            <span class="player-rank">
              <Icon name="trophy" />
              {rank}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
