# Logic Gate — bitta konteyner: Go server API ni ham, frontend fayllarini ham uzatadi.
# Image GitHub Actions'da yig'iladi (serverda kompilyatsiya qilinmaydi — RAM tejaladi).
#
#   docker build -t logic-gate .
#   docker run -p 8080:8080 -v logicgate-data:/data logic-gate

FROM node:24-slim AS web
RUN npm install -g pnpm@12.16.1
WORKDIR /src
COPY levels ./levels
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN cd web && pnpm install --frozen-lockfile
COPY web ./web
RUN cd web && pnpm run build

FROM golang:1.27-alpine AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY levels ./levels
COPY server ./server
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/logicgate ./server/cmd/logicgate \
 && mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=server /out/logicgate /app/logicgate
COPY --from=web /src/web/dist /app/web
# /data — SQLite bazasi. Doimiy volume ulanishi shart, aks holda qayta joylashda ma'lumot yo'qoladi.
COPY --from=server --chown=nonroot:nonroot /out/data /data
ENV LG_ADDR=0.0.0.0:8080 \
    LG_DB=/data/logicgate.db \
    LG_STATIC=/app/web \
    LG_TRUST_PROXY=private \
    LG_BACKUP_DIR=/data/backups \
    GOMEMLIMIT=40MiB
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --start-interval=1s --retries=3 \
  CMD ["/app/logicgate", "health"]
ENTRYPOINT ["/app/logicgate"]
