'use server';

import { auth } from '@/auth';
import { createMaintenanceType, deleteMaintenanceType, updateMaintenanceType } from '@/lib/db';
import { CreateMaintenanceTypeSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/actions/state';

export async function addMaintenanceTypeAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const rawData = {
    name: formData.get('name'),
    category: formData.get('category'),
    default_interval_miles: formData.get('default_interval_miles') ? parseInt(formData.get('default_interval_miles') as string, 10) : null,
    default_interval_months: formData.get('default_interval_months') ? parseInt(formData.get('default_interval_months') as string, 10) : null,
  };

  const parsed = CreateMaintenanceTypeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createMaintenanceType({
      ...parsed.data,
      default_interval_miles: parsed.data.default_interval_miles ?? null,
      default_interval_months: parsed.data.default_interval_months ?? null,
      account_id: session.user.id,
    });

    revalidatePath('/settings/maintenance-types');
    return { success: true };
  } catch (error) {
    console.error('[addMaintenanceTypeAction]', error);
    return { error: 'Failed to create type' };
  }
}

export async function updateMaintenanceTypeAction(id: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const rawData = {
    name: formData.get('name'),
    category: formData.get('category'),
    default_interval_miles: formData.get('default_interval_miles') ? parseInt(formData.get('default_interval_miles') as string, 10) : null,
    default_interval_months: formData.get('default_interval_months') ? parseInt(formData.get('default_interval_months') as string, 10) : null,
  };

  const parsed = CreateMaintenanceTypeSchema.partial().safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const type = await updateMaintenanceType(id, session.user.id, parsed.data);
    if (!type) return { error: 'Not found or not editable' };

    revalidatePath('/settings/maintenance-types');
    return { success: true };
  } catch (error) {
    console.error('[updateMaintenanceTypeAction]', error);
    return { error: 'Failed to update type' };
  }
}

export async function deleteMaintenanceTypeAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await deleteMaintenanceType(id, session.user.id);
  revalidatePath('/settings/maintenance-types');
}
