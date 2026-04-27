import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehicleById } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { QrCodeDisplay } from './qr-display';

export const dynamic = 'force-dynamic';

export default async function VehicleQrPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) notFound();

  // Build the full QR URL using the request host — use a relative path for display,
  // actual URL is constructed client-side from window.location.origin
  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="no-print flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">QR Code</h1>
        </div>

        <QrCodeDisplay vehicle={vehicle} />
      </div>
    </AppShell>
  );
}
