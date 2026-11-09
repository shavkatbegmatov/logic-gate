// O'qituvchi hisobotini jadval sifatida chiqarish: CSV fayl (Excel) va nusxalash uchun TSV
// (Excel yoki Google Sheets'ga to'g'ridan-to'g'ri qo'yiladi).
import type { ClassReport, ClassTask } from './api';
import type { MemberSummary } from './classes';
import { dayOf } from './daily';
import { chapters } from './levels';
import { dayToISO, taskLevels } from './tasks';

export interface ReportLabels {
  student: string;
  stars: string;
  levels: string;
  chapter: (n: number, total: number) => string;
  today: string;
  week: string;
  lastSeen: string;
  task: (task: ClassTask, total: number) => string;
}

export type Cell = string | number;

export interface Table {
  head: string[];
  rows: Cell[][];
}

/** Hisobot jadvali: ekrandagi tartibda; bo'limlar va vazifalar — yechilgan darajalar soni. */
export function reportTable(r: ClassReport, rows: MemberSummary[], l: ReportLabels): Table {
  const tasks = r.tasks ?? [];
  const head = [
    l.student,
    l.stars,
    l.levels,
    ...chapters.map((_, i) => l.chapter(i + 1, rows[0]?.chapters[i]?.total ?? 0)),
    l.today,
    l.week,
    l.lastSeen,
    ...tasks.map((task) => l.task(task, taskLevels(task).length)),
  ];
  return {
    head,
    rows: rows.map((s) => [
      s.member.nickname,
      s.stars,
      s.solved,
      ...s.chapters.map((c) => c.solved),
      s.member.dailyToday,
      s.member.dailyWeek,
      dayToISO(dayOf(s.member.lastSeen * 1000)),
      ...tasks.map((task) => taskLevels(task).filter((lv) => s.member.levels[lv.id]).length),
    ]),
  };
}

/** Formula sifatida o'qilmasin (=, +, -, @ bilan boshlangan matn — CSV injection). */
function safe(v: Cell): string {
  const s = String(v);
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** CSV: ";" bilan — Excel o'zbek va rus sozlamalarida shuni kutadi; Google Sheets o'zi aniqlaydi. */
export function toCSV(t: Table): string {
  const cell = (v: Cell) => {
    const s = safe(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.head, ...t.rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** TSV: jadvalni nusxalab Excel/Sheets'ga qo'yish uchun. */
export function toTSV(t: Table): string {
  return [t.head, ...t.rows].map((row) => row.map((v) => safe(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}

/** Fayl nomi: sinf nomi (harf va raqamlar) va sana. */
export function reportFileName(className: string, day: number): string {
  const slug = className
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'sinf'}-${dayToISO(day)}.csv`;
}

/** Faylni yuklab olish (BOM bilan — Excel UTF-8 ni to'g'ri o'qisin). */
export function downloadCSV(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
