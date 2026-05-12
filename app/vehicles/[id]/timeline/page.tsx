import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import {
  getVehicleById,
  getMaintenanceTypes,
  getMaintenanceLogsByVehicleId,
  getFuelLogsByVehicleId,
  getMileageLogsByVehicleId,
} from '@/lib/db';
import { computeEconomy } from '@/lib/fuel-economy';
import { TimelineClient } from './timeline-client';

export const dynamic = 'force-dynamic';

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) notFound();

  const [allTypes, maintenanceLogs, fuelLogs, mileageLogs] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getMaintenanceLogsByVehicleId(id),
    getFuelLogsByVehicleId(id),
    getMileageLogsByVehicleId(id),
  ]);

  const maintenanceTypeMap: Record<string, string> = {};
  for (const t of allTypes) {
    maintenanceTypeMap[t.id] = t.name;
  }

  const economyPoints = computeEconomy(fuelLogs, vehicle.units);

  return (
    <TimelineClient
      vehicle={{ id: vehicle.id, name: vehicle.name, units: vehicle.units }}
      fuelLogs={fuelLogs}
      maintenanceLogs={maintenanceLogs}
      mileageLogs={mileageLogs}
      maintenanceTypeMap={maintenanceTypeMap}
      economyPoints={economyPoints}
    />
  );
}
