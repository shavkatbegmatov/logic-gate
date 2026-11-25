// Mavzuni birinchi chizishdan oldin qo'yadi, aks holda yorug' mavzuda sahifa bir lahza qorong'i
// miltillaydi. CSP inline skriptga ruxsat bermaydi, shuning uchun alohida fayl. Keyin src/theme.ts boshqaradi.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('lg.settings.v1') || '{}') || {};
    // Animatsiya sozlamasi ham (src/theme.ts): yuklanish belgisi birinchi kadrdanoq to'g'ri bo'lsin.
    if (saved.motion === 'on' || saved.motion === 'off') document.documentElement.setAttribute('data-motion', saved.motion);
    var theme = saved.theme;
    if (theme === 'auto') {
      var light = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches;
      // Telegram Mini App: mavzu ranglari manzil hashida keladi (tgWebAppThemeParams).
      var m = /tgWebAppThemeParams=([^&]*)/.exec(location.hash);
      if (m) {
        var bg = (JSON.parse(decodeURIComponent(m[1])).bg_color || '').replace('#', '');
        if (bg.length === 6) {
          var n = parseInt(bg, 16);
          light = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 128;
        }
      }
      theme = light ? 'daftar' : 'pcb';
    }
    // Sanoat PCB (pcb) — atributsiz (asosiy ranglar); qolganlari — styles.css dagi [data-theme] bloklari.
    if (
      theme === 'bench' ||
      theme === 'breadboard' ||
      theme === 'scifi' ||
      theme === 'minor' ||
      theme === 'plata' ||
      theme === 'haqiqiy' ||
      theme === 'daftar' ||
      theme === 'chizma'
    ) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    var mode = saved.boardMode;
    document.documentElement.setAttribute('data-board', mode === 'real3d' || mode === 'schematic' ? mode : 'real2d');
  } catch (e) {
    // localStorage yopiq — asosiy mavzu.
  }
})();

// Til lug'ati alohida faylda (src/i18n.ts). Ilova uni asosiy JS bajarilgandan keyingina so'rardi va
// birinchi chizish bitta so'rovga kechikardi — shuning uchun kerakli lug'at shu yerda, asosiy JS bilan
// parallel so'rab qo'yiladi. Fayl manzillari (nomida xesh) shu skript tegida: build ularni index.html ga
// yozadi (vite.config.ts). Til src/state.ts dagi tartibda taxmin qilinadi: havoladagi ?lang=, saqlangan
// til, birinchi ochilishda — Telegram yoki brauzer tili, aks holda o'zbekcha. Tilni baribir ilova
// tanlaydi: taxmin noto'g'ri chiqsa, bitta ortiqcha fayl yuklanadi, xolos.
(function () {
  function known(code) {
    var base = String(code || '').toLowerCase().split(/[-_]/)[0];
    return base === 'uz' || base === 'ru' ? base : '';
  }

  function guess() {
    var m = /[?&]lang=([^&]*)/.exec(location.search);
    var lang = known(m && m[1]);
    if (lang) return lang;
    var fresh = true;
    try {
      lang = known((JSON.parse(localStorage.getItem('lg.settings.v1') || '{}') || {}).lang);
      if (lang) return lang;
      fresh = localStorage.getItem('lg.progress.v1') === null && localStorage.getItem('lg.profile.v1') === null;
    } catch (e) {
      // localStorage yopiq yoki yozuv buzuq — yangi qurilma kabi.
    }
    if (!fresh) return 'uz';
    var codes = [];
    try {
      // Telegram Mini App: ilova tili manzil hashida keladi (tgWebAppData → user.language_code).
      var data = new URLSearchParams(location.hash.replace(/^#/, '')).get('tgWebAppData');
      if (data) codes.push(JSON.parse(new URLSearchParams(data).get('user')).language_code);
    } catch (e) {
      // Telegram tili yo'q — brauzer tili.
    }
    codes = codes.concat(navigator.languages && navigator.languages.length ? [].slice.call(navigator.languages) : [navigator.language]);
    for (var i = 0; i < codes.length; i++) {
      lang = known(codes[i]);
      if (lang) return lang;
    }
    return 'uz';
  }

  try {
    var lang = guess();
    // Ilova ochilmasa, pastdagi oyna shu tilda chiqadi; ochilsa — tilni ilova o'zi qo'yadi (src/i18n.ts).
    document.documentElement.lang = lang;
    var href = document.currentScript && document.currentScript.getAttribute('data-dict-' + lang);
    if (href) {
      var link = document.createElement('link');
      link.rel = 'modulepreload';
      link.crossOrigin = '';
      link.href = href;
      document.head.appendChild(link);
    }
  } catch (e) {
    // Oldindan so'rab bo'lmadi — lug'atni ilova o'zi yuklaydi.
  }
})();

// Ilova umuman ochilmasa (fayl yuklanmadi yoki ishga tushishda xato) — oq ekran o'rniga qayta yuklash va
// qurilmadagi o'yin ma'lumotini tozalash taklifi. Ilova chizilgach main.tsx window.__lgReady qo'yadi —
// shundan keyingi xatolarni ilovaning o'zi ushlaydi (app.tsx).
(function () {
  var failed = null;
  var shown = false;

  // Til — yuqorida taxmin qilingani, yoki ilova qo'yib ulgurgani.
  function ru() {
    return document.documentElement.lang === 'ru';
  }

  function report(err) {
    try {
      var body = JSON.stringify({
        msg: String((err && err.message) || err || 'boot').slice(0, 300),
        stack: String((err && err.stack) || '').slice(0, 1500),
        route: 'boot',
        version: 'boot',
        ua: navigator.userAgent.slice(0, 200),
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }));
    } catch (e) {
      // xabar yuborilmadi — muhim emas
    }
  }

  // Profil (tiklash kodi) qoladi: natijalar serverdan qaytadi. Qolgan o'yin yozuvlari o'chiriladi.
  function clearData() {
    try {
      var keep = null;
      try {
        var p = JSON.parse(localStorage.getItem('lg.profile.v1') || 'null');
        if (p && typeof p.id === 'string' && typeof p.code === 'string' && typeof p.nickname === 'string') keep = JSON.stringify(p);
      } catch (e) {
        // profil buzuq — u ham o'chadi
      }
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('lg.') === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
      if (keep) localStorage.setItem('lg.profile.v1', keep);
    } catch (e) {
      // localStorage yopiq
    }
    location.replace(location.pathname + location.search);
  }

  function button(text, primary, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText =
      'font:600 15px system-ui,sans-serif;padding:12px 18px;border-radius:12px;cursor:pointer;margin:6px 6px 0 0;' +
      (primary ? 'background:#f2b33d;color:#1a1300;border:0;' : 'background:transparent;color:inherit;border:1px solid currentColor;');
    b.addEventListener('click', onClick);
    return b;
  }

  function show() {
    if (shown || window.__lgReady) return;
    shown = true;
    var r = ru();
    var root = document.getElementById('app') || document.body;
    root.innerHTML = '';
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'max-width:440px;margin:15vh auto;padding:0 20px;font:16px/1.5 system-ui,sans-serif;color:#e8efe9;';
    var th = document.documentElement.getAttribute('data-theme');
    if (th === 'daftar' || th === 'chizma' || th === 'breadboard') box.style.color = '#1f2a24';
    var h = document.createElement('h1');
    h.style.cssText = 'font-size:22px;margin:0 0 10px';
    h.textContent = r ? 'Игра не открылась' : "O'yin ochilmadi";
    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 14px';
    p.textContent = r
      ? 'Перезагрузите страницу. Если не помогло — очистите данные игры на этом устройстве: профиль останется, результаты, отправленные на сервер, вернутся.'
      : "Sahifani qayta yuklang. Yordam bermasa — shu qurilmadagi o'yin ma'lumotini tozalang: profil qoladi, serverga yuborilgan natijalar qaytib keladi.";
    var armed = false;
    var clear = button(r ? 'Очистить данные' : "Ma'lumotni tozalash", false, function () {
      if (armed) return clearData();
      armed = true;
      clear.textContent = r ? 'Точно очистить?' : 'Rostdan ham tozalansinmi?';
    });
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(button(r ? 'Перезагрузить' : 'Qayta yuklash', true, function () { location.reload(); }));
    box.appendChild(clear);
    root.appendChild(box);
  }

  function check() {
    if (failed && !window.__lgReady) {
      report(failed);
      show();
    }
  }

  // Faqat skript xatolari: rasm yoki shrift yuklanmagani ilovani to'xtatmaydi.
  addEventListener(
    'error',
    function (e) {
      if (window.__lgReady || failed) return;
      var el = e.target;
      if (el && el !== window && el.tagName !== 'SCRIPT') return;
      failed = e.error || e.message || 'script not loaded: ' + (el && el.src);
      if (document.readyState === 'complete') setTimeout(check, 0);
    },
    true
  );
  // Modul skriptlari 'load' dan oldin bajariladi: shu paytgacha ilova chizilmagan bo'lsa — xato bo'lgan.
  addEventListener('load', function () {
    setTimeout(check, 0);
  });
})();
