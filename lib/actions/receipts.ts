'use server';

import { auth } from '@/auth';
import { createReceipt, deleteReceipt, getMaintenanceLogById, getReceiptById, getVehicleById } from '@/lib/db';
import { deleteFromR2, generateUploadUrl } from '@/lib/r2-upload';
import { CreateReceiptSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';

export async function generateUploadUrlAction(filename: string, contentType: string, logId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  if (!filename || !contentType || !logId) {
    throw new Error('Missing required fields');
  }

  const log = await getMaintenanceLogById(logId);
  if (!log) throw new Error('Log not found');

  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  return generateUploadUrl({
    accountId: session.user.id,
    vehicleId: log.vehicle_id,
    logId,
    filename,
    contentType,
  });
}

export async function saveReceiptAction(data: {
  maintenance_log_id: string;
  r2_key: string;
  r2_url: string;
  file_name?: string | null;
  file_type?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const parsed = CreateReceiptSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const log = await getMaintenanceLogById(parsed.data.maintenance_log_id);
  if (!log) throw new Error('Log not found');
  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  const receipt = await createReceipt({
    ...parsed.data,
    file_name: parsed.data.file_name ?? null,
    file_type: parsed.data.file_type ?? null,
  });

  revalidatePath(`/vehicles/${log.vehicle_id}/maintenance/${log.id}`);
  return receipt;
}

export async function deleteReceiptAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const receipt = await getReceiptById(id);
  if (!receipt) throw new Error('Receipt not found');

  const log = await getMaintenanceLogById(receipt.maintenance_log_id);
  if (!log) throw new Error('Log not found');

  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) throw new Error('Unauthorized');

  await deleteFromR2(receipt.r2_key);
  await deleteReceipt(id);

  revalidatePath(`/vehicles/${log.vehicle_id}/maintenance/${log.id}`);
}
