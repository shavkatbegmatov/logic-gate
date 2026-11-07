// Package web — frontend fayllarini to'g'ridan-to'g'ri Go'dan uzatish (Nginx bo'lmagan muhit uchun,
// masalan Docker + Traefik). Build vaqtida tayyorlangan .gz fayllar ishlatiladi: CPU sarflanmaydi.
package web

import (
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// CSP va boshqa xavfsizlik sarlavhalari deploy/nginx.conf dagi bilan bir xil.
var securityHeaders = map[string]string{
	"X-Content-Type-Options":  "nosniff",
	"X-Frame-Options":         "DENY",
	"Referrer-Policy":         "strict-origin-when-cross-origin",
	"Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}

func init() {
	// Go'ning standart ro'yxatida yo'q; distroless'da /etc/mime.types ham yo'q.
	mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

// Static dir papkasidagi fayllarni uzatadi. Topilmagan yo'llar uchun index.html qaytariladi.
func Static(dir string) http.Handler {
	root := os.DirFS(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if info, err := fs.Stat(root, name); name == "" || err != nil || info.IsDir() {
			name = "index.html"
		}

		h := w.Header()
		for k, v := range securityHeaders {
			h.Set(k, v)
		}
		// Fayl nomida xesh bor — abadiy keshlash mumkin; qolganlari har safar tekshiriladi.
		if strings.HasPrefix(name, "assets/") {
			h.Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			h.Set("Cache-Control", "no-cache")
		}

		file := name
		if acceptsGzip(r) {
			if _, err := fs.Stat(root, name+".gz"); err == nil {
				file = name + ".gz"
				h.Set("Content-Encoding", "gzip")
			}
		}
		h.Add("Vary", "Accept-Encoding")
		if ct := mime.TypeByExtension(filepath.Ext(name)); ct != "" {
			h.Set("Content-Type", ct)
		}

		f, err := root.Open(file)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		info, err := f.Stat()
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		http.ServeContent(w, r, name, info.ModTime(), f.(readSeeker))
	})
}

type readSeeker interface {
	Read([]byte) (int, error)
	Seek(int64, int) (int64, error)
}

func acceptsGzip(r *http.Request) bool {
	for _, part := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		enc, q, _ := strings.Cut(strings.TrimSpace(part), ";")
		if strings.EqualFold(strings.TrimSpace(enc), "gzip") && strings.TrimSpace(q) != "q=0" {
			return true
		}
	}
	return false
}
