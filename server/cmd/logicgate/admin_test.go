package main

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"testing"

	"logicgate/server/internal/store"
)

func TestAdminCommands(t *testing.T) {
	db := filepath.Join(t.TempDir(), "admin.db")
	st, err := store.Open(db)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	st.CreatePlayer(ctx, "aaa111", []byte("h1"), "Ali")
	st.CreatePlayer(ctx, "bbb222", []byte("h2"), "Vali_50%")
	st.Close()

	var out bytes.Buffer
	if err := cmdPlayers(&out, db, nil); err != nil || !strings.Contains(out.String(), "jami: 2") {
		t.Fatalf("players: %v\n%s", err, out.String())
	}
	out.Reset()
	// LIKE maxsus belgilari (% va _) oddiy matn sifatida qidiriladi.
	if err := cmdPlayers(&out, db, []string{"_50%"}); err != nil || !strings.Contains(out.String(), "bbb222") || !strings.Contains(out.String(), "jami: 1") {
		t.Fatalf("qidiruv: %v\n%s", err, out.String())
	}

	if err := cmdRename(&out, db, []string{"aaa111", "Yangi", "Nom"}); err != nil {
		t.Fatal(err)
	}
	if err := cmdRename(&out, db, []string{"aaa111", "suka"}); err == nil {
		t.Fatal("haqoratli taxallus qabul qilindi")
	}
	if err := cmdRename(&out, db, []string{"yoq999", "Kimdir"}); err == nil || !strings.Contains(err.Error(), "topilmadi") {
		t.Fatalf("yo'q o'yinchi: %v", err)
	}
	out.Reset()
	cmdPlayers(&out, db, []string{"Yangi"})
	if !strings.Contains(out.String(), "Yangi Nom") {
		t.Fatalf("nom o'zgarmadi:\n%s", out.String())
	}

	// delete: faqat id bo'yicha; topilmagan id xato beradi, lekin bori baribir o'chadi.
	if err := cmdDelete(&out, db, nil); err == nil {
		t.Fatal("id'siz delete qabul qilindi")
	}
	out.Reset()
	err = cmdDelete(&out, db, []string{"aaa111", "yoq999"})
	if err == nil || !strings.Contains(err.Error(), "yoq999") || !strings.Contains(out.String(), `o'chirildi: aaa111 "Yangi Nom"`) {
		t.Fatalf("delete: %v\n%s", err, out.String())
	}
	out.Reset()
	cmdPlayers(&out, db, nil)
	if strings.Contains(out.String(), "aaa111") || !strings.Contains(out.String(), "jami: 1") {
		t.Fatalf("o'chirilmadi:\n%s", out.String())
	}
}
