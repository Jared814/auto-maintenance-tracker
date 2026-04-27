import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import * as schema from './schema';

const client = postgres(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/automotivemaint',
  { idle_timeout: 20, max_lifetime: 60 * 30, connect_timeout: 30, max: 5 }
);

export const db = drizzle(client, { schema });

export async function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}
