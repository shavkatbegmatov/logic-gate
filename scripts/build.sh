#!/usr/bin/env bash
# Testlar + release yig'ish: dist/release/{bin/logicgate, web/, deploy/}.
#   bash scripts/build.sh            — linux/amd64
#   GOARCH=arm64 bash scripts/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REL="$ROOT/dist/release"
GOARCH="${GOARCH:-amd64}"

# Windows'da winget o'rnatgan Go Git Bash PATH'ida bo'lmasligi mumkin.
if ! command -v go >/dev/null 2>&1 && [ -x "/c/Program Files/Go/bin/go.exe" ]; then
  export PATH="$PATH:/c/Program Files/Go/bin"
fi

VERSION="$(git -C "$ROOT" describe --always --dirty 2>/dev/null || echo dev)"

echo "==> Testlar"
(cd "$ROOT" && go vet ./... && go test ./...)
(cd "$ROOT/web" && npm test --silent)

echo "==> Frontend"
(cd "$ROOT/web" && npm run build --silent)

echo "==> Backend (linux/$GOARCH, $VERSION)"
rm -rf "$REL"
mkdir -p "$REL/bin" "$REL/deploy"
(cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH="$GOARCH" \
  go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$REL/bin/logicgate" ./server/cmd/logicgate)
cp -r "$ROOT/web/dist" "$REL/web"
cp "$ROOT/deploy/"{setup.sh,install.sh,backup.sh,logicgate.service,nginx.conf,.env.example} "$REL/deploy/"

echo "==> Tayyor: $REL"
du -sh "$REL/bin/logicgate" "$REL/web"
