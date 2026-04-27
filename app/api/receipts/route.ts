import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getReceiptsByLogId, createReceipt, getMaintenanceLogById, getVehicleById } from '@/lib/db';
import { CreateReceiptSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('logId');
  if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });

  const log = await getMaintenanceLogById(logId);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
  if (!vehicle) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const receipts = await getReceiptsByLogId(logId);
  return NextResponse.json(receipts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = CreateReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const log = await getMaintenanceLogById(parsed.data.maintenance_log_id);
    if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
    if (!vehicle) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const receipt = await createReceipt({
      ...parsed.data,
      file_name: parsed.data.file_name ?? null,
      file_type: parsed.data.file_type ?? null,
    });

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    console.error('[receipts POST]', error);
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 });
  }
}
