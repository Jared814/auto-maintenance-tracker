import path from 'path';
import fs from 'fs';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export const isSqlite = !process.env.DATABASE_URL;

// Use PG Drizzle type as the canonical type for `db`.
// At runtime in SQLite mode, this holds a BetterSQLite3Database instance,
// but all standard query methods (.select, .insert, .update, .delete) are
// structurally compatible. `await` on SQLite sync results works transparently.
type DrizzleDb = ReturnType<typeof drizzlePg>;

let _db: DrizzleDb;
let _runMigrations: () => Promise<void>;

if (!isSqlite) {
  const client = postgres(
    process.env.DATABASE_URL!,
    { idle_timeout: 20, max_lifetime: 60 * 30, connect_timeout: 30, max: 2 }
  );
  const pgDb = drizzlePg(client);
  _db = pgDb;
  _runMigrations = async () => {
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    await migratePg(pgDb, { migrationsFolder });
  };
} else {
  const sqlitePath = process.env.SQLITE_DB_PATH ?? './data/maintenance.db';
  fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleSqlite } = require('drizzle-orm/better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate: migrateSqlite } = require('drizzle-orm/better-sqlite3/migrator');
  const client = new Database(sqlitePath);
  const sqliteDb = drizzleSqlite(client);
  _db = sqliteDb as unknown as DrizzleDb;
  _runMigrations = async () => {
    const migrationsFolder = path.join(process.cwd(), 'drizzle-sqlite');
    migrateSqlite(sqliteDb, { migrationsFolder });
  };
}

export const db: DrizzleDb = _db;
export const runMigrations = _runMigrations;
