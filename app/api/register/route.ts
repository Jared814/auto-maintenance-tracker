import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAccount, getAccountByEmail } from '@/lib/db';
import { CreateAccountSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await getAccountByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const account = await createAccount({ name, email, passwordHash });

    return NextResponse.json({ id: account.id, name: account.name, email: account.email }, { status: 201 });
  } catch (error) {
    console.error('[register]', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
