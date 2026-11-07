// Ketma-ket darajalarda maqsad haqiqatan eng kam element soni ekanini to'liq sanash bilan isbotlaydi.
// Ishga tushirish: node levels/seq-min.mjs   (bir necha soniya)
//
// Har qanday sxema = k ta D-trigger + m ta kombinatsion element. Triggerlar chiqishi — qo'shimcha
// o'zgaruvchilar, shuning uchun elementlar (kirishlar + triggerlar) ustidagi funksiyalarni hisoblaydi.
// Maqsaddan kam (k + m < goal) har bir sxema va uning chiqishlari hamda trigger kirishlariga har bir
// ulanish varianti kerakli avtomat bilan BFS orqali solishtiriladi (o'yindagi tekshiruv bilan bir xil).
// Qisqartirish: boshqa signal bilan bir xil funksiya beradigan element tashlanadi — uni olib tashlab,
// foydalanuvchilarini o'sha signalga ulasak, kamroq elementli teng sxema hosil bo'ladi (u ham sanaladi).
import { machineOf } from './machine.mjs';
import { search } from './seqsearch.mjs';
import { levels } from './source.mjs';

let failed = false;
for (const level of levels.filter((l) => l.step)) {
  const m = machineOf(level, (msg) => {
    throw new Error(`${level.id}: ${msg}`);
  });
  const minK = Math.ceil(Math.log2(m.next.length));
  const t0 = Date.now();
  let better = null;
  for (let total = 0; total < level.goal && !better; total++) {
    for (let k = minK; k <= total && !better; k++) {
      const res = search(level, m, k, total - k);
      if (res) better = { total, k, ...res };
    }
  }
  // Qidiruv bo'sh emasligini tekshirish: maqsad sonida yechim albatta topilishi kerak.
  let atGoal = null;
  for (let k = minK; k <= level.goal && !atGoal; k++) atGoal = search(level, m, k, level.goal - k);
  const ms = Date.now() - t0;
  if (!atGoal) {
    failed = true;
    console.log(`${level.id}: maqsad ${level.goal} da ham yechim topilmadi — qidiruvda xato`);
  } else if (better) {
    failed = true;
    console.log(`${level.id}: maqsad ${level.goal}, lekin ${better.total} ta bilan bo'ladi (${better.k} trigger):`, JSON.stringify(better));
  } else {
    console.log(`${level.id}: maqsad ${level.goal} — minimum (avtomat ${m.next.length} holat, kamida ${minK} trigger; ${ms} ms)`);
  }
}
process.exit(failed ? 1 : 0);
