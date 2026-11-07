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
	ID             string // %d
	Tiers          [6]string
	Commands       []Command
}

var msgs = map[string]texts{
	"uz": {
		Welcome: "Salom! Bu — Logic Gate: mantiqiy elementlardan sxema yig'ib, boshqotirmalarni yechadigan o'yin.\n\n" +
			"36 ta daraja, har kuni yangi masala, reyting va do'stlar uchun masalalar. Boshlash uchun «O'ynash» ni bosing.",
		Play:           "🎮 O'ynash",
		RemindOn:       "🔔 Har kuni eslatish",
		RemindOff:      "🔕 Eslatmani o'chirish",
		SwitchLang:     "🇷🇺 Русский",
		RemindEnabled:  "Kunlik eslatma yoqildi: har kuni soat %d:00 da (Toshkent) bugungi masala haqida xabar beraman. Masalani yechgan kuningiz yozmayman.",
		RemindDisabled: "Kunlik eslatma o'chirildi. Qayta yoqish — /eslatma.",
		CallbackOn:     "Eslatma yoqildi ✅",
		CallbackOff:    "Eslatma o'chirildi",
		Daily:          "📅 Kunlik boshqotirma #%d tayyor — %s.",
		DailySeq:       "🧠 Kunlik boshqotirma #%d tayyor — bugun xotira kuni: D-trigger kerak!",
		Solve:          "🧩 Yechish",
		Streak:         "🔥 Seriyangiz: %d kun — bugun ham yeching!",
		Solvers:        "Bugun %d kishi yechdi.",
		First:          "Birinchilardan bo'ling!",
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
	},
	"ru": {
		Welcome: "Привет! Это Logic Gate — игра-головоломка: собирайте схемы из логических элементов.\n\n" +
			"36 уровней, новая задача каждый день, рейтинг и задачи для друзей. Чтобы начать, нажмите «Играть».",
		Play:           "🎮 Играть",
		RemindOn:       "🔔 Напоминать каждый день",
		RemindOff:      "🔕 Выключить напоминание",
		SwitchLang:     "🇺🇿 O'zbekcha",
		RemindEnabled:  "Ежедневное напоминание включено: каждый день в %d:00 (по Ташкенту) напишу о новой задаче. В день, когда вы её решили, не пишу.",
		RemindDisabled: "Ежедневное напоминание выключено. Включить снова — /eslatma.",
		CallbackOn:     "Напоминание включено ✅",
		CallbackOff:    "Напоминание выключено",
		Daily:          "📅 Задача дня #%d готова — %s.",
		DailySeq:       "🧠 Задача дня #%d готова — сегодня день памяти: нужен D-триггер!",
		Solve:          "🧩 Решать",
		Streak:         "🔥 Ваша серия: %d дн. — решите и сегодня!",
		Solvers:        "Сегодня решили: %d.",
		First:          "Будьте среди первых!",
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
	},
}

func t(lang string) texts {
	if m, ok := msgs[lang]; ok {
		return m
	}
	return msgs["uz"]
}
