import { auth } from '@/auth';
import { getVehicleById } from '@/lib/db';
import { redirect } from 'next/navigation';
import { EditVehicleForm } from './edit-vehicle-form';

export const dynamic = 'force-dynamic';

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);

  if (!vehicle) {
    redirect('/vehicles');
  }

  return <EditVehicleForm vehicle={vehicle} />;
}
