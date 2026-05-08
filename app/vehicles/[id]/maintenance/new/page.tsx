import { auth } from '@/auth';
import { getMaintenanceTypes, getVehicleById, getMaxLogMileageByVehicleIds } from '@/lib/db';
import { redirect } from 'next/navigation';
import { NewLogForm } from './new-log-form';

export const dynamic = 'force-dynamic';

export default async function NewMaintenanceLogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [types, vehicle, maxLogMileage] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getVehicleById(id, session.user.id),
    getMaxLogMileageByVehicleIds([id]),
  ]);

  const defaultMileage = Math.max(vehicle?.current_mileage ?? 0, maxLogMileage.get(id) ?? 0) || null;

  const r2Configured = !!(process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_BUCKET_NAME);

  return <NewLogForm vehicleId={id} types={types} r2Configured={r2Configured} defaultMileage={defaultMileage} />;
}
