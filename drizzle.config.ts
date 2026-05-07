import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.pg.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/automotivemaint',
  },
} satisfies Config;
