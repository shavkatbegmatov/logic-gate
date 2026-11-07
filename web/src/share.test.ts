import { describe, expect, it } from 'vitest';
import { fullShareText, levelShareText, telegramShareUrl } from './share';

describe('ulashish', () => {
  const text = levelShareText({ number: 15, title: 'Multipleksor', stars: 2, gates: 5, goal: 4 });

  it('daraja natijasi matni', () => {
    expect(text).toBe("Logic Gate · 15-daraja «Multipleksor»\n★★☆ — 5 ta element (maqsad: 4)\nSen ham yechib ko'r!");
  });

  it('Telegram havolasi matn va manzilni to\'g\'ri kodlaydi', () => {
    const url = telegramShareUrl('http://example.uz/', text);
    expect(url.startsWith('https://t.me/share/url?url=http%3A%2F%2Fexample.uz%2F&text=')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('url')).toBe('http://example.uz/');
    expect(parsed.searchParams.get('text')).toBe(text);
  });

  it('nusxalash matni havola bilan tugaydi', () => {
    expect(fullShareText('http://example.uz/', 'salom')).toBe('salom\nhttp://example.uz/');
  });
});
