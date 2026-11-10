// Do'stlar masalalarining lokal natijalari (lg.custom.v1). Alohida modul: yutuqlar va sinxronlash
// (achievements.ts, sync.ts) o'yin ochilishida faqat shuni yuklaydi; masalani kodlash va o'qish
// (custom.ts) esa Qum quti va do'st masalasi ekranlari bilan birga, kerak bo'lganda yuklanadi.
import { signal } from '@preact/signals';
import { load, save } from './storage';
import { cleanRecord, cleanScore, isNum, isObj } from './validate';

interface CustomStore {
  solved: Record<string, { gates: number; stars: number; goal: number; at: number }>;
  created: number;
}

const KEY = 'lg.custom.v1';
const cleanStore = (v: unknown): CustomStore | null =>
  isObj(v)
    ? {
        solved: (cleanRecord(v.solved, cleanScore) ?? {}) as CustomStore['solved'],
        created: isNum(v.created) ? v.created : 0,
      }
    : null;
export const customStore = signal<CustomStore>(load(KEY, { solved: {}, created: 0 }, cleanStore));

function persist(next: CustomStore) {
  customStore.value = next;
  save(KEY, next);
}

export function recordCustom(id: string, gates: number, stars: number, goal: number) {
  const prev = customStore.value.solved[id];
  const improved = !prev || gates < prev.gates;
  if (improved) persist({ ...customStore.value, solved: { ...customStore.value.solved, [id]: { gates, stars, goal, at: Date.now() } } });
  return { improved, prev };
}

export function markCreated() {
  persist({ ...customStore.value, created: customStore.value.created + 1 });
}

export function resetCustom() {
  persist({ solved: {}, created: 0 });
}
