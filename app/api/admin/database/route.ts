import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import path from 'path';
import fs from 'fs';

const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function getSqlitePath() {
  return path.resolve(process.env.SQLITE_DB_PATH ?? './data/maintenance.db');
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbPath = getSqlitePath();
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
  }

  const stat = fs.statSync(dbPath);
  const fileBuffer = fs.readFileSync(dbPath);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="automaint-${date}.db"`,
      'Content-Length': String(stat.size),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Validate SQLite magic bytes
  if (fileBuffer.length < 16 || !fileBuffer.subarray(0, 16).equals(SQLITE_MAGIC)) {
    return NextResponse.json({ error: 'Invalid SQLite database file' }, { status: 400 });
  }

  const dbPath = getSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Backup existing database before replacing
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbPath + '.bak');
  }

  fs.writeFileSync(dbPath, fileBuffer);

  return NextResponse.json({
    message: 'Database replaced successfully. Restart the server to use the new data.',
  });
}
