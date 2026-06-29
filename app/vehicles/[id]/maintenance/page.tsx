import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehicleById, getMaintenanceLogsByVehicleId, getMaintenanceTypes } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Plus } from 'lucide-react';
import { MaintenanceList } from './maintenance-list';

export const dynamic = 'force-dynamic';

export default async function MaintenanceListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) notFound();

  const [logs, allTypes] = await Promise.all([
    getMaintenanceLogsByVehicleId(id),
    getMaintenanceTypes(session.user.id),
  ]);

  const typeMap = new Map(allTypes.map((t) => [t.id, t]));

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/vehicles/${id}`}>
              <Button variant="ghost" size="icon-sm">
                <ChevronLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Maintenance History</h1>
              <p className="text-sm text-muted-foreground">{vehicle.name}</p>
            </div>
          </div>
          <Link href={`/vehicles/${id}/maintenance/new`}>
            <Button size="sm">
              <Plus className="size-4" />
              Log Service
            </Button>
          </Link>
        </div>

        <MaintenanceList
          vehicleId={id}
          vehicleName={vehicle.name}
          vehicleUnits={vehicle.units}
          logs={logs}
          typeMap={typeMap}
        />
      </div>
    </AppShell>
  );
}
