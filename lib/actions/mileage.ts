'use server';

import { auth } from '@/auth';
import { createMileageLog, getMileageLogById, deleteMileageLog, getVehicleById } from '@/lib/db';
import { CreateMileageLogSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/actions/state';

export async function addMileageLogAction(vehicleId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const vehicle = await getVehicleById(vehicleId, session.user.id);
  if (!vehicle) return { error: 'Vehicle not found' };

  const rawData = {
    vehicle_id: vehicleId,
    logged_at: formData.get('logged_at'),
    mileage: formData.get('mileage') ? parseInt(formData.get('mileage') as string, 10) : undefined,
    notes: formData.get('notes') || null,
  };

  const parsed = CreateMileageLogSchema.safeParse(rawData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await createMileageLog(parsed.data);
    revalidatePath(`/vehicles/${vehicleId}/mileage`);
    revalidatePath(`/vehicles/${vehicleId}`);
  } catch (error) {
    console.error('[addMileageLogAction]', error);
    return { error: 'Failed to save mileage log' };
  }

  return { success: true };
}

export async function deleteMileageLogAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const log = await getMileageLogById(id);
  if (!log) throw new Error('Not found');

  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  await deleteMileageLog(id);
  revalidatePath(`/vehicles/${log.vehicle_id}/mileage`);
  revalidatePath(`/vehicles/${log.vehicle_id}`);
}
