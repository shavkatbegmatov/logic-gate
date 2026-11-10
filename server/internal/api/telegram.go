package api

import (
	"context"
	"net/http"
)

// Telegram — bot (LG_TELEGRAM_TOKEN bo'lsa): Mini App ma'lumotini tekshirish va eslatma haqida xabar.
type Telegram interface {
	// VerifyInitData Telegram.WebApp.initData imzosini tekshiradi; to'g'ri bo'lsa — foydalanuvchi id va tili.
	VerifyInitData(initData string) (userID int64, lang string, err error)
	// RemindChanged foydalanuvchiga holat haqida xabar yuboradi; blocked — bot unga yoza olmaydi.
	RemindChanged(ctx context.Context, chatID int64, lang string, on bool) (blocked bool, err error)
}

// telegramRemind — o'yin ichidan (Telegram Mini App) kunlik eslatmani ko'rish/yoqish/o'chirish.
// {initData} — holatni qaytaradi, {initData, on} — o'zgartiradi. Tiklash kodi bilan kelsa, chat
// o'yinchiga bog'lanadi: bugungi masalani yechgan kuni eslatma yuborilmaydi, seriya ko'rsatiladi.
func (s *Server) telegramRemind(w http.ResponseWriter, r *http.Request) {
	tg := s.opts.Telegram
	if tg == nil {
		writeErr(w, http.StatusNotFound, "telegram_off")
		return
	}
	var req struct {
		InitData string `json:"initData"`
		On       *bool  `json:"on"`
		// Lang — o'yinda tanlangan til: bot ham shu tilda yozadi.
		Lang string `json:"lang"`
	}
	if !decode(w, r, &req) {
		return
	}
	uid, _, err := tg.VerifyInitData(req.InitData)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "bad_init_data")
		return
	}
	lang := req.Lang
	if lang != "ru" {
		lang = "uz"
	}
	ctx := r.Context()
	if req.On != nil {
		if err := s.store.SetRemind(ctx, uid, lang, *req.On); err != nil {
			s.internal(w, r, err)
			return
		}
		if err := s.store.SetLang(ctx, uid, lang); err != nil {
			s.internal(w, r, err)
			return
		}
		blocked, err := tg.RemindChanged(ctx, uid, lang, *req.On)
		if err != nil {
			// Telegram bilan aloqa bo'lmadi — holat saqlangan, xabarsiz ham ishlaydi.
			s.log.Warn("telegram remind xabari", "err", err)
		}
		if blocked && *req.On {
			if err := s.store.SetRemind(ctx, uid, lang, false); err != nil {
				s.internal(w, r, err)
				return
			}
			writeErr(w, http.StatusConflict, "bot_blocked")
			return
		}
	}
	if p := s.optionalPlayer(r); p != nil {
		if err := s.store.LinkChat(ctx, uid, p.ID); err != nil {
			s.internal(w, r, err)
			return
		}
	}
	c, err := s.store.Chat(ctx, uid)
	remind := err == nil && c.Remind && !c.Blocked
	writeJSON(w, http.StatusOK, map[string]bool{"remind": remind})
}
