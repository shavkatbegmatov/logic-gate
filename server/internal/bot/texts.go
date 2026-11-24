package bot

// Bot xabarlari: o'zbekcha (standart) va ruscha — o'yin interfeysi bilan bir xil ikki til.
type texts struct {
	Welcome        string
	Play           string
	RemindOn       string
	RemindOff      string
	SwitchLang     string // boshqa tilga o'tish tugmasi (o'sha tilda yozilgan)
	RemindEnabled  string // %d — eslatma soati (Toshkent)
	RemindDisabled string
	CallbackOn     string
	CallbackOff    string
	Daily          string // #%d, daraja nomi
	DailySeq       string // #%d — xotira kuni (D-trigger)
	Solve          string
	Streak         string // %d kun
	Solvers        string // %d kishi
	First          string
	Help           string
	// Inline rejim (istalgan suhbatda @bot).
	MemoryDay        string
	ShareDailyTitle  string // #%d
	ShareDailyDesc   string // daraja nomi
	ShareDaily       string // #%d, daraja nomi
	ShareMine        string // yulduzlar, element soni
	ShareDailyMine   string // #%d, yulduzlar, element soni
	ShareInviteTitle string
	ShareInviteDesc  string
	ShareInvite      string
	ID               string // %d
	Tiers            [6]string
	Commands         []Command
	// Saytga Telegram orqali kirish (auth.go).
	AuthLogin    string // %s — bog'langan profil taxallusi
	AuthLoginNew string
	AuthLink     string // %s — bog'lanadigan profil
	AuthReplace  string // %s — hozir bog'langan profil
	AuthPick     string
	AuthNotMe    string
	AuthApproved string
	AuthLinked   string // %s
	AuthDenied   string
	AuthWrong    string
	AuthExpired  string
	AuthTaken    string
}

var msgs = map[string]texts{
	"uz": {
		Welcome: "Salom! Bu — Logic Gate: mantiqiy elementlardan sxema yig'ib, boshqotirmalarni yechadigan o'yin.\n\n" +
			"48 ta daraja, har kuni yangi masala, reyting va do'stlar uchun masalalar. Boshlash uchun «O'ynash» ni bosing.",
		Play:             "🎮 O'ynash",
		RemindOn:         "🔔 Har kuni eslatish",
		RemindOff:        "🔕 Eslatmani o'chirish",
		SwitchLang:       "🇷🇺 Русский",
		RemindEnabled:    "Kunlik eslatma yoqildi: har kuni soat %d:00 da (Toshkent) bugungi masala haqida xabar beraman. Masalani yechgan kuningiz yozmayman.",
		RemindDisabled:   "Kunlik eslatma o'chirildi. Qayta yoqish — /eslatma.",
		CallbackOn:       "Eslatma yoqildi ✅",
		CallbackOff:      "Eslatma o'chirildi",
		Daily:            "📅 Kunlik boshqotirma #%d tayyor — %s.",
		DailySeq:         "🧠 Kunlik boshqotirma #%d tayyor — bugun xotira kuni: D-trigger kerak!",
		Solve:            "🧩 Yechish",
		Streak:           "🔥 Seriyangiz: %d kun — bugun ham yeching!",
		Solvers:          "Bugun %d kishi yechdi.",
		First:            "Birinchilardan bo'ling!",
		MemoryDay:        "xotira kuni (D-trigger)",
		ShareDailyTitle:  "📅 Kunlik boshqotirma #%d",
		ShareDailyDesc:   "Bugungi masalani yuborish — %s",
		ShareDaily:       "🧩 Logic Gate · Kunlik boshqotirma #%d — %s.\nKim kamroq element bilan yechadi?",
		ShareMine:        "Natijangiz bilan: %s · %d element",
		ShareDailyMine:   "🧩 Logic Gate · Kunlik boshqotirma #%d\nMen yechdim: %s — %d ta element. Sen-chi?",
		ShareInviteTitle: "🎮 Logic Gate'ga taklif",
		ShareInviteDesc:  "Mantiqiy sxemalar o'yini: 48 daraja, kunlik masala",
		ShareInvite: "🎮 Logic Gate — mantiqiy elementlardan sxema yig'ib, boshqotirma yechadigan o'yin.\n" +
			"48 daraja, har kuni yangi masala va reyting. Telegram ichida, bepul!",
		Help: "Logic Gate — mantiqiy sxemalar o'yini.\n\n" +
			"/start — o'yinni ochish\n/eslatma — kunlik eslatmani yoqish yoki o'chirish\n/til — Русский язык\n/id — Telegram ID'ingiz",
		ID:    "Telegram ID'ingiz: %d",
		Tiers: [6]string{"", "oson", "yengil", "o'rtacha", "qiyin", "juda qiyin"},
		Commands: []Command{
			{"start", "O'yinni ochish"},
			{"eslatma", "Kunlik eslatmani yoqish yoki o'chirish"},
			{"til", "Tilni almashtirish: Русский"},
			{"id", "Telegram ID'ingiz"},
			{"help", "Yordam"},
		},
		AuthLogin: "🔐 Brauzerda «%s» profiliga Telegram orqali kirish so'raldi.",
		AuthLoginNew: "🔐 Brauzerda Telegram orqali kirish so'raldi. Bu Telegram hisobi hali hech bir profilga bog'lanmagan: " +
			"tasdiqlasangiz, saytda yangi profil ochasiz yoki tiklash kodi bilan avvalgi profilingizni bog'laysiz.",
		AuthLink:     "🔗 Brauzerdagi «%s» profilini shu Telegram hisobiga bog'lash so'raldi. Keyin istalgan qurilmada «Telegram orqali kirish» bilan shu profilga kirasiz.",
		AuthReplace:  "Hozir bu Telegram «%s» profiliga bog'langan — tasdiqlasangiz, bog'lanish yangisiga o'tadi.",
		AuthPick:     "Saytda ko'rinib turgan raqamni tanlang. So'rovni siz yubormagan bo'lsangiz — «Bu men emas» ni bosing.",
		AuthNotMe:    "❌ Bu men emas",
		AuthApproved: "✅ Tasdiqlandi. Brauzerga qayting — sahifa o'zi davom etadi.",
		AuthLinked:   "✅ «%s» profili Telegram'ga bog'landi. Endi istalgan qurilmada «Telegram orqali kirish» bilan kirasiz.",
		AuthDenied:   "❌ So'rov bekor qilindi.",
		AuthWrong:    "❌ Raqam mos kelmadi — so'rov bekor qilindi. Saytda qaytadan urinib ko'ring.",
		AuthExpired:  "Bu so'rov eskirgan yoki ishlatilgan. Saytda «Telegram orqali kirish» ni qayta bosing.",
		AuthTaken:    "Bu so'rov boshqa Telegram hisobida ochilgan.",
	},
	"ru": {
		Welcome: "Привет! Это Logic Gate — игра-головоломка: собирайте схемы из логических элементов.\n\n" +
			"48 уровней, новая задача каждый день, рейтинг и задачи для друзей. Чтобы начать, нажмите «Играть».",
		Play:             "🎮 Играть",
		RemindOn:         "🔔 Напоминать каждый день",
		RemindOff:        "🔕 Выключить напоминание",
		SwitchLang:       "🇺🇿 O'zbekcha",
		RemindEnabled:    "Ежедневное напоминание включено: каждый день в %d:00 (по Ташкенту) напишу о новой задаче. В день, когда вы её решили, не пишу.",
		RemindDisabled:   "Ежедневное напоминание выключено. Включить снова — /eslatma.",
		CallbackOn:       "Напоминание включено ✅",
		CallbackOff:      "Напоминание выключено",
		Daily:            "📅 Задача дня #%d готова — %s.",
		DailySeq:         "🧠 Задача дня #%d готова — сегодня день памяти: нужен D-триггер!",
		Solve:            "🧩 Решать",
		Streak:           "🔥 Ваша серия: %d дн. — решите и сегодня!",
		Solvers:          "Сегодня решили: %d.",
		First:            "Будьте среди первых!",
		MemoryDay:        "день памяти (D-триггер)",
		ShareDailyTitle:  "📅 Задача дня #%d",
		ShareDailyDesc:   "Отправить сегодняшнюю задачу — %s",
		ShareDaily:       "🧩 Logic Gate · Задача дня #%d — %s.\nКто решит меньшим числом элементов?",
		ShareMine:        "С вашим результатом: %s · %d эл.",
		ShareDailyMine:   "🧩 Logic Gate · Задача дня #%d\nЯ решил: %s — %d эл. А ты?",
		ShareInviteTitle: "🎮 Пригласить в Logic Gate",
		ShareInviteDesc:  "Игра про логические схемы: 48 уровней, задача дня",
		ShareInvite: "🎮 Logic Gate — игра-головоломка: собирай схемы из логических элементов.\n" +
			"48 уровней, новая задача каждый день и рейтинг. Прямо в Telegram, бесплатно!",
		Help: "Logic Gate — игра про логические схемы.\n\n" +
			"/start — открыть игру\n/eslatma — включить или выключить ежедневное напоминание\n/til — o'zbek tili\n/id — ваш Telegram ID",
		ID:    "Ваш Telegram ID: %d",
		Tiers: [6]string{"", "легко", "несложно", "средне", "сложно", "очень сложно"},
		Commands: []Command{
			{"start", "Открыть игру"},
			{"eslatma", "Ежедневное напоминание: вкл/выкл"},
			{"til", "Сменить язык: o'zbekcha"},
			{"id", "Ваш Telegram ID"},
			{"help", "Помощь"},
		},
		AuthLogin: "🔐 В браузере запрошен вход в профиль «%s» через Telegram.",
		AuthLoginNew: "🔐 В браузере запрошен вход через Telegram. Этот аккаунт Telegram ещё не привязан к профилю: " +
			"после подтверждения на сайте можно создать новый профиль или привязать прежний по коду восстановления.",
		AuthLink:     "🔗 Запрошена привязка профиля «%s» к этому аккаунту Telegram. Потом на любом устройстве вы войдёте в него через «Войти через Telegram».",
		AuthReplace:  "Сейчас этот Telegram привязан к профилю «%s» — после подтверждения привязка перейдёт на новый.",
		AuthPick:     "Выберите число, которое показано на сайте. Если запрос отправляли не вы — нажмите «Это не я».",
		AuthNotMe:    "❌ Это не я",
		AuthApproved: "✅ Подтверждено. Вернитесь в браузер — страница продолжит сама.",
		AuthLinked:   "✅ Профиль «%s» привязан к Telegram. Теперь на любом устройстве входите через «Войти через Telegram».",
		AuthDenied:   "❌ Запрос отменён.",
		AuthWrong:    "❌ Число не совпало — запрос отменён. Попробуйте ещё раз на сайте.",
		AuthExpired:  "Этот запрос устарел или уже использован. Нажмите «Войти через Telegram» на сайте ещё раз.",
		AuthTaken:    "Этот запрос открыт в другом аккаунте Telegram.",
	},
}

func t(lang string) texts {
	if m, ok := msgs[lang]; ok {
		return m
	}
	return msgs["uz"]
}
