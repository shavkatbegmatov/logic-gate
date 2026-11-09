import { describe, expect, it } from 'vitest';
import { levels } from './levels';
import { activeTask, dayToISO, dueState, isoToDay, taskLevels, taskProgress, tasksFromClasses } from './tasks';

const [a, b, c] = levels;
const task = (id: number, ids: string[], due?: number) => ({ id, title: '', levels: ids, due, createdAt: 0 });

describe('sinf vazifalari', () => {
  it("darajalar o'yindagi tartibda, noma'lumlari tashlanadi", () => {
    expect(taskLevels(task(1, [c.id, 'zz', a.id])).map((l) => l.id)).toEqual([a.id, c.id]);
  });

  it('bajarilganlar soni', () => {
    const solved = (id: string) => id === a.id;
    expect(taskProgress(task(1, [a.id, b.id]), solved)).toEqual({ done: 1, total: 2 });
  });

  it('muddat holati', () => {
    expect(dueState(undefined, 100)).toBe('none');
    expect(dueState(101, 100)).toBe('ok');
    expect(dueState(100, 100)).toBe('today');
    expect(dueState(99, 100)).toBe('over');
  });

  it("bosh sahifadagi vazifa: bajarilmagan, muddati o'tmagan, eng yaqin muddatli", () => {
    const solved = (id: string) => id === a.id;
    const list = [
      task(1, [a.id]), // bajarilgan
      task(2, [b.id], 99), // muddati o'tgan
      task(3, [b.id]), // muddatsiz
      task(4, [c.id], 105),
      task(5, [b.id, c.id], 102),
    ];
    expect(activeTask(list, solved, 100)?.id).toBe(5);
    expect(activeTask(list.slice(0, 4), solved, 100)?.id).toBe(4);
    expect(activeTask(list.slice(0, 3), solved, 100)?.id).toBe(3);
    expect(activeTask(list.slice(0, 2), solved, 100)).toBeUndefined();
  });

  it('sinflardan vazifalar', () => {
    const list = tasksFromClasses([
      { code: 'AAAAAA', name: '8-A', members: 3, tasks: [task(7, [a.id])] },
      { code: 'BBBBBB', name: '8-B', members: 2 },
    ]);
    expect(list).toEqual([{ ...task(7, [a.id]), classCode: 'AAAAAA', className: '8-A' }]);
  });

  it('sana ↔ kun', () => {
    expect(dayToISO(20401)).toBe('2025-11-09');
    expect(isoToDay('2025-11-09')).toBe(20401);
    expect(isoToDay('')).toBe(0);
  });
});

describe("vazifa va qulf", () => {
  it("vazifadagi daraja ochiq; yechilgani vazifa o'chirilgandan keyin ham ochiq qoladi", async () => {
    const { progress, levelUnlocked, chapterUnlocked } = await import('./state');
    const { setMyTasks } = await import('./tasks');
    const { chapters, chapterLevels } = await import('./levels');
    const locked = chapters.find((ch) => !chapterUnlocked(ch))!;
    const level = chapterLevels(locked.id)[2];
    expect(levelUnlocked(level)).toBe(false);
    setMyTasks([{ id: 1, title: '', levels: [level.id], createdAt: 0, classCode: 'AAAAAA', className: '8-A' }]);
    expect(levelUnlocked(level)).toBe(true);
    progress.value = { ...progress.value, [level.id]: { stars: 2, gates: 5 } as never };
    setMyTasks([]);
    expect(levelUnlocked(level)).toBe(true);
  });
});
