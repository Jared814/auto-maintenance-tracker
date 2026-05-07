# ---- Stage 1: Build --------------------------------------------------------
# Railway uses the repo root as build context, so all COPY paths are
# relative to the repo root (go-app/ prefix).
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go-app/go.mod go-app/go.sum ./
RUN go mod download

COPY go-app/ .

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

# Persistent data directory (SQLite DB).
RUN mkdir -p /app/data && chown appuser:appuser /app/data /app/templates

USER appuser

EXPOSE 3000

CMD ["./server"]
