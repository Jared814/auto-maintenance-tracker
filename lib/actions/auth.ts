'use server';

import bcrypt from 'bcryptjs';
import { createAccount, getAccountByEmail } from '@/lib/db';
import { CreateAccountSchema } from '@/lib/schemas';

export async function registerAccountAction(prevState: any, formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = CreateAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await getAccountByEmail(parsed.data.email);
  if (existing) {
    return { error: 'Email already in use' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  try {
    await createAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    });

    return { success: true, email: parsed.data.email, password: parsed.data.password };
  } catch (error) {
    console.error('[register POST]', error);
    return { error: 'Failed to create account' };
  }
}
