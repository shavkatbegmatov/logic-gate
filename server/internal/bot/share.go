package bot

import (
	"context"
	"fmt"
	"strings"

	"logicgate/levels"
)

// Inline rejim: istalgan suhbatda "@LogicGateUzBot" yozilsa — bugungi masala va o'yinga taklif kartalari.
// BotFather'da /setinline bilan yoqiladi; yoqilmagan bo'lsa Telegram inline so'rov yubormaydi.

type InlineQuery struct {
	ID    string `json:"id"`
	From  User   `json:"from"`
	Query string `json:"query"`
}

// InlineResult — InlineQueryResultArticle (ishlatiladigan qismi).
type InlineResult struct {
	Type                string           `json:"type"`
	ID                  string           `json:"id"`
	Title               string           `json:"title"`
	Description         string           `json:"description,omitempty"`
	ThumbnailURL        string           `json:"thumbnail_url,omitempty"`
	InputMessageContent InputTextMessage `json:"input_message_content"`
	ReplyMarkup         *Keyboard        `json:"reply_markup,omitempty"`
}

type InputTextMessage struct {
	MessageText        string          `json:"message_text"`
	LinkPreviewOptions map[string]bool `json:"link_preview_options,omitempty"`
}

func (c *Client) AnswerInlineQuery(ctx context.Context, id string, results []InlineResult) error {
	return c.call(ctx, "answerInlineQuery", map[string]any{
		"inline_query_id": id, "results": results, "cache_time": 60, "is_personal": true,
	}, nil)
}

func (b *Bot) onInline(ctx context.Context, q *InlineQuery) {
	lang := b.chatLang(ctx, q.From.ID)
	tx := t(lang)
	day := levels.DayOf(b.now())
	thumb := b.cfg.Site + "/icons/icon-192.png"
	noPreview := map[string]bool{"is_disabled": true}
	var results []InlineResult

	if p, ok := b.daily.For(day); ok {
		num := b.daily.Number(day)
		tier := ""
		if p.Tier >= 0 && p.Tier < len(tx.Tiers) {
			tier = tx.Tiers[p.Tier]
		}
		if p.Seq != nil {
			tier = tx.MemoryDay
		}
		title := fmt.Sprintf(tx.ShareDailyTitle, num)
		desc := fmt.Sprintf(tx.ShareDailyDesc, tier)
		text := fmt.Sprintf(tx.ShareDaily, num, tier)
		// O'yinga bog'langan va bugun yechgan bo'lsa — natijasi bilan.
		if c, err := b.st.Chat(ctx, q.From.ID); err == nil && c.PlayerID != "" {
			if e, err := b.st.DailyRank(ctx, day, c.PlayerID); err == nil {
				stars := strings.Repeat("★", e.Stars) + strings.Repeat("☆", 3-e.Stars)
				desc = fmt.Sprintf(tx.ShareMine, stars, e.Gates)
				text = fmt.Sprintf(tx.ShareDailyMine, num, stars, e.Gates)
			}
		}
		results = append(results, InlineResult{
			Type: "article", ID: fmt.Sprintf("daily-%d", day), Title: title, Description: desc, ThumbnailURL: thumb,
			InputMessageContent: InputTextMessage{MessageText: text, LinkPreviewOptions: noPreview},
			ReplyMarkup:         &Keyboard{InlineKeyboard: [][]Button{{{Text: tx.Solve, URL: b.appLink("daily")}}}},
		})
	}
	results = append(results, InlineResult{
		Type: "article", ID: "invite", Title: tx.ShareInviteTitle, Description: tx.ShareInviteDesc, ThumbnailURL: thumb,
		InputMessageContent: InputTextMessage{MessageText: tx.ShareInvite, LinkPreviewOptions: noPreview},
		ReplyMarkup:         &Keyboard{InlineKeyboard: [][]Button{{{Text: tx.Play, URL: b.appLink("")}}}},
	})
	if err := b.tg.AnswerInlineQuery(ctx, q.ID, results); err != nil {
		b.log.Warn("telegram inline", "err", err)
	}
}
