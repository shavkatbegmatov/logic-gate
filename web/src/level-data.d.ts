// Daraja ma'lumotlari bo'laklari — vite.config.ts dagi levelData() levels/levels.json dan yasaydi.
// Turlar src/levels.ts da beriladi (sim/types.ts dagi Level, Chapter).

/** Bosh yuklamada: bo'limlar, daraja nomlari, oyoqlari va elementlari. */
declare module 'virtual:levels/meta' {
  const data: { chapters: unknown[]; levels: unknown[] };
  export default data;
}

/** Alohida bo'lakda: har daraja uchun jadval yoki avtomat, vazifa matni va maslahatlar (id bo'yicha). */
declare module 'virtual:levels/detail' {
  const data: Record<string, Record<string, unknown>>;
  export default data;
}
