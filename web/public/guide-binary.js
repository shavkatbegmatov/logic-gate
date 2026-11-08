// "Ikkilik sanoq sistemasi" qo'llanmasidagi o'yinchoq: bitlarni bosish ↔ o'nlik son.
// Sahifa JavaScript'siz ham to'liq o'qiladi; bu faqat qo'shimcha. CSP: alohida fayl (inline emas).
(function () {
  var toy = document.getElementById('bits-toy');
  var input = document.getElementById('bits-input');
  var bin = document.getElementById('bits-bin');
  var dec = document.getElementById('bits-dec');
  if (!toy || !input || !bin || !dec) return;
  var buttons = Array.prototype.slice.call(toy.querySelectorAll('.bit'));

  function show(n) {
    n = Math.max(0, Math.min(255, Math.floor(Number(n)) || 0));
    buttons.forEach(function (b) {
      var on = (n & Number(b.getAttribute('data-w'))) !== 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('.v').textContent = on ? '1' : '0';
    });
    bin.textContent = ('00000000' + n.toString(2)).slice(-8);
    dec.textContent = String(n);
    return n;
  }

  function value() {
    return buttons.reduce(function (s, b) {
      return s + (b.getAttribute('aria-pressed') === 'true' ? Number(b.getAttribute('data-w')) : 0);
    }, 0);
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      input.value = String(show(value()));
    });
  });
  input.addEventListener('input', function () {
    if (input.value !== '') show(input.value);
  });
  // Boshlang'ich misol — sahifadagi "13" bilan bir xil.
  input.value = String(show(13));
})();
