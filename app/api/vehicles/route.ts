import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { auth } from '@/auth';
import { createVehicle, getVehiclesByAccountId } from '@/lib/db';
import { CreateVehicleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vehicles = await getVehiclesByAccountId(session.user.id);
  return NextResponse.json(vehicles);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { pin, ...vehicleData } = parsed.data;
    const qr_slug = nanoid(10);
    const qr_pin_hash = await bcrypt.hash(pin, 10);

    const vehicle = await createVehicle({
      account_id: session.user.id,
      qr_slug,
      qr_pin_hash,
      ...vehicleData,
      make: vehicleData.make ?? null,
      model: vehicleData.model ?? null,
      year: vehicleData.year ?? null,
      vin: vehicleData.vin ?? null,
      license_plate: vehicleData.license_plate ?? null,
      current_mileage: vehicleData.current_mileage ?? null,
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    console.error('[vehicles POST]', error);
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
  }
}
