import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getVehicleByQrSlug, createMaintenanceLog, createMaintenanceType } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await request.json();
    const { pin, maintenance_type_id: rawTypeId, custom_service_name, serviced_at, mileage_at_service, next_due_mileage, next_due_date, price_paid, shop, notes } = body;

    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    if (!rawTypeId || !serviced_at || mileage_at_service == null) {
      return NextResponse.json({ error: 'maintenance_type_id, serviced_at, and mileage_at_service are required' }, { status: 400 });
    }
    if (rawTypeId === 'custom' && !custom_service_name?.trim()) {
      return NextResponse.json({ error: 'custom_service_name is required for custom service type' }, { status: 400 });
    }

    const vehicle = await getVehicleByQrSlug(slug);
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const valid = await bcrypt.compare(String(pin), vehicle.qr_pin_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    let maintenance_type_id = rawTypeId;
    if (rawTypeId === 'custom') {
      const newType = await createMaintenanceType({
        name: custom_service_name.trim(),
        category: 'other',
        account_id: vehicle.account_id,
      });
      maintenance_type_id = newType.id;
    }

    const log = await createMaintenanceLog({
      vehicle_id: vehicle.id,
      maintenance_type_id,
      serviced_at,
      mileage_at_service: Number(mileage_at_service),
      next_due_mileage: next_due_mileage ? Number(next_due_mileage) : null,
      next_due_date: next_due_date || null,
      price_paid: price_paid || null,
      shop: shop || null,
      notes: notes || null,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('[public/vehicle/log]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
