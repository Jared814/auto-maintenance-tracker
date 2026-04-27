'use server';

import { auth } from '@/auth';
import { createVehicle, deleteVehicle, getVehicleById, updateVehicle } from '@/lib/db';
import { CreateVehicleSchema, UpdateVehicleSchema } from '@/lib/schemas';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/actions/state';

export async function addVehicleAction(prevState: ActionState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const rawData = {
    name: formData.get('name'),
    make: formData.get('make') || null,
    model: formData.get('model') || null,
    year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : null,
    vin: formData.get('vin') || null,
    license_plate: formData.get('license_plate') || null,
    units: formData.get('units') || 'miles',
    current_mileage: formData.get('current_mileage') ? parseInt(formData.get('current_mileage') as string, 10) : null,
    pin: formData.get('pin'),
  };

  const parsed = CreateVehicleSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { pin, ...vehicleData } = parsed.data;
  const qr_slug = nanoid(10);
  const qr_pin_hash = await bcrypt.hash(pin, 10);

  try {
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

    revalidatePath('/vehicles');
  } catch (error) {
    console.error('[addVehicleAction]', error);
    return { error: 'Failed to create vehicle' };
  }

  redirect('/vehicles');
}

export async function updateVehicleAction(id: string, prevState: ActionState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const existing = await getVehicleById(id, session.user.id);
  if (!existing) {
    return { error: 'Not found' };
  }

  const rawData = {
    name: formData.get('name'),
    make: formData.get('make') || null,
    model: formData.get('model') || null,
    year: formData.get('year') ? parseInt(formData.get('year') as string, 10) : null,
    vin: formData.get('vin') || null,
    license_plate: formData.get('license_plate') || null,
    units: formData.get('units') || 'miles',
    current_mileage: formData.get('current_mileage') ? parseInt(formData.get('current_mileage') as string, 10) : null,
    pin: formData.get('pin') || undefined,
  };

  const parsed = UpdateVehicleSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
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

  try {
    await updateVehicle(id, session.user.id, updates);
    revalidatePath(`/vehicles/${id}`);
    revalidatePath('/vehicles');
  } catch (error) {
    console.error('[updateVehicleAction]', error);
    return { error: 'Failed to update vehicle' };
  }

  redirect(`/vehicles/${id}`);
}

export async function deleteVehicleAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const existing = await getVehicleById(id, session.user.id);
  if (!existing) {
    throw new Error('Not found');
  }

  await deleteVehicle(id, session.user.id);
  revalidatePath('/vehicles');
  redirect('/vehicles');
}
