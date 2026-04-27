import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getReceiptById, deleteReceipt, getVehicleById, getMaintenanceLogById } from '@/lib/db';
import { deleteFromR2 } from '@/lib/r2-upload';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const receipt = await getReceiptById(id);
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const log = await getMaintenanceLogById(receipt.maintenance_log_id);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  // Delete from R2 then from DB
  try {
    await deleteFromR2(receipt.r2_key);
  } catch (err) {
    console.warn('[receipts DELETE] R2 delete failed:', err);
  }

  await deleteReceipt(id);
  return NextResponse.json({ success: true });
}
