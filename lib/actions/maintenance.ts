'use server';

import { auth } from '@/auth';
import { createMaintenanceLog, deleteMaintenanceLog, getMaintenanceLogById, getVehicleById, updateMaintenanceLog } from '@/lib/db';
import { CreateMaintenanceLogSchema, UpdateMaintenanceLogSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function authorizeLog(id: string, accountId: string) {
  const log = await getMaintenanceLogById(id);
  if (!log) return null;
  const vehicle = await getVehicleById(log.vehicle_id, accountId);
  if (!vehicle) return null;
  return log;
}

export async function addMaintenanceLogAction(vehicleId: string, prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const rawData = {
    vehicle_id: vehicleId,
    maintenance_type_id: formData.get('maintenance_type_id'),
    serviced_at: formData.get('serviced_at'),
    mileage_at_service: formData.get('mileage_at_service') ? parseInt(formData.get('mileage_at_service') as string, 10) : undefined,
    next_due_mileage: formData.get('next_due_mileage') ? parseInt(formData.get('next_due_mileage') as string, 10) : null,
    next_due_date: formData.get('next_due_date') || null,
    price_paid: formData.get('price_paid') || null,
    shop: formData.get('shop') || null,
    notes: formData.get('notes') || null,
  };

  const parsed = CreateMaintenanceLogSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Verify vehicle belongs to account
  const vehicle = await getVehicleById(parsed.data.vehicle_id, session.user.id);
  if (!vehicle) return { error: 'Vehicle not found' };

  try {
    await createMaintenanceLog({
      ...parsed.data,
      next_due_mileage: parsed.data.next_due_mileage ?? null,
      next_due_date: parsed.data.next_due_date ?? null,
      price_paid: parsed.data.price_paid ?? null,
      shop: parsed.data.shop ?? null,
      notes: parsed.data.notes ?? null,
    });

    revalidatePath(`/vehicles/${vehicleId}`);
  } catch (error) {
    console.error('[addMaintenanceLogAction]', error);
    return { error: 'Failed to create log' };
  }

  redirect(`/vehicles/${vehicleId}/maintenance`);
}

export async function updateMaintenanceLogAction(id: string, prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const log = await authorizeLog(id, session.user.id);
  if (!log) return { error: 'Not found' };

  const rawData = {
    serviced_at: formData.get('serviced_at'),
    mileage_at_service: formData.get('mileage_at_service') ? parseInt(formData.get('mileage_at_service') as string, 10) : undefined,
    next_due_mileage: formData.get('next_due_mileage') ? parseInt(formData.get('next_due_mileage') as string, 10) : null,
    next_due_date: formData.get('next_due_date') || null,
    price_paid: formData.get('price_paid') || null,
    shop: formData.get('shop') || null,
    notes: formData.get('notes') || null,
  };

  const parsed = UpdateMaintenanceLogSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateMaintenanceLog(id, parsed.data);
    revalidatePath(`/vehicles/${log.vehicle_id}`);
    revalidatePath(`/vehicles/${log.vehicle_id}/maintenance/${id}`);
  } catch (error) {
    console.error('[updateMaintenanceLogAction]', error);
    return { error: 'Failed to update log' };
  }

  redirect(`/vehicles/${log.vehicle_id}/maintenance/${id}`);
}

export async function deleteMaintenanceLogAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const log = await authorizeLog(id, session.user.id);
  if (!log) throw new Error('Not found');

  await deleteMaintenanceLog(id);
  revalidatePath(`/vehicles/${log.vehicle_id}`);
  redirect(`/vehicles/${log.vehicle_id}/maintenance`);
}
