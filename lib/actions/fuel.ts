'use server';

import { auth } from '@/auth';
import { createFuelLog, deleteFuelLog, getFuelLogById, getVehicleById } from '@/lib/db';
import { CreateFuelLogSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/actions/state';

export async function addFuelLogAction(vehicleId: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const vehicle = await getVehicleById(vehicleId, session.user.id);
  if (!vehicle) return { error: 'Vehicle not found' };

  const rawData = {
    vehicle_id: vehicleId,
    filled_at: formData.get('filled_at'),
    mileage: formData.get('mileage') ? parseInt(formData.get('mileage') as string, 10) : undefined,
    fuel_quantity: formData.get('fuel_quantity') ? parseFloat(formData.get('fuel_quantity') as string) : undefined,
    fuel_unit: formData.get('fuel_unit') || 'gallons',
    price_per_unit: formData.get('price_per_unit') || null,
    notes: formData.get('notes') || null,
  };

  const parsed = CreateFuelLogSchema.safeParse(rawData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await createFuelLog(parsed.data);
    revalidatePath(`/vehicles/${vehicleId}/fuel`);
    revalidatePath(`/vehicles/${vehicleId}`);
    return { success: true };
  } catch (error) {
    console.error('[addFuelLogAction]', error);
    return { error: 'Failed to save fill-up' };
  }
}

export async function deleteFuelLogAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const log = await getFuelLogById(id);
  if (!log) throw new Error('Not found');

  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  await deleteFuelLog(id);
  revalidatePath(`/vehicles/${log.vehicle_id}/fuel`);
  revalidatePath(`/vehicles/${log.vehicle_id}`);
}
