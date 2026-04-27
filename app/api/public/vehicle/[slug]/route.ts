import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPublicVehicleData } from '@/lib/db';
import { calculateMaintenanceStatus } from '@/lib/maintenance-status';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { pin } = await request.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });

    const data = await getPublicVehicleData(slug);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const valid = await bcrypt.compare(String(pin), data.vehicle.qr_pin_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('[public/vehicle/verify]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicVehicleData(slug);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { vehicle, maintenanceTypes, logs } = data;

  // Build status for each maintenance type
  const statusByType = maintenanceTypes.map((type) => {
    const latestLog = logs
      .filter((l) => l.maintenance_type_id === type.id)
      .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0] ?? null;

    const statusResult = calculateMaintenanceStatus(latestLog, type, vehicle.current_mileage);

    return {
      type,
      latestLog,
      ...statusResult,
    };
  });

  return NextResponse.json({
    vehicle: {
      id: vehicle.id,
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      units: vehicle.units,
      current_mileage: vehicle.current_mileage,
    },
    statusByType,
  });
}
