import { cookies } from 'next/headers';
import { getVehicleByQrSlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import { PinGate } from './pin-gate';
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

  // Check for valid PIN cookie
  const cookieStore = await cookies();
  const cookieKey = `pin_${qrSlug}`;
  const pinCookie = cookieStore.get(cookieKey);
  const isAuthenticated = pinCookie?.value === 'verified';

  if (!isAuthenticated) {
    return <PinGate qrSlug={qrSlug} vehicleName={vehicle.name} />;
  }

  return <MaintenanceSummary qrSlug={qrSlug} />;
}
