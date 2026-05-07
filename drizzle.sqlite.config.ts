import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.sqlite.ts',
  out: './drizzle-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH ?? './data/maintenance.db',
  },
} satisfies Config;
