import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getVehicleById, getMaintenanceLogsByVehicleId, createMaintenanceLog } from '@/lib/db';
import { CreateMaintenanceLogSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const vehicleId = searchParams.get('vehicleId');
  if (!vehicleId) return NextResponse.json({ error: 'vehicleId required' }, { status: 400 });

  // Verify vehicle belongs to account
  const vehicle = await getVehicleById(vehicleId, session.user.id);
  if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logs = await getMaintenanceLogsByVehicleId(vehicleId);
  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = CreateMaintenanceLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Verify vehicle belongs to account
    const vehicle = await getVehicleById(parsed.data.vehicle_id, session.user.id);
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const log = await createMaintenanceLog({
      ...parsed.data,
      next_due_mileage: parsed.data.next_due_mileage ?? null,
      next_due_date: parsed.data.next_due_date ?? null,
      price_paid: parsed.data.price_paid ?? null,
      shop: parsed.data.shop ?? null,
      notes: parsed.data.notes ?? null,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('[maintenance-logs POST]', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
}
