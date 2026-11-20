import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '../audio';
import { cam3d } from '../board/cam3d';
import { t } from '../i18n';
import { settings } from '../state';
import { AAA_THEMES, activeBoardMode, activeTheme, BOARD_MODES, CLASSIC_THEMES, isAaaTheme, type BoardMode, type Theme } from '../theme';
import { Icon, type IconName } from './ui';

const MODE_ICON: Record<BoardMode, IconName> = {
  real2d: 'layers',
  real3d: 'cube',
  schematic: 'schematic',
};

const MODE_LABEL: Record<BoardMode, () => string> = {
  real2d: () => t.play.view.real2d,
  real3d: () => t.play.view.real3d,
  schematic: () => t.play.view.schematic,
};

/** O'yin maydonidagi tezkor boshqaruv: 2D Real / 3D / Sxema, 4 ta AAA uslub + 3D kamera. */
export function ViewTools() {
  const open = useSignal(false);
  const popRef = useRef<HTMLDivElement>(null);
  const mode = activeBoardMode.value;
  const theme = activeTheme.value;
  const selectedTheme = settings.value.theme ?? 'pcb';
  const c3 = cam3d.value;

  useEffect(() => {
    if (!open.value) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) open.value = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open.value = false;
    };
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('pointerdown', onDown);
      removeEventListener('keydown', onKey);
    };
  }, [open.value]);

  const setMode = (next: BoardMode) => {
    if (next === mode) return;
    settings.value = { ...settings.value, boardMode: next };
    sfx.mode();
  };

  const setTheme = (next: Theme) => {
    const nextMode: BoardMode | undefined =
      next !== 'auto' && !isAaaTheme(next)
        ? 'schematic'
        : next !== 'auto' && isAaaTheme(next) && mode === 'schematic'
          ? 'real2d'
          : undefined;
    settings.value = nextMode ? { ...settings.value, theme: next, boardMode: nextMode } : { ...settings.value, theme: next };
    open.value = false;
    sfx.mode();
  };

  return (
    <div class="view-tools">
      <div class="view-seg" role="group" aria-label={t.settings.boardMode}>
        {BOARD_MODES.map((m) => (
          <button
            key={m}
            type="button"
            class={m === mode ? 'on' : ''}
            aria-pressed={m === mode}
            aria-label={MODE_LABEL[m]()}
            title={t.settings.boardModeHint[m]}
            onClick={() => setMode(m)}
          >
            <Icon name={MODE_ICON[m]} />
            <span class="view-label">{MODE_LABEL[m]()}</span>
          </button>
        ))}
      </div>

      <div class="style-btn-wrap" ref={popRef}>
        <div class="view-seg">
          <button
            type="button"
            class={open.value ? 'on' : ''}
            aria-expanded={open.value}
            aria-label={t.play.view.style}
            title={t.play.view.style}
            onClick={() => (open.value = !open.value)}
          >
            <span class="style-dot" data-theme={theme} aria-hidden="true" />
            <Icon name="palette" />
          </button>
        </div>

        {open.value && (
          <div class="style-pop" role="menu" aria-label={t.settings.theme}>
            <div class="style-pop-head">{t.settings.styleGroups.aaa}</div>
            {AAA_THEMES.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={selectedTheme === id}
                class={`style-opt${selectedTheme === id ? ' on' : ''}`}
                onClick={() => setTheme(id)}
              >
                <span class="style-dot" data-theme={id} aria-hidden="true" />
                <span>{t.settings.themes[id]}</span>
              </button>
            ))}
            <div class="style-pop-head">{t.settings.styleGroups.classic}</div>
            {CLASSIC_THEMES.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={selectedTheme === id}
                class={`style-opt${selectedTheme === id ? ' on' : ''}`}
                onClick={() => setTheme(id)}
              >
                <span class="style-dot" data-theme={id === 'auto' ? theme : id} aria-hidden="true" />
                <span>{t.settings.themes[id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'real3d' && (
        <div class="view-seg view-cam">
          <button
            type="button"
            class={c3.orbitMode ? 'on' : ''}
            aria-pressed={c3.orbitMode}
            aria-label={c3.orbitMode ? t.play.view.orbit : t.play.view.pan}
            title={c3.orbitMode ? t.play.view.orbit : t.play.view.pan}
            onClick={() => {
              cam3d.value = { ...c3, orbitMode: !c3.orbitMode };
              sfx.mode();
            }}
          >
            <Icon name="orbit" />
            <span class="view-label">{c3.orbitMode ? t.play.view.orbit : t.play.view.pan}</span>
          </button>
          <button
            type="button"
            class={c3.angle === 'top' ? 'on' : ''}
            aria-pressed={c3.angle === 'top'}
            aria-label={c3.angle === 'top' ? t.play.view.resetCam : t.play.view.topCam}
            title={c3.angle === 'top' ? t.play.view.resetCam : t.play.view.topCam}
            onClick={() => {
              cam3d.value = {
                ...c3,
                angle: c3.angle === 'top' ? 'studio' : 'top',
                resetSeq: c3.resetSeq + 1,
              };
              sfx.mode();
            }}
          >
            <Icon name="compass" />
          </button>
        </div>
      )}
    </div>
  );
}
