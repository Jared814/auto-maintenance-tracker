# Vehicle Maintenance Tracker

A multi-family web app to track vehicle maintenance. Each family has an account with one or more vehicles. Every vehicle gets a printable QR code linking to a PIN-protected public summary page showing maintenance status at a glance.

## Features

- **Multi-tenant accounts** — families register with email/password; data is fully isolated between accounts
- **Vehicle management** — track make, model, year, mileage, license plate, and VIN
- **25 built-in maintenance types** — organized by category (engine, transmission, brakes, tires, fluids, filters, belts, electrical) with configurable intervals
- **Maintenance logs** — record service date, mileage, price, shop, and notes for every service event
- **Status badges** — automatic OVERDUE / DUE SOON / OK / NEVER SERVICED calculation based on mileage and date intervals
- **Receipt uploads** — attach photos of receipts via Cloudflare R2 (compressed client-side before upload)
- **QR codes** — each vehicle gets a permanent QR code; scan it to reach a PIN-protected public summary page
- **Print-optimized QR page** — clean printable card with QR code and vehicle name
- **Custom maintenance types** — add account-specific types beyond the built-in 25

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| ORM | Drizzle ORM + `postgres` |
| Database | PostgreSQL |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| File Storage | Cloudflare R2 via `@aws-sdk/client-s3` |
| Forms | react-hook-form + Zod |
| Client state | TanStack React Query |
| Hosting | Railway (Dockerfile builder) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or Docker)

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local — set AUTH_SECRET to any 32+ character string

# 3. Start a local Postgres instance (if you don't have one)
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_DB=automotivemaint \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15-alpine

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first boot the app runs database migrations and seeds the 25 default maintenance types automatically.

### Docker Compose (full stack)

```bash
# Edit docker-compose.yml and set AUTH_SECRET
docker-compose up --build
```

Opens at `http://localhost` via Caddy reverse proxy.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-injected on Railway) |
| `AUTH_SECRET` | Yes | 32+ character random string for JWT signing |
| `AUTH_TRUST_HOST` | Yes | Set to `true` when behind a proxy (Railway, Caddy) |
| `CLOUDFLARE_R2_ACCOUNT_ID` | No | Required for receipt image uploads |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | No | R2 credentials |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | No | R2 credentials |
| `CLOUDFLARE_R2_BUCKET_NAME` | No | R2 bucket name |
| `CLOUDFLARE_R2_PUBLIC_URL` | No | Public URL for the R2 bucket |

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

## Deploying to Railway

1. Create a new Railway project and connect this repository
2. Add a **PostgreSQL** database plugin — `DATABASE_URL` is injected automatically
3. Set environment variables: `AUTH_SECRET`, `AUTH_TRUST_HOST=true`
4. Railway uses the `Dockerfile` and `railway.json` automatically — no extra configuration needed
5. Health check runs at `/api/health`

## Database

Migrations are managed with Drizzle Kit. The app runs migrations automatically on startup via `instrumentation.ts` — no manual migration step needed in production.

```bash
# Regenerate migrations after schema changes
npm run db:generate
```

### Schema

- **accounts** — family accounts (email, bcrypt password hash)
- **vehicles** — vehicles belonging to an account (includes QR slug and PIN hash)
- **maintenance_types** — global defaults + per-account custom types
- **maintenance_logs** — service records (date, mileage, price, shop, notes)
- **receipts** — R2 image references attached to maintenance logs

## How the QR Page Works

1. Each vehicle is assigned a permanent 10-character slug at creation
2. `/vehicles/[id]/qr` displays a printable QR code pointing to `/v/[slug]`
3. Scanning the QR opens a PIN entry form
4. On correct PIN, an HttpOnly cookie is set (valid 30 days) and the maintenance summary loads
5. The summary shows every maintenance type with its last service date/mileage and next due date/mileage, color-coded by status
