# Go Rewrite Implementation Plan

## Motivation
- Single binary deployment (~15 MB image vs ~300 MB Node.js container)
- RAM: ~20–40 MB vs ~150–250 MB for Next.js
- SQLite story is cleaner (pure-Go driver, no native addon)
- Cold start: < 100 ms vs 3–8 s
- No npm, no build pipeline — just `go build`

## Stack
| Concern | Library |
|---|---|
| Router | `github.com/go-chi/chi/v5` |
| PostgreSQL | `github.com/jackc/pgx/v5/stdlib` |
| SQLite | `modernc.org/sqlite` (pure Go, no CGo) |
| SQL scanning | `github.com/jmoiron/sqlx` |
| Sessions | `github.com/gorilla/sessions` + `gorilla/securecookie` |
| Bcrypt | `golang.org/x/crypto/bcrypt` |
| Templates | `html/template` + `embed.FS` |
| QR codes | `github.com/skip2/go-qr` |
| Migrations | `github.com/golang-migrate/migrate/v4` |
| Env | `github.com/joho/godotenv` |
| Nanoid | `github.com/jaevor/go-nanoid` |
| AWS (R2) | `github.com/aws/aws-sdk-go-v2/service/s3` |

## Project Layout
```
go-app/
  cmd/server/main.go          # Entry point: config, DB, router, server
  internal/
    config/config.go          # Env var loading
    db/
      db.go                   # Connection (PG or SQLite), migration runner
      models.go               # Go structs for all 8 tables
      queries.go              # All DB query functions
    auth/
      auth.go                 # Session store, helpers
      handlers.go             # GET/POST /login, /register, /logout
      middleware.go           # RequireAuth, LoadSession
    handlers/
      vehicles.go             # /vehicles and /vehicles/{id}
      maintenance.go          # /vehicles/{id}/maintenance
      fuel.go                 # /vehicles/{id}/fuel
      settings.go             # /settings
      public.go               # /v/{qrSlug} public QR page
      admin.go                # /api/admin/database (download/upload)
    r2/r2.go                  # Presigned URL generation
  templates/
    base.html                 # Base layout with app shell / nav
    login.html
    register.html
    dashboard.html
    vehicles/
      list.html
      new.html
      edit.html
      detail.html
    maintenance/
      list.html
      new.html
      detail.html
      edit.html
    fuel/
      list.html
    settings/
      index.html
      maintenance-types.html
    public/
      vehicle.html            # QR public page
  static/                     # CSS, favicon (served via embed or CDN)
  migrations/                 # Symlink or copy from existing drizzle/drizzle-sqlite
  go.mod
  go.sum
  Dockerfile
  docker-compose.yml
  docker-compose.sqlite.yml
```

## Key Design Decisions

### Auth
- Session cookie (`gorilla/sessions` with `securecookie`)
- bcrypt for passwords (same as current)
- In-memory rate limiting: map[IP]attempts, 5 attempts / 15 min lockout
- Session stores `accountID` string

### DB Dual-Dialect
- `DATABASE_URL` set → pgx (PostgreSQL)
- `DATABASE_URL` absent → modernc/sqlite with `SQLITE_DB_PATH`
- Both dialects use `database/sql` interface via sqlx
- Migrations embedded as files, run on startup

### Templates + HTMX
- Server-rendered HTML via `html/template`
- HTMX for interactive elements: form submissions, inline edits, modal dialogs
- Tailwind via CDN (no build step)
- QR code generation server-side (PNG served as inline data URI)

### R2 Receipts
- Same presigned URL pattern: server generates URL, browser uploads directly
- Reuse existing R2 key format

## Implementation Phases

### Wave 1 (parallel)
- **DB layer**: `internal/db/` — models, queries, connection, migrations
- **Templates**: `templates/` — all HTML pages
- **Auth + Config**: `internal/config/` + `internal/auth/`

### Wave 2 (after Wave 1)
- **Handlers**: `internal/handlers/` — all HTTP handlers using Wave 1 packages

### Wave 3
- **Main + wiring**: `cmd/server/main.go`
- **Dockerfile + compose files**
- Integration testing

## Verification
1. `go build ./...` with zero errors
2. SQLite mode: `go run ./cmd/server` (no `DATABASE_URL`) — boots, seeds, app works
3. PG mode: `DATABASE_URL=postgres://... go run ./cmd/server` — boots and queries PG
4. `docker build -f go-app/Dockerfile .` — produces < 20 MB image
5. Full user flow: register → add vehicle → log maintenance → view QR → public view
