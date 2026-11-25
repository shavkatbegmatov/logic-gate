package api

import (
	"bytes"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"logicgate/server/internal/store"
)

// deviceIDLen — qurilma identifikatori: kalit xeshining boshi (hex). Ochiq — kalitni tiklab bo'lmaydi.
const deviceIDLen = 8

func deviceID(hash []byte) string {
	if len(hash) < deviceIDLen {
		return hex.EncodeToString(hash)
	}
	return hex.EncodeToString(hash[:deviceIDLen])
}

// deviceLabel — User-Agent'dan taxminiy qurilma nomi («Chrome · Android»). User-Agent'ning o'zi
// saqlanmaydi: o'yinchiga o'z qurilmasini tanish uchun shu yetarli.
func deviceLabel(ua string, miniApp bool) string {
	has := func(s ...string) bool {
		for _, x := range s {
			if strings.Contains(ua, x) {
				return true
			}
		}
		return false
	}
	var browser string
	switch {
	case miniApp:
		browser = "Telegram"
	case has("YaBrowser"):
		browser = "Yandex Browser"
	case has("Edg/", "EdgA/", "EdgiOS/"):
		browser = "Edge"
	case has("OPR/", "Opera"):
		browser = "Opera"
	case has("SamsungBrowser"):
		browser = "Samsung Internet"
	case has("Firefox/", "FxiOS/"):
		browser = "Firefox"
	case has("Chrome/", "CriOS/"):
		browser = "Chrome"
	case has("Safari/"):
		browser = "Safari"
	}
	var os string
	switch {
	case has("Android"):
		os = "Android"
	case has("iPhone", "iPad", "iPod"):
		os = "iOS"
	case has("Windows"):
		os = "Windows"
	case has("CrOS"):
		os = "ChromeOS"
	case has("Macintosh", "Mac OS X"):
		os = "macOS"
	case has("Linux"):
		os = "Linux"
	}
	switch {
	case browser != "" && os != "":
		return browser + " · " + os
	case browser != "":
		return browser
	}
	return os
}

type deviceJSON struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	CreatedAt int64  `json:"createdAt"`
	UsedAt    int64  `json:"usedAt"`
	Current   bool   `json:"current"`
}

// listDevices — o'yinchining qurilma kalitlari (Telegram orqali kirgan qurilmalar). viaCode — shu
// qurilma asosiy tiklash kodi bilan kirgan (u ro'yxatda yo'q).
func (s *Server) listDevices(w http.ResponseWriter, r *http.Request) {
	p := playerFrom(r)
	ds, err := s.store.Devices(r.Context(), p.ID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out := make([]deviceJSON, 0, len(ds))
	for _, d := range ds {
		out = append(out, deviceJSON{
			ID:        deviceID(d.Hash),
			Label:     d.Label,
			CreatedAt: d.CreatedAt.Unix(),
			UsedAt:    d.UsedAt.Unix(),
			Current:   bytes.Equal(d.Hash, p.Device),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": out, "viaCode": p.Device == nil})
}

// deleteDevice — bitta qurilmani profildan chiqaradi. Shu qurilmaning o'zini emas (buning uchun
// qurilmada «chiqish» bor) — aks holda o'yinchi o'zini bilmasdan chiqarib yuborardi.
func (s *Server) deleteDevice(w http.ResponseWriter, r *http.Request) {
	id, err := hex.DecodeString(r.PathValue("id"))
	if err != nil || len(id) != deviceIDLen {
		writeErr(w, http.StatusNotFound, "no_device")
		return
	}
	p := playerFrom(r)
	if p.Device != nil && deviceID(p.Device) == hex.EncodeToString(id) {
		writeErr(w, http.StatusBadRequest, "current_device")
		return
	}
	err = s.store.DeleteDevice(r.Context(), p.ID, id)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "no_device")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// logoutOthers — «boshqa qurilmalardan chiqish»: tiklash kodi yangisiga almashadi, barcha qurilma kalitlari
// o'chadi. Yangi kodni mijoz o'zi yaratib yuboradi (80 bit, server kodi bilan bir xil format): javob
// tarmoqda yo'qolsa ham, mijoz shu kod bilan tekshirib ko'ra oladi — profil qulflanib qolmaydi.
func (s *Server) logoutOthers(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if !decode(w, r, &body) {
		return
	}
	code := normalizeCode(body.Code)
	if code == "" {
		writeErr(w, http.StatusBadRequest, "bad_code")
		return
	}
	p := playerFrom(r)
	if err := s.store.ResetTokens(r.Context(), p.ID, hashCode(code)); err != nil {
		s.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
