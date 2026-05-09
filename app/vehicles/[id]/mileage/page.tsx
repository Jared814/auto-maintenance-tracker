import { auth } from '@/auth';
import { getVehicleById, getMileageLogsByVehicleId, getMaxLogMileageByVehicleIds } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { MileageClient } from './mileage-client';

export const dynamic = 'force-dynamic';

export default async function MileagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [vehicle, logs, maxLogMileage] = await Promise.all([
    getVehicleById(id, session.user.id),
    getMileageLogsByVehicleId(id),
    getMaxLogMileageByVehicleIds([id]),
  ]);

  if (!vehicle) notFound();

  const effectiveMileage = Math.max(vehicle.current_mileage ?? 0, maxLogMileage.get(id) ?? 0) || null;

  return <MileageClient vehicle={vehicle} initialLogs={logs} effectiveMileage={effectiveMileage} />;
}
