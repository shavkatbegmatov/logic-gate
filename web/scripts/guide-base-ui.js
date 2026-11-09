// "Sanoq sistemalari" qo'llanmasidagi kalkulyator (brauzer qismi). pages.mjs build'da buni
// scripts/numbase.mjs bilan birga dist/guide-base.js ga yig'adi (bitta IIFE ichida) — shuning uchun
// convert, stepsHtml va boshqalar shu yerda mavjud. Sahifa JavaScript'siz ham o'qiladi.
var root = document.getElementById('base-calc');
if (root) {
  var num = document.getElementById('base-num');
  var from = document.getElementById('base-from');
  var to = document.getElementById('base-to');
  var swap = document.getElementById('base-swap');
  var error = document.getElementById('base-error');
  var steps = document.getElementById('base-steps');
  var labels = JSON.parse(root.getAttribute('data-labels') || '{}');
  var errors = JSON.parse(root.getAttribute('data-errors') || '{}');

  var render = function () {
    var f = Number(from.value);
    var t = Number(to.value);
    try {
      var c = convert(num.value, f, t);
      error.hidden = true;
      steps.innerHTML = stepsHtml(c, labels);
    } catch (e) {
      if (!(e instanceof BaseError)) throw e;
      error.textContent = (errors[e.code] || e.code).split('{d}').join(e.detail || '').split('{from}').join(String(f));
      error.hidden = false;
      steps.innerHTML = '';
    }
  };

  num.addEventListener('input', render);
  from.addEventListener('change', render);
  to.addEventListener('change', render);
  swap.addEventListener('click', function () {
    // Natija yangi kirish bo'ladi: 2026 (10 → 16) → 7EA (16 → 10).
    try {
      num.value = convert(num.value, Number(from.value), Number(to.value)).result;
    } catch (e) {
      // noto'g'ri son — faqat sistemalar almashadi
    }
    var x = from.value;
    from.value = to.value;
    to.value = x;
    render();
  });
  render();
}
