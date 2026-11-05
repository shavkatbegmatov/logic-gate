package main

// Moderatsiya uchun administrator buyruqlari. Konteynerda shell yo'q, shuning uchun:
//
//	docker exec <konteyner> /app/logicgate players [qidiruv]
//	docker exec <konteyner> /app/logicgate rename <id> <yangi taxallus>

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
	"time"

	"logicgate/server/internal/nickname"
	"logicgate/server/internal/store"
)

func cmdPlayers(out io.Writer, dbPath string, args []string) error {
	st, err := store.Open(dbPath)
	if err != nil {
		return err
	}
	defer st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	rows, err := st.ListPlayers(ctx, strings.Join(args, " "), 200)
	if err != nil {
		return err
	}
	tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "ID\tTAXALLUS\t★\tDARAJA\tYARATILGAN")
	for _, r := range rows {
		fmt.Fprintf(tw, "%s\t%s\t%d\t%d\t%s\n", r.ID, r.Nickname, r.Stars, r.Solved, r.Created.UTC().Format("2006-01-02"))
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	fmt.Fprintf(out, "jami: %d\n", len(rows))
	return nil
}

func cmdRename(out io.Writer, dbPath string, args []string) error {
	if len(args) < 2 {
		return errors.New("foydalanish: logicgate rename <id> <yangi taxallus>")
	}
	nick, err := nickname.Clean(strings.Join(args[1:], " "))
	if err != nil {
		return fmt.Errorf("taxallus yaroqsiz: %w", err)
	}
	st, err := store.Open(dbPath)
	if err != nil {
		return err
	}
	defer st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := st.RenamePlayer(ctx, args[0], nick); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return fmt.Errorf("o'yinchi %q topilmadi", args[0])
		}
		return err
	}
	fmt.Fprintf(out, "%s → %q (reyting 15 soniya ichida yangilanadi)\n", args[0], nick)
	return nil
}
