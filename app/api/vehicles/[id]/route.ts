import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { getVehicleById, updateVehicle, deleteVehicle } from '@/lib/db';
import { UpdateVehicleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(vehicle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getVehicleById(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { pin, ...updateData } = parsed.data;
    const updates: Parameters<typeof updateVehicle>[2] = {
      ...updateData,
      make: updateData.make ?? null,
      model: updateData.model ?? null,
      year: updateData.year ?? null,
      vin: updateData.vin ?? null,
      license_plate: updateData.license_plate ?? null,
    };

    if (pin) {
      updates.qr_pin_hash = await bcrypt.hash(pin, 10);
    }

    const vehicle = await updateVehicle(id, session.user.id, updates);
    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('[vehicles PATCH]', error);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getVehicleById(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteVehicle(id, session.user.id);
  return NextResponse.json({ success: true });
}
