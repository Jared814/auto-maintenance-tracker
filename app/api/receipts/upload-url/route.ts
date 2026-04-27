import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMaintenanceLogById, getVehicleById } from '@/lib/db';
import { generateUploadUrl } from '@/lib/r2-upload';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { filename, contentType, logId } = await request.json();
    if (!filename || !contentType || !logId) {
      return NextResponse.json({ error: 'filename, contentType, and logId are required' }, { status: 400 });
    }

    // Verify the log belongs to this account
    const log = await getMaintenanceLogById(logId);
    if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

    const vehicle = await getVehicleById(log.vehicle_id, session.user.id);
    if (!vehicle) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const result = await generateUploadUrl({
      accountId: session.user.id,
      vehicleId: log.vehicle_id,
      logId,
      filename,
      contentType,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[receipts/upload-url]', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
