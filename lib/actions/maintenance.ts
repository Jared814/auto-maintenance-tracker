'use server';

import { auth } from '@/auth';
import { createMaintenanceLog, createMaintenanceType, createReceipt, deleteMaintenanceLog, deleteReceiptsByLogId, getMaintenanceLogById, getMaintenanceTypes, getVehicleById, updateMaintenanceLog } from '@/lib/db';
import { CreateMaintenanceLogSchema, UpdateMaintenanceLogSchema } from '@/lib/schemas';
import { buildR2Key, deleteFromR2, isR2Configured, uploadPhotoToR2 } from '@/lib/r2-upload';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/actions/state';

async function authorizeLog(id: string, accountId: string) {
  const log = await getMaintenanceLogById(id);
  if (!log) return null;
  const vehicle = await getVehicleById(log.vehicle_id, accountId);
  if (!vehicle) return null;
  return log;
}

export async function addMaintenanceLogAction(vehicleId: string, prevState: ActionState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  let maintenance_type_id = formData.get('maintenance_type_id') as string;
  if (maintenance_type_id === 'custom') {
    const customName = (formData.get('custom_service_name') as string)?.trim();
    if (!customName) return { error: 'Service name is required for custom type' };
    const newType = await createMaintenanceType({ name: customName, category: 'other', account_id: session.user.id });
    maintenance_type_id = newType.id;
  }

  const rawData = {
    vehicle_id: vehicleId,
    maintenance_type_id,
    serviced_at: formData.get('serviced_at'),
    mileage_at_service: formData.get('mileage_at_service') ? parseInt(formData.get('mileage_at_service') as string, 10) : undefined,
    next_due_mileage: formData.get('next_due_mileage') ? parseInt(formData.get('next_due_mileage') as string, 10) : null,
    next_due_date: formData.get('next_due_date') || null,
    price_paid: formData.get('price_paid') || null,
    shop: formData.get('shop') || null,
    notes: formData.get('notes') || null,
    description: formData.get('description') || null,
  };

  const parsed = CreateMaintenanceLogSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Verify vehicle belongs to account
  const vehicle = await getVehicleById(parsed.data.vehicle_id, session.user.id);
  if (!vehicle) return { error: 'Vehicle not found' };

  let logId: string;
  try {
    const log = await createMaintenanceLog({
      ...parsed.data,
      next_due_mileage: parsed.data.next_due_mileage ?? null,
      next_due_date: parsed.data.next_due_date ?? null,
      price_paid: parsed.data.price_paid ?? null,
      shop: parsed.data.shop ?? null,
      notes: parsed.data.notes ?? null,
    });
    logId = log.id;
    revalidatePath(`/vehicles/${vehicleId}`);
  } catch (error) {
    console.error('[addMaintenanceLogAction]', error);
    return { error: 'Failed to create log' };
  }

  // Upload photos if R2 is configured and files were attached
  if (isR2Configured()) {
    const photos = formData.getAll('photos') as File[];
    const validPhotos = photos.filter((f) => f && f.size > 0);
    if (validPhotos.length > 0) {
      // Get service type name for the R2 key slug
      const allTypes = await getMaintenanceTypes(session.user.id);
      const serviceType = allTypes.find((t) => t.id === parsed.data.maintenance_type_id);
      const typeSlug = serviceType?.name ?? 'service';
      const serviceDate = parsed.data.serviced_at.slice(0, 10);

      for (let i = 0; i < validPhotos.length; i++) {
        const file = validPhotos[i];
        try {
          const r2Key = buildR2Key({
            vehicleName: vehicle.name,
            serviceDate,
            typeSlug,
            index: i + 1,
            filename: file.name,
          });
          const fileBuffer = Buffer.from(await file.arrayBuffer());
          const publicUrl = await uploadPhotoToR2({ fileBuffer, contentType: file.type || 'image/jpeg', r2Key });
          await createReceipt({
            maintenance_log_id: logId,
            r2_key: r2Key,
            r2_url: publicUrl,
            file_name: file.name,
            file_type: file.type || null,
          });
        } catch (err) {
          console.error('[addMaintenanceLogAction] photo upload failed:', err);
          // Continue — don't fail the whole submission over a photo
        }
      }
    }
  }

  redirect(`/vehicles/${vehicleId}/maintenance/${logId}`);
}

export async function updateMaintenanceLogAction(id: string, prevState: ActionState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const log = await authorizeLog(id, session.user.id);
  if (!log) return { error: 'Not found' };

  const rawData = {
    maintenance_type_id: (formData.get('maintenance_type_id') as string) || undefined,
    serviced_at: formData.get('serviced_at'),
    mileage_at_service: formData.get('mileage_at_service') ? parseInt(formData.get('mileage_at_service') as string, 10) : undefined,
    next_due_mileage: formData.get('next_due_mileage') ? parseInt(formData.get('next_due_mileage') as string, 10) : null,
    next_due_date: formData.get('next_due_date') || null,
    price_paid: formData.get('price_paid') || null,
    shop: formData.get('shop') || null,
    notes: formData.get('notes') || null,
    description: formData.get('description') || null,
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

  // Delete all receipt rows first (single query, removes FK constraint blocker),
  // then delete the log, then clean up R2 best-effort after DB ops succeed.
  const r2Keys = await deleteReceiptsByLogId(id);
  await deleteMaintenanceLog(id);
  await Promise.allSettled(r2Keys.map((key) => deleteFromR2(key)));
  revalidatePath(`/vehicles/${log.vehicle_id}`);
  redirect(`/vehicles/${log.vehicle_id}/maintenance`);
}

export type ImportRow = {
  serviced_at: string;       // ISO YYYY-MM-DD
  mileage_at_service: number;
  description: string;       // original text, used as notes fallback
  typeId: string | null;     // existing type id
  price_paid: string | null;
  notes: string | null;
};

export async function bulkImportMaintenanceAction(
  vehicleId: string,
  rows: ImportRow[],
): Promise<{ imported: number; skipped: number } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const [vehicle, allTypes] = await Promise.all([
    getVehicleById(vehicleId, session.user.id),
    getMaintenanceTypes(session.user.id),
  ]);
  if (!vehicle) return { error: 'Vehicle not found' };

  const typeCategory = new Map(allTypes.map((t) => [t.id, t.category]));

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      let typeId = row.typeId;

      if (!typeId) { skipped++; continue; }

      await createMaintenanceLog({
        vehicle_id: vehicleId,
        maintenance_type_id: typeId,
        serviced_at: row.serviced_at,
        mileage_at_service: row.mileage_at_service,
        next_due_mileage: null,
        next_due_date: null,
        price_paid: row.price_paid,
        shop: null,
        notes: row.notes ?? row.description,
        description: typeCategory.get(typeId) === 'other' ? row.description : null,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/maintenance`);
  return { imported, skipped };
}
