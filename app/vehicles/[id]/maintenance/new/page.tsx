import { auth } from '@/auth';
import { getMaintenanceTypes } from '@/lib/db';
import { redirect } from 'next/navigation';
import { NewLogForm } from './new-log-form';

export const dynamic = 'force-dynamic';

export default async function NewMaintenanceLogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const types = await getMaintenanceTypes(session.user.id);

  return <NewLogForm vehicleId={id} types={types} />;
}
