// "Bul algebrasi" qo'llanmasidagi kalkulyator (brauzer qismi). pages.mjs build'da buni src/boolexpr.ts
// bilan birga dist/guide-bool.js ga yig'adi (bitta IIFE ichida) — shuning uchun parseExpr va boshqalar
// shu yerda mavjud. Sahifa JavaScript'siz ham o'qiladi: jadval build'da chizilgan.
var root = document.getElementById('bool-calc');
if (root) {
  var inA = document.getElementById('expr-a');
  var inB = document.getElementById('expr-b');
  var verdict = document.getElementById('expr-verdict');
  var toSandbox = document.getElementById('expr-sandbox');
  var table = document.getElementById('expr-table');
  var last = inA;

  var text = function (name, vals) {
    var s = root.getAttribute('data-' + name) || '';
    Object.keys(vals || {}).forEach(function (k) {
      s = s.split('{' + k + '}').join(String(vals[k]));
    });
    return s;
  };

  var show = function (msg, cls, keepTable) {
    verdict.textContent = msg;
    verdict.className = 'verdict' + (cls ? ' ' + cls : '');
    // Ifodada xato bo'lsa — eski jadval qolmasin (boshqa ifodaniki bo'lib ko'rinadi). Ifodalar teng
    // bo'lmasa esa jadval aynan shu ikki ifodaniki — farq qilgan qatorlar unda ko'rinadi.
    if (cls === 'bad' && !keepTable) table.innerHTML = '';
  };

  var parse = function (input, label) {
    try {
      return parseExpr(input.value);
    } catch (e) {
      if (!(e instanceof ExprError)) throw e;
      show(label + ': ' + text('err-' + e.code, { pos: e.pos + 1 }), 'bad');
      return null;
    }
  };

  var render = function () {
    var la = root.getAttribute('data-short-a');
    var lb = root.getAttribute('data-short-b');
    var a = parse(inA, la);
    if (toSandbox) toSandbox.hidden = !a;
    if (!a) return;
    // O'yindagi Qum qutida — 1-ifodaning sxemasi (o'yin sahifa tilida ochiladi).
    if (toSandbox) toSandbox.href = '/?lang=' + document.documentElement.lang + '#/sandbox/' + encodeURIComponent(inA.value.trim());
    var withB = inB.value.trim() !== '';
    var b = withB ? parse(inB, lb) : null;
    if (withB && !b) return;
    var vars = a.vars.slice();
    if (b) b.vars.forEach(function (v) { if (vars.indexOf(v) < 0) vars.push(v); });
    vars.sort();
    if (vars.length > MAX_VARS) return show(text('err-vars'), 'bad');
    var rows = rowsOf(vars);
    var outs = [{ label: la, values: rows.map(function (env) { return evalExpr(a.ast, env); }) }];
    if (b) outs.push({ label: lb, values: rows.map(function (env) { return evalExpr(b.ast, env); }) });
    table.innerHTML = calcTableHtml(vars, rows, outs);
    if (!b) return show(text('rows', { n: rows.length }), '');
    for (var r = 0; r < rows.length; r++) {
      if (outs[0].values[r] !== outs[1].values[r]) {
        var env = rows[r];
        var row = vars.map(function (v) { return v + ' = ' + env[v]; }).join(', ');
        return show(text('differ', { row: row, p: outs[0].values[r], q: outs[1].values[r] }), 'bad', true);
      }
    }
    show(text('equal', { n: rows.length }), 'ok');
  };

  [inA, inB].forEach(function (input) {
    input.addEventListener('input', render);
    input.addEventListener('focus', function () { last = input; });
  });
  Array.prototype.forEach.call(root.querySelectorAll('.sym'), function (btn) {
    btn.addEventListener('click', function () {
      var sym = btn.getAttribute('data-sym');
      var start = last.selectionStart == null ? last.value.length : last.selectionStart;
      var end = last.selectionEnd == null ? start : last.selectionEnd;
      last.setRangeText(sym, start, end, 'end');
      last.focus();
      render();
    });
  });
  render();
}
