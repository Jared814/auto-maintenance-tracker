import { getVehicleByQrSlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import { MaintenanceSummary } from './maintenance-summary';

export const dynamic = 'force-dynamic';

export default async function PublicVehiclePage({
  params,
}: {
  params: Promise<{ qrSlug: string }>;
}) {
  const { qrSlug } = await params;

  const vehicle = await getVehicleByQrSlug(qrSlug);
  if (!vehicle) notFound();

  return <MaintenanceSummary qrSlug={qrSlug} />;
}
