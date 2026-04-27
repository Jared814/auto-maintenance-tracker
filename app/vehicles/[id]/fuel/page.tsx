import { auth } from '@/auth';
import { getVehicleById, getFuelLogsByVehicleId } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { FuelClient } from './fuel-client';

export const dynamic = 'force-dynamic';

export default async function FuelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [vehicle, fuelLogs] = await Promise.all([
    getVehicleById(id, session.user.id),
    getFuelLogsByVehicleId(id),
  ]);

  if (!vehicle) notFound();

  return <FuelClient vehicle={vehicle} initialLogs={fuelLogs} />;
}
