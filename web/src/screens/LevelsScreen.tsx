import { useEffect, useRef, useState } from 'preact/hooks';
import { lazy } from '../components/lazy';
import { Icon, Stars, TopBar } from '../components/ui';
import { t } from '../i18n';
import { chapterDone, lessonsRead } from '../lessons';
import { mapCell, mapColumns, mapSeen, markMapSeen, TILE_GAP } from '../levelmap';
import { chapterLevels, chapters, levelNumber, levels } from '../levels';
import { go } from '../router';
import { chapterStars, chapterUnlocked, continueLevel, levelUnlocked, progress, totalStars } from '../state';
import { markSceneSeen, preloadStory, sceneSeen, STORY_CHAPTERS, storyOn, storyPlace, type SceneRef } from '../story';
import { assignedLevels } from '../tasks';

const StoryScene = lazy(() => import('./StoryScene').then((m) => m.StoryScene));

/** Bo'lim kartochkasi va uning ichki chegaralari (styles.css: .chapters, .chapter). */
const MAP_INSET = 2 * 16 + 2 * 16 + 2;

export function LevelsScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => Math.min(920, innerWidth) - MAP_INSET);
  // Shu ochilishda birinchi marta ko'rilayotgan yechimlar: ulardan keyingi yo'l "yonib" chiqadi.
  const [fresh] = useState(() => {
    const seen = new Set(mapSeen.value);
    return levels.filter((l) => progress.value[l.id] && !seen.has(l.id)).map((l) => l.id);
  });
  // Bo'lim kartasidagi «Hikoya» — sahnani qayta ko'rish (kirish, bo'lim tugagan bo'lsa — keyin chiqish ham).
  const [scene, setScene] = useState<SceneRef | null>(null);
  const closeScene = () => {
    if (!scene) return;
    markSceneSeen(scene);
    const outro: SceneRef = { chapter: scene.chapter, kind: 'outro' };
    setScene(scene.kind === 'intro' && chapterDone(scene.chapter) ? outro : null);
  };

  useEffect(() => {
    // Hikoya qatorlari darajada darhol chiqishi uchun matnlar shu yerda oldindan yuklanadi.
    if (storyOn()) void preloadStory();
    markMapSeen(levels.filter((l) => progress.value[l.id]).map((l) => l.id));
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Navbatdagi daraja bo'limiga o'tish (birinchi bo'lim bo'lsa — joyida).
    const cur = chapters.findIndex((c) => c.id === continueLevel().chapter);
    if (cur > 0) el.children[cur]?.scrollIntoView({ block: 'start' });
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - MAP_INSET));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div class="screen levels-screen">
      <TopBar title={t.chapters.title} onBack={() => go('')}>
        <span class="topbar-stars">{totalStars.value} ★</span>
      </TopBar>
      <div class="scroll">
        <div class="chapters" ref={ref}>
          {chapters.map((ch, ci) => {
            const open = chapterUnlocked(ch);
            const list = chapterLevels(ch.id);
            const cols = mapColumns(width, list.length);
            const current = list.find((l) => levelUnlocked(l) && !progress.value[l.id]);
            return (
              <section key={ch.id} class={`chapter${open ? '' : ' locked'}`}>
                <header>
                  <div>
                    <div class="chapter-num">{ci + 1}</div>
                    <div>
                      {storyPlace(ch.id) && <span class="chapter-place">{storyPlace(ch.id)}</span>}
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
                <div class="level-map" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `${TILE_GAP}px` }}>
                  {list.map((l, i) => {
                    const p = progress.value[l.id];
                    const can = levelUnlocked(l);
                    const cell = mapCell(i, list.length, cols);
                    const order = fresh.indexOf(l.id);
                    return (
                      <button
                        key={l.id}
                        class={`level-tile${p ? ' solved' : ''}${p?.stars === 3 ? ' perfect' : ''}${l === current ? ' current' : ''}${
                          assignedLevels.value.has(l.id) ? ' assigned' : ''
                        }`}
                        style={{ gridRow: cell.row, gridColumn: cell.col }}
                        disabled={!can}
                        onClick={() => go(`level/${l.id}`)}
                      >
                        <span class="level-num">{levelNumber(l)}</span>
                        <span class="level-title">{l.title}</span>
                        {p ? <Stars n={p.stars} size="sm" /> : <span class="level-goal">{can ? '' : <Icon name="lock" />}</span>}
                        {can && <span class="node-led" aria-hidden="true" />}
                        {cell.link && (
                          <span
                            class={`link link-${cell.link}${p ? ' on' : ''}${order >= 0 ? ' fresh' : ''}`}
                            style={order >= 0 ? { animationDelay: `${0.25 + Math.min(order, 12) * 0.12}s` } : undefined}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                {open && storyOn() && STORY_CHAPTERS.includes(ch.id) && sceneSeen({ chapter: ch.id, kind: 'intro' }) && (
                  <button class="btn small ghost story-btn" onClick={() => setScene({ chapter: ch.id, kind: 'intro' })}>
                    <Icon name="book" /> {t.story.replay}
                  </button>
                )}
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
      {scene && <StoryScene key={`${scene.chapter}:${scene.kind}`} scene={scene} onDone={closeScene} />}
    </div>
  );
}
