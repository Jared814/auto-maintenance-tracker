import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getVehicleByQrSlug, createFuelLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await request.json();
    const { pin, filled_at, mileage, fuel_quantity, fuel_unit, price_per_unit, notes } = body;

    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    if (!filled_at || mileage == null || !fuel_quantity || !fuel_unit) {
      return NextResponse.json({ error: 'filled_at, mileage, fuel_quantity, and fuel_unit are required' }, { status: 400 });
    }

    const vehicle = await getVehicleByQrSlug(slug);
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const valid = await bcrypt.compare(String(pin), vehicle.qr_pin_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    const log = await createFuelLog({
      vehicle_id: vehicle.id,
      filled_at,
      mileage: Number(mileage),
      fuel_quantity: Number(fuel_quantity),
      fuel_unit,
      price_per_unit: price_per_unit || null,
      notes: notes || null,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('[public/vehicle/fuel]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
