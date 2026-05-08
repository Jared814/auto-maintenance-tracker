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

  const r2Configured = !!(process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_BUCKET_NAME);

  return <NewLogForm vehicleId={id} types={types} r2Configured={r2Configured} />;
}
