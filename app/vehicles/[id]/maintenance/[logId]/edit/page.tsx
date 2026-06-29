import { auth } from '@/auth';
import { getMaintenanceLogById, getVehicleById, getMaintenanceTypes } from '@/lib/db';
import { redirect } from 'next/navigation';
import { EditLogForm } from './edit-log-form';

export const dynamic = 'force-dynamic';

export default async function EditMaintenanceLogPage({ params }: { params: Promise<{ id: string; logId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id, logId } = await params;
  
  const [vehicle, log, types] = await Promise.all([
    getVehicleById(id, session.user.id),
    getMaintenanceLogById(logId),
    getMaintenanceTypes(session.user.id),
  ]);
  if (!vehicle) redirect('/vehicles');
  if (!log || log.vehicle_id !== id) redirect(`/vehicles/${id}/maintenance`);

  return <EditLogForm vehicleId={id} log={log} types={types} />;
}
