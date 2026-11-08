import { Icon, Stars, TopBar } from '../components/ui';
import { t } from '../i18n';
import { chapterDone, lessonsRead } from '../lessons';
import { chapterLevels, chapters, levelNumber } from '../levels';
import { go } from '../router';
import { chapterStars, chapterUnlocked, levelUnlocked, progress, totalStars } from '../state';

export function LevelsScreen() {
  return (
    <div class="screen levels-screen">
      <TopBar title={t.chapters.title} onBack={() => go('')}>
        <span class="topbar-stars">{totalStars.value} ★</span>
      </TopBar>
      <div class="scroll">
        <div class="chapters">
          {chapters.map((ch, ci) => {
            const open = chapterUnlocked(ch);
            const list = chapterLevels(ch.id);
            return (
              <section key={ch.id} class={`chapter${open ? '' : ' locked'}`}>
                <header>
                  <div>
                    <div class="chapter-num">{ci + 1}</div>
                    <div>
                      <h2>{ch.title}</h2>
                      <p class="muted">{ch.description}</p>
                    </div>
                  </div>
                  <span class="chapter-stars">{t.chapters.chapterStars(chapterStars(ch), list.length * 3)}</span>
                </header>
                {!open && (
                  <p class="lock-note">
                    <Icon name="lock" /> {t.chapters.locked(ch.unlockStars, totalStars.value)}
                  </p>
                )}
                <div class="level-grid">
                  {list.map((l) => {
                    const p = progress.value[l.id];
                    const can = levelUnlocked(l);
                    return (
                      <button
                        key={l.id}
                        class={`level-tile${p ? ' solved' : ''}${p?.stars === 3 ? ' perfect' : ''}`}
                        disabled={!can}
                        onClick={() => go(`level/${l.id}`)}
                      >
                        <span class="level-num">{levelNumber(l)}</span>
                        <span class="level-title">{l.title}</span>
                        {p ? <Stars n={p.stars} size="sm" /> : <span class="level-goal">{can ? '' : <Icon name="lock" />}</span>}
                      </button>
                    );
                  })}
                </div>
                {open &&
                  (chapterDone(ch.id) ? (
                    <button
                      class={`btn small lesson-btn${lessonsRead.value.includes(ch.id) ? '' : ' new'}`}
                      onClick={() => go(`lesson/${ch.id}`)}
                    >
                      <Icon name="book" /> {t.lesson.button}
                    </button>
                  ) : (
                    <p class="muted small lesson-note">
                      {t.lesson.note(list.filter((l) => progress.value[l.id]).length, list.length)}
                    </p>
                  ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
