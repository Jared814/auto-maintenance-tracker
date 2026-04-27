import { auth } from '@/auth';
import { getMaintenanceLogById, getVehicleById } from '@/lib/db';
import { redirect } from 'next/navigation';
import { EditLogForm } from './edit-log-form';

export const dynamic = 'force-dynamic';

export default async function EditMaintenanceLogPage({ params }: { params: Promise<{ id: string; logId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id, logId } = await params;
  
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) redirect('/vehicles');

  const log = await getMaintenanceLogById(logId);
  if (!log || log.vehicle_id !== id) redirect(`/vehicles/${id}/maintenance`);

  return <EditLogForm vehicleId={id} log={log} />;
}
