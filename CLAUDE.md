# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on 0.0.0.0:3000
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Regenerate Drizzle migrations after schema changes
npx tsc --noEmit     # Type check without building
```

No test suite is configured.

## Architecture

### Multi-tenant auth model
Each family has one **account** row (email + bcrypt password). `auth.ts` at the root implements NextAuth v5 Credentials provider with in-memory rate limiting (5 attempts / 15-min lockout). The JWT stores `accountId` as `token.accountId`, surfaced as `session.user.id`. All DB queries that touch user-owned data must filter by `account_id` to prevent cross-tenant data leakage.

### DB layer
- `lib/db/schema.ts` — Drizzle table definitions (5 tables: `accounts`, `vehicles`, `maintenance_types`, `maintenance_logs`, `receipts`)
- `lib/db/index.ts` — Drizzle client, pool max 5
- `lib/db.ts` — all DB query functions + `initDb()` (runs migrations + seeds 25 maintenance types on first boot)
- `instrumentation.ts` — Next.js instrumentation hook that calls `initDb()` with 5-retry on startup; only runs in Node.js runtime, not during build

After any schema change, run `npm run db:generate` to regenerate `drizzle/` migrations. The app applies them automatically on next boot.

### Public QR flow
Each vehicle has a permanent `qr_slug` (nanoid 10-char) and a `qr_pin_hash` (bcrypt). The QR URL is `/v/[qrSlug]`:
- **Viewing** — no auth required; summary loads directly
- **Logging a service** — user taps "Log Service", enters the vehicle PIN inline; `POST /api/public/vehicle/[slug]/log` verifies the PIN server-side before creating the log

### Maintenance status logic
`lib/maintenance-status.ts` computes OVERDUE / DUE_SOON / OK / NEVER_SERVICED / UNKNOWN for a given `(latestLog, maintenanceType, currentMileage)` triple. DUE_SOON = within 500 miles or 30 days of the threshold.

### R2 receipt uploads
Three-step flow: client compresses image (`browser-image-compression`, max 1 MB / 1920 px) → `POST /api/receipts/upload-url` returns presigned PUT URL + public URL + r2Key → client PUTs directly to R2 → client `POST /api/receipts` saves the DB row. Delete calls `deleteFromR2(r2Key)` then removes the DB row. Implementation in `lib/r2-upload.ts`.

### Key conventions
- All IDs are `nanoid()` strings, stored as `text`
- Dates/timestamps stored as ISO strings (`text` columns), not native Postgres date types
- `z.coerce` is avoided in Zod schemas used with react-hook-form; use `{ valueAsNumber: true }` on number `register()` calls instead
- Zod v4: use `.issues[0].message` not `.errors[0].message` on `ZodError`
- `resolver: zodResolver(Schema) as never` works around a type mismatch between Zod v4 and `@hookform/resolvers`
- Path alias `@/*` maps to the repo root (no `src/` directory)
- `maintenance_types` has no `created_at` column (unlike other tables)
