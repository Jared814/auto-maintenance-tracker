import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getVehicleById, getMaintenanceTypes } from '@/lib/db';
import { ImportClient } from './import-client';

export const dynamic = 'force-dynamic';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [vehicle, types] = await Promise.all([
    getVehicleById(id, session.user.id),
    getMaintenanceTypes(session.user.id),
  ]);

  if (!vehicle) notFound();

  return <ImportClient vehicle={vehicle} maintenanceTypes={types} />;
}
