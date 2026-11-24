import { t } from '../i18n';
import { chapterLevels, chapters, levelNumber } from '../levels';

/** O'qituvchi uchun darajalarni tanlash (vazifa va musobaqa): bo'limlar bo'yicha raqamli tugmalar. */
export function LevelPicker({ picked, max, onChange }: { picked: string[]; max: number; onChange: (next: string[]) => void }) {
  const toggle = (id: string) => {
    if (picked.includes(id)) onChange(picked.filter((x) => x !== id));
    else if (picked.length < max) onChange([...picked, id]);
  };
  return (
    <>
      <p class="field-label">{t.tasks.levelsLabel(picked.length, max)}</p>
      <div class="task-picker">
        {chapters.map((ch, i) => (
          <div key={ch.id} class="task-picker-row">
            <span class="task-picker-ch">
              {i + 1}. {ch.title}
            </span>
            <div class="task-picker-levels">
              {chapterLevels(ch.id).map((l) => {
                const on = picked.includes(l.id);
                return (
                  <button
                    type="button"
                    key={l.id}
                    class={on ? 'on' : ''}
                    aria-pressed={on}
                    aria-label={`${levelNumber(l)}. ${l.title}`}
                    title={l.title}
                    disabled={!on && picked.length >= max}
                    onClick={() => toggle(l.id)}
                  >
                    {levelNumber(l)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
