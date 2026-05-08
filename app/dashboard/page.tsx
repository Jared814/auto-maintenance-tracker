import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehiclesByAccountId, getMaintenanceLogCountsByVehicleIds, getMaintenanceTypes, getMaxLogMileageByVehicleIds } from '@/lib/db';
import { calculateMaintenanceStatus } from '@/lib/maintenance-status';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMileage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const vehicles = await getVehiclesByAccountId(session.user.id);
  const [maintenanceTypes, latestLogsByVehicle, maxLogMileage] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getMaintenanceLogCountsByVehicleIds(vehicles.map((v) => v.id)),
    getMaxLogMileageByVehicleIds(vehicles.map((v) => v.id)),
  ]);

  const vehicleStatuses = vehicles.map((vehicle) => {
    const logMax = maxLogMileage.get(vehicle.id) ?? null;
    const effectiveMileage = Math.max(vehicle.current_mileage ?? 0, logMax ?? 0) || null;

    const typeMap = latestLogsByVehicle.get(vehicle.id) ?? new Map<string, string>();

    let overdue = 0;
    let dueSoon = 0;

    for (const type of maintenanceTypes) {
      const servicedAt = typeMap.get(type.id) ?? null;
      const latestLog = servicedAt ? { serviced_at: servicedAt, mileage_at_service: 0, next_due_mileage: null, next_due_date: null } as Parameters<typeof calculateMaintenanceStatus>[0] : null;
      const { status } = calculateMaintenanceStatus(latestLog, type, effectiveMileage);
      if (status === 'OVERDUE' || status === 'NEVER_SERVICED') overdue++;
      else if (status === 'DUE_SOON') dueSoon++;
    }

    return { vehicle, effectiveMileage, overdue, dueSoon };
  });

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Welcome back, {session.user.name}
            </p>
          </div>
          <Link href="/vehicles/new">
            <Button size="sm">
              <Plus className="size-4" />
              Add Vehicle
            </Button>
          </Link>
        </div>

        {vehicles.length === 0 ? (
          <Card className="text-center py-16 max-w-sm mx-auto">
            <CardContent className="flex flex-col items-center gap-3 pt-0">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Car className="size-8 text-primary" />
              </div>
              <p className="font-medium">No vehicles yet</p>
              <p className="text-sm text-muted-foreground">Add your first vehicle to start tracking maintenance</p>
              <Link href="/vehicles/new">
                <Button>
                  <Plus className="size-4" />
                  Add Vehicle
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicleStatuses.map(({ vehicle, effectiveMileage, overdue, dueSoon }) => (
              <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`}>
                <Card className={cn(
                  'hover:shadow-md transition-shadow cursor-pointer border-l-4',
                  overdue > 0 ? 'border-l-red-500' : dueSoon > 0 ? 'border-l-amber-400' : 'border-l-green-500'
                )}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{vehicle.name}</CardTitle>
                      {overdue > 0 ? (
                        <Badge variant="danger">{overdue} overdue</Badge>
                      ) : dueSoon > 0 ? (
                        <Badge variant="warning">{dueSoon} due soon</Badge>
                      ) : (
                        <Badge variant="success">All good</Badge>
                      )}
                    </div>
                    {(vehicle.make || vehicle.year) && (
                      <p className="text-xs text-muted-foreground">
                        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatMileage(effectiveMileage, vehicle.units)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
