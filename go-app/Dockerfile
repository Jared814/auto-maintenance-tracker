# ---- Stage 1: Build --------------------------------------------------------
FROM golang:1.23-alpine AS builder

WORKDIR /app

# No CGO — pure-Go SQLite (modernc.org/sqlite) requires no C toolchain.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o server \
    ./cmd/server

# ---- Stage 2: Minimal runtime image ----------------------------------------
FROM alpine:3.21

WORKDIR /app

# ca-certificates  — required for outbound TLS (Cloudflare R2, etc.)
# tzdata           — required for time-zone-aware formatting in templates
RUN apk add --no-cache ca-certificates tzdata

# Run as an unprivileged user.
RUN adduser -D -u 1001 appuser

# Copy compiled binary.
COPY --from=builder /app/server .

# Copy HTML templates (parsed from disk at startup).
COPY --from=builder /app/templates ./templates

# Persistent data directory (SQLite DB, uploaded files, etc.).
RUN mkdir -p /app/data && chown appuser:appuser /app/data /app/templates

USER appuser

EXPOSE 3000

CMD ["./server"]
