import { describe, expect, it } from 'vitest';
import type { ClassReport } from './api';
import { summarize } from './classes';
import { chapters, levels } from './levels';
import { reportFileName, reportTable, toCSV, toTSV, type ReportLabels } from './report-export';

const labels: ReportLabels = {
  student: 'Student',
  stars: 'Stars',
  levels: 'Levels',
  chapter: (n, total) => `Ch${n} (${total})`,
  today: 'Today',
  week: 'Week',
  lastSeen: 'Seen',
  task: (task, total) => `${task.title || 'Task'} (${total})`,
};

const [a, b] = levels;
const now = Date.UTC(2026, 10, 9, 12) / 1000;
const report: ClassReport = {
  code: 'ABCDEF',
  name: '8-B',
  createdAt: 0,
  today: 0,
  now,
  members: [
    { id: '1', nickname: 'Ali; "Vali"', joinedAt: 0, lastSeen: now, levels: { [a.id]: 3, [b.id]: 2 }, dailyToday: 3, dailyWeek: 4 },
    { id: '2', nickname: '=SUM(A1)', joinedAt: 0, lastSeen: now - 86400 * 2, levels: {}, dailyToday: 0, dailyWeek: 0 },
  ],
  tasks: [{ id: 1, title: 'XOR', levels: [a.id, b.id], createdAt: 0 }],
};
const rows = report.members.map((m) => summarize(m, now));

describe("hisobotni jadvalga chiqarish", () => {
  const table = reportTable(report, rows, labels);

  it("sarlavha: o'quvchi, yulduz, daraja, har bir bo'lim, kunlik, faollik, vazifalar", () => {
    expect(table.head.length).toBe(3 + chapters.length + 3 + 1);
    expect(table.head.at(-1)).toBe('XOR (2)');
    expect(table.head[3]).toBe(`Ch1 (${rows[0].chapters[0].total})`);
  });

  it("qatorlar: sonlar va oxirgi kirish sanasi (Toshkent)", () => {
    expect(table.rows[0].slice(0, 3)).toEqual(['Ali; "Vali"', 5, 2]);
    expect(table.rows[0].slice(-4)).toEqual([3, 4, '2026-11-09', 2]);
    expect(table.rows[1].slice(-2)).toEqual(['2026-11-07', 0]);
  });

  it("CSV: ';' ajratgich, qo'shtirnoq ichidagi belgilar, formulalar matn bo'lib qoladi", () => {
    const csv = toCSV(table);
    expect(csv.split('\r\n')[1].startsWith('"Ali; ""Vali"""')).toBe(true);
    expect(csv.split('\r\n')[2].startsWith("'=SUM(A1);0;0")).toBe(true);
  });

  it('TSV: tab bilan, satr ichida tab yo\'q', () => {
    const tsv = toTSV({ head: ['a\tb', 'c'], rows: [[1, '-x']] });
    expect(tsv).toBe("a b\tc\n1\t'-x");
  });

  it('fayl nomi', () => {
    expect(reportFileName('8-B sinf, 12-maktab', 20766)).toBe('8-B-sinf-12-maktab-2026-11-09.csv');
    expect(reportFileName('«Робот»', 20766)).toBe('Робот-2026-11-09.csv');
    expect(reportFileName('!!!', 20766)).toBe('sinf-2026-11-09.csv');
  });
});
