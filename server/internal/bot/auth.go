package bot

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"logicgate/server/internal/store"
	"logicgate/server/internal/tglogin"
)

// Saytga Telegram orqali kirish: brauzer so'rov ochadi va botni t.me/<bot>?start=auth_<id> havolasi bilan
// ochadi. Bot so'rovni shu foydalanuvchiga biriktiradi va saytdagi raqamni tanlashni so'raydi (uchta tugma,
// biri to'g'ri). To'g'ri raqam — tasdiq: bog'lash so'rovida bot profilni darhol bog'laydi, kirishda esa
// brauzer o'zi profil kalitini oladi (api paketi).

const authPrefix = "auth_"

// SetLogins — kirish so'rovlari (main.go: API bilan umumiy). nil — Telegram orqali kirish o'chirilgan.
func (b *Bot) SetLogins(h *tglogin.Hub) { b.logins = h }

// setUsername — getMe dan olingan bot nomi (HTTP so'rovlari StartLink orqali parallel o'qiydi).
func (b *Bot) setUsername(name string) {
	b.username = name
	b.startName.Store(name)
}

// StartLink — api.Telegram interfeysi uchun: botni /start parametri bilan ochadigan havola.
func (b *Bot) StartLink(payload string) string {
	name, _ := b.startName.Load().(string)
	if name == "" {
		return ""
	}
	return "https://t.me/" + name + "?start=" + payload
}

// onAuthStart — /start auth_<id>: so'rov botda ochildi.
func (b *Bot) onAuthStart(ctx context.Context, m *Message, id, lang string) error {
	tx := t(lang)
	chat := m.Chat.ID
	if b.logins == nil {
		_, err := b.tg.SendMessage(ctx, chat, tx.AuthExpired, nil)
		return err
	}
	req, err := b.logins.Open(id, chat, fullName(m.From))
	switch {
	case errors.Is(err, tglogin.ErrTaken):
		_, err = b.tg.SendMessage(ctx, chat, tx.AuthTaken, nil)
		return err
	case err != nil:
		_, err = b.tg.SendMessage(ctx, chat, tx.AuthExpired, nil)
		return err
	}
	linked, err := b.st.PlayerByChat(ctx, chat)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return err
	}
	var text string
	switch {
	case req.Kind == tglogin.Link:
		text = fmt.Sprintf(tx.AuthLink, req.Nickname)
		if linked != nil && linked.ID != req.Player {
			text += "\n\n" + fmt.Sprintf(tx.AuthReplace, linked.Nickname)
		}
	case linked != nil:
		text = fmt.Sprintf(tx.AuthLogin, linked.Nickname)
	default:
		text = tx.AuthLoginNew
	}
	row := make([]Button, len(req.Choices))
	for i, n := range req.Choices {
		row[i] = Button{Text: strconv.Itoa(n), CallbackData: authData(req.ID, n)}
	}
	kb := &Keyboard{InlineKeyboard: [][]Button{row, {{Text: tx.AuthNotMe, CallbackData: authData(req.ID, 0)}}}}
	_, err = b.tg.SendMessage(ctx, chat, text+"\n\n"+tx.AuthPick, kb)
	return err
}

func authData(id string, n int) string { return "auth:" + id + ":" + strconv.Itoa(n) }

// onAuthAnswer — tugma: auth:<id>:<raqam> (0 — «Bu men emas»).
func (b *Bot) onAuthAnswer(ctx context.Context, cb *CallbackQuery, data string) {
	chat := cb.From.ID
	lang := b.chatLang(ctx, chat)
	tx := t(lang)
	id, num, _ := strings.Cut(data, ":")
	n, _ := strconv.Atoi(num)
	var (
		req tglogin.Request
		err error
	)
	if b.logins == nil {
		err = tglogin.ErrNotFound
	} else {
		req, err = b.logins.Answer(id, chat, n)
	}
	var text, note string
	switch {
	case errors.Is(err, tglogin.ErrTaken):
		text = tx.AuthTaken
	case err != nil:
		text = tx.AuthExpired
	case req.State != tglogin.Approved && n == 0:
		text, note = tx.AuthDenied, tx.AuthDenied
	case req.State != tglogin.Approved:
		text, note = tx.AuthWrong, tx.AuthWrong
	case req.Kind == tglogin.Link:
		if err := b.st.LinkChat(ctx, chat, req.Player); err != nil {
			b.log.Error("telegram bog'lash", "err", err)
			// Brauzer «bog'landi» deb o'ylamasin: so'rov rad etilgan hisoblanadi.
			b.logins.Finish(id)
			text = tx.AuthExpired
			break
		}
		text, note = fmt.Sprintf(tx.AuthLinked, req.Nickname), "✅"
	default:
		text, note = tx.AuthApproved, "✅"
	}
	if err := b.tg.AnswerCallback(ctx, cb.ID, note); err != nil {
		b.log.Warn("telegram answerCallback", "err", err)
	}
	if m := cb.Message; m != nil && m.MessageID != 0 {
		to := m.Chat.ID
		if to == 0 {
			to = chat
		}
		if err := b.tg.EditText(ctx, to, m.MessageID, text, nil); err != nil {
			b.log.Warn("telegram editMessageText", "err", err)
		}
		return
	}
	if _, err := b.tg.SendMessage(ctx, chat, text, nil); err != nil {
		b.sendFailed(ctx, chat, err)
	}
}

// fullName — Telegram'dagi ism (yangi profil taxallusi taklifi): ism va familiya, ko'pi bilan 20 belgi.
func fullName(u *User) string {
	if u == nil {
		return ""
	}
	name := strings.Join(strings.Fields(u.FirstName+" "+u.LastName), " ")
	if utf8.RuneCountInString(name) > 20 {
		name = strings.TrimSpace(string([]rune(name)[:20]))
	}
	return name
}
