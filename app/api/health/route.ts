import { NextResponse } from 'next/server';
import { db, isSqlite } from '@/lib/db/index';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // db.execute() is PG-only; SQLite adapter uses .run() synchronously
    if (isSqlite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).run(sql`SELECT 1`);
    } else {
      await db.execute(sql`SELECT 1`);
    }
    return NextResponse.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', database: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
