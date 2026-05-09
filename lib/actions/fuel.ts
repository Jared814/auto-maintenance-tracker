'use server';

import { auth } from '@/auth';
import { createFuelLog, createFuelReceipt, deleteFuelLog, deleteFuelReceipt, getFuelLogById, getFuelReceiptsByLogId, getVehicleById } from '@/lib/db';
import { CreateFuelLogSchema } from '@/lib/schemas';
import { buildFuelR2Key, deleteFromR2, isR2Configured, uploadPhotoToR2 } from '@/lib/r2-upload';
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
    total_cost: formData.get('total_cost') || null,
    notes: formData.get('notes') || null,
  };

  const parsed = CreateFuelLogSchema.safeParse(rawData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let logId: string;
  try {
    const log = await createFuelLog(parsed.data);
    logId = log.id;
    revalidatePath(`/vehicles/${vehicleId}/fuel`);
    revalidatePath(`/vehicles/${vehicleId}`);
  } catch (error) {
    console.error('[addFuelLogAction]', error);
    return { error: 'Failed to save fill-up' };
  }

  // Upload photos if R2 is configured and files were attached
  if (isR2Configured()) {
    const photos = formData.getAll('photos') as File[];
    const validPhotos = photos.filter((f) => f && f.size > 0);
    const date = (parsed.data.filled_at as string).slice(0, 10);

    for (const file of validPhotos) {
      try {
        const r2Key = buildFuelR2Key({ vehicleName: vehicle.name, date, filename: file.name });
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const publicUrl = await uploadPhotoToR2({ fileBuffer, contentType: file.type || 'image/jpeg', r2Key });
        await createFuelReceipt({ fuel_log_id: logId, r2_key: r2Key, r2_url: publicUrl, file_name: file.name, file_type: file.type || null });
      } catch (err) {
        console.error('[addFuelLogAction] photo upload failed:', err);
      }
    }
  }

  return { success: true };
}

export async function deleteFuelLogAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const log = await getFuelLogById(id);
  if (!log) throw new Error('Not found');

  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  // Delete associated receipts from R2 and DB
  const fuelReceiptRows = await getFuelReceiptsByLogId(id);
  await Promise.allSettled(fuelReceiptRows.map((r) => deleteFromR2(r.r2_key)));
  await Promise.allSettled(fuelReceiptRows.map((r) => deleteFuelReceipt(r.id)));

  await deleteFuelLog(id);
  revalidatePath(`/vehicles/${log.vehicle_id}/fuel`);
  revalidatePath(`/vehicles/${log.vehicle_id}`);
}

export async function deleteFuelReceiptAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const receipt = await deleteFuelReceipt(id);
  if (!receipt) throw new Error('Not found');

  const log = await getFuelLogById(receipt.fuel_log_id);
  if (log) {
    const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
    if (!vehicle) throw new Error('Unauthorized');
  }

  try { await deleteFromR2(receipt.r2_key); } catch { /* best effort */ }
  revalidatePath(`/vehicles/${log?.vehicle_id}/fuel`);
}
