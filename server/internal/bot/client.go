// Package bot — @LogicGateUzBot: /start, kunlik eslatma, admin uchun zaxira nusxa va statistika.
// Bot API ga to'g'ridan-to'g'ri HTTP so'rovlar (kutubxonasiz); yangilanishlar long polling bilan olinadi —
// tashqi webhook manzili va uning sirini saqlash kerak emas.
package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Client — Bot API mijozi. Token so'rov manzilida bo'ladi, shuning uchun xato matnlaridan olib tashlanadi.
type Client struct {
	base  string
	token string
	http  *http.Client
}

func NewClient(base, token string) *Client {
	if base == "" {
		base = "https://api.telegram.org"
	}
	// Long polling 50 s kutadi — umumiy vaqt chegarasi undan katta.
	return &Client{base: strings.TrimRight(base, "/"), token: token, http: &http.Client{Timeout: 75 * time.Second}}
}

// APIError — Bot API ning "ok": false javobi.
type APIError struct {
	Code        int
	Description string
	RetryAfter  int
}

func (e *APIError) Error() string { return fmt.Sprintf("telegram %d: %s", e.Code, e.Description) }

// Blocked — foydalanuvchi botni bloklagan, o'chirgan yoki unga yozishga ruxsat bermagan.
func Blocked(err error) bool {
	var e *APIError
	return errors.As(err, &e) && (e.Code == 403 || (e.Code == 400 && strings.Contains(e.Description, "chat not found")))
}

// clean xato matnidan tokenni olib tashlaydi (net/http xatolari so'rov manzilini o'z ichiga oladi).
func (c *Client) clean(err error) error {
	if err == nil || c.token == "" || !strings.Contains(err.Error(), c.token) {
		return err
	}
	return errors.New(strings.ReplaceAll(err.Error(), c.token, "***"))
}

func (c *Client) endpoint(method string) string { return c.base + "/bot" + c.token + "/" + method }

func (c *Client) call(ctx context.Context, method string, params, out any) error {
	body, err := json.Marshal(params)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint(method), bytes.NewReader(body))
	if err != nil {
		return c.clean(err)
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req, method, out)
}

func (c *Client) do(req *http.Request, method string, out any) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return c.clean(err)
	}
	defer resp.Body.Close()
	var r struct {
		OK          bool            `json:"ok"`
		Result      json.RawMessage `json:"result"`
		ErrorCode   int             `json:"error_code"`
		Description string          `json:"description"`
		Parameters  *struct {
			RetryAfter int `json:"retry_after"`
		} `json:"parameters"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&r); err != nil {
		return fmt.Errorf("telegram %s: %s", method, resp.Status)
	}
	if !r.OK {
		e := &APIError{Code: r.ErrorCode, Description: r.Description}
		if r.Parameters != nil {
			e.RetryAfter = r.Parameters.RetryAfter
		}
		return e
	}
	if out != nil {
		return json.Unmarshal(r.Result, out)
	}
	return nil
}

// ── Bot API turlari (ishlatiladigan qismi) ─────────────────

type User struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	Username     string `json:"username"`
	LanguageCode string `json:"language_code"`
}

type Chat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}

type Message struct {
	MessageID   int       `json:"message_id"`
	From        *User     `json:"from"`
	Chat        Chat      `json:"chat"`
	Text        string    `json:"text"`
	ReplyMarkup *Keyboard `json:"reply_markup,omitempty"`
}

type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message"`
	Data    string   `json:"data"`
}

type Update struct {
	UpdateID      int64          `json:"update_id"`
	Message       *Message       `json:"message"`
	CallbackQuery *CallbackQuery `json:"callback_query"`
}

type WebApp struct {
	URL string `json:"url"`
}

type Button struct {
	Text         string  `json:"text"`
	URL          string  `json:"url,omitempty"`
	CallbackData string  `json:"callback_data,omitempty"`
	WebApp       *WebApp `json:"web_app,omitempty"`
}

type Keyboard struct {
	InlineKeyboard [][]Button `json:"inline_keyboard"`
}

type Command struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// ── Usullar ────────────────────────────────────────────────

func (c *Client) GetMe(ctx context.Context) (User, error) {
	var u User
	return u, c.call(ctx, "getMe", struct{}{}, &u)
}

func (c *Client) DeleteWebhook(ctx context.Context) error {
	return c.call(ctx, "deleteWebhook", map[string]any{"drop_pending_updates": false}, nil)
}

// GetUpdates — yangilanishlar. Har biri alohida o'qiladi: tushunilmaganining faqat raqami qoladi
// (u o'tkazib yuboriladi), aks holda bitta buzilgan yangilanish botni bir joyda aylantirib qo'yardi.
func (c *Client) GetUpdates(ctx context.Context, offset int64, timeout int) ([]Update, error) {
	var raw []json.RawMessage
	err := c.call(ctx, "getUpdates", map[string]any{
		"offset": offset, "timeout": timeout, "allowed_updates": []string{"message", "callback_query"},
	}, &raw)
	if err != nil {
		return nil, err
	}
	ups := make([]Update, 0, len(raw))
	for _, r := range raw {
		var u Update
		if err := json.Unmarshal(r, &u); err != nil {
			var id struct {
				UpdateID int64 `json:"update_id"`
			}
			json.Unmarshal(r, &id)
			u = Update{UpdateID: id.UpdateID}
		}
		ups = append(ups, u)
	}
	return ups, nil
}

func (c *Client) SendMessage(ctx context.Context, chatID int64, text string, kb *Keyboard) (Message, error) {
	params := map[string]any{
		"chat_id": chatID, "text": text, "link_preview_options": map[string]bool{"is_disabled": true},
	}
	if kb != nil {
		params["reply_markup"] = kb
	}
	var m Message
	return m, c.call(ctx, "sendMessage", params, &m)
}

func (c *Client) EditReplyMarkup(ctx context.Context, chatID int64, messageID int, kb *Keyboard) error {
	return c.call(ctx, "editMessageReplyMarkup", map[string]any{
		"chat_id": chatID, "message_id": messageID, "reply_markup": kb,
	}, nil)
}

func (c *Client) AnswerCallback(ctx context.Context, id, text string) error {
	return c.call(ctx, "answerCallbackQuery", map[string]any{"callback_query_id": id, "text": text}, nil)
}

func (c *Client) SetMyCommands(ctx context.Context, cmds []Command, lang string) error {
	params := map[string]any{"commands": cmds}
	if lang != "" {
		params["language_code"] = lang
	}
	return c.call(ctx, "setMyCommands", params, nil)
}

// SendDocument faylni yuboradi (multipart). Bot API chegarasi — 50 MB.
func (c *Client) SendDocument(ctx context.Context, chatID int64, path, caption string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	w.WriteField("chat_id", fmt.Sprint(chatID))
	w.WriteField("caption", caption)
	part, err := w.CreateFormFile("document", filepath.Base(path))
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, f); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("sendDocument"), &body)
	if err != nil {
		return c.clean(err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	return c.do(req, "sendDocument", nil)
}
