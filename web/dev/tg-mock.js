// Telegram Mini App'ning soxta SDK si — Telegram'siz lokal sinov uchun (faqat `pnpm dev`, build'ga kirmaydi).
//
// Ishlatish: vite.config.local.ts da process.env.VITE_TG_SDK_URL = '/dev/tg-mock.js', keyin o'yinni
// Telegram ochgandek manzil bilan oching:
//   http://localhost:5173/#tgWebAppData=<url-encoded user=…&auth_date=…&hash=…>&tgWebAppVersion=8.0&tgWebAppPlatform=tdesktop
//
// CloudStorage — localStorage'da `tgmock.cloud.*` (o'yin `lg.*` ni tozalaganda saqlanib qoladi: "boshqa
// qurilma"ni shunday taqlid qilsa bo'ladi); javob `tgmock.delay` ms kechikadi (standart 1500).
// Barcha chaqiruvlar window.__tgmock.log da; orqaga tugmasi — window.__tgmock.back().
(function () {
  var params = new URLSearchParams(location.hash.replace(/^#/, ''));
  var data = new URLSearchParams(params.get('tgWebAppData') || '');
  var user = null;
  try {
    user = JSON.parse(data.get('user') || 'null');
  } catch (e) {
    user = null;
  }
  var log = [];
  // Har chaqiruvda o'qiladi: sinov paytida kechikishni o'zgartirsa bo'ladi.
  var later = function (fn) {
    setTimeout(fn, Number(localStorage.getItem('tgmock.delay') || 1500));
  };
  var backCb = null;
  var mock = (window.__tgmock = {
    log: log,
    backVisible: false,
    back: function () {
      if (backCb) backCb();
    },
  });
  var cmp = function (a, b) {
    var x = a.split('.').map(Number);
    var y = b.split('.').map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    }
    return 0;
  };
  var version = params.get('tgWebAppVersion') || '8.0';
  window.Telegram = {
    WebApp: {
      initData: params.get('tgWebAppData') || '',
      initDataUnsafe: { user: user || undefined, start_param: data.get('start_param') || undefined },
      version: version,
      platform: params.get('tgWebAppPlatform') || 'tdesktop',
      colorScheme: 'dark',
      isVersionAtLeast: function (v) {
        return cmp(version, v) >= 0;
      },
      ready: function () {
        log.push(['ready']);
      },
      expand: function () {
        log.push(['expand']);
      },
      disableVerticalSwipes: function () {
        log.push(['disableVerticalSwipes']);
      },
      setHeaderColor: function (c) {
        log.push(['setHeaderColor', c]);
      },
      setBackgroundColor: function (c) {
        log.push(['setBackgroundColor', c]);
      },
      setBottomBarColor: function (c) {
        log.push(['setBottomBarColor', c]);
      },
      onEvent: function (name) {
        log.push(['onEvent', name]);
      },
      openTelegramLink: function (url) {
        log.push(['openTelegramLink', url]);
      },
      openLink: function (url) {
        log.push(['openLink', url]);
      },
      requestWriteAccess: function (cb) {
        log.push(['requestWriteAccess']);
        cb(true);
      },
      BackButton: {
        show: function () {
          mock.backVisible = true;
        },
        hide: function () {
          mock.backVisible = false;
        },
        onClick: function (cb) {
          backCb = cb;
        },
      },
      HapticFeedback: {
        impactOccurred: function (s) {
          log.push(['haptic', s]);
        },
        notificationOccurred: function (s) {
          log.push(['haptic', s]);
        },
        selectionChanged: function () {
          log.push(['haptic', 'select']);
        },
      },
      CloudStorage: {
        getItem: function (key, cb) {
          log.push(['cloud.get', key]);
          later(function () {
            cb(null, localStorage.getItem('tgmock.cloud.' + key) || '');
          });
        },
        setItem: function (key, value, cb) {
          log.push(['cloud.set', key]);
          later(function () {
            localStorage.setItem('tgmock.cloud.' + key, value);
            if (cb) cb(null, true);
          });
        },
        removeItem: function (key, cb) {
          log.push(['cloud.remove', key]);
          later(function () {
            localStorage.removeItem('tgmock.cloud.' + key);
            if (cb) cb(null, true);
          });
        },
      },
    },
  };
})();
