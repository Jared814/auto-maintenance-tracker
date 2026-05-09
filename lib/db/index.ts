import path from 'path';
import fs from 'fs';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const sqlitePath = process.env.SQLITE_DB_PATH ?? './data/maintenance.db';
fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { drizzle } = require('drizzle-orm/better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rawClient: any = new Database(sqlitePath);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: BetterSQLite3Database<any> = drizzle(rawClient);

export async function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), 'drizzle-sqlite');
  migrate(db, { migrationsFolder });
}
