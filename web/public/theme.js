// Mavzuni birinchi chizishdan oldin qo'yadi, aks holda yorug' mavzuda sahifa bir lahza qorong'i
// miltillaydi. CSP inline skriptga ruxsat bermaydi, shuning uchun alohida fayl. Keyin src/theme.ts boshqaradi.
(function () {
  try {
    var theme = (JSON.parse(localStorage.getItem('lg.settings.v1') || '{}') || {}).theme;
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
      theme = light ? 'daftar' : 'plata';
    }
    if (theme === 'daftar') document.documentElement.setAttribute('data-theme', 'daftar');
  } catch (e) {
    // localStorage yopiq — asosiy mavzu.
  }
})();
