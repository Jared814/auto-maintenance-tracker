import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMaintenanceLogById, updateMaintenanceLog, deleteMaintenanceLog, getVehicleById } from '@/lib/db';
import { UpdateMaintenanceLogSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

async function authorizeLog(id: string, accountId: string) {
  const log = await getMaintenanceLogById(id);
  if (!log) return null;
  const vehicle = await getVehicleById(log.vehicle_id, accountId);
  if (!vehicle) return null;
  return log;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const log = await authorizeLog(id, session.user.id);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(log);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const log = await authorizeLog(id, session.user.id);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = UpdateMaintenanceLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await updateMaintenanceLog(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[maintenance-logs PATCH]', error);
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const log = await authorizeLog(id, session.user.id);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteMaintenanceLog(id);
  return NextResponse.json({ success: true });
}
