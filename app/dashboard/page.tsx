import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehiclesByAccountId, getMaintenanceLogsByVehicleId, getMaintenanceTypes } from '@/lib/db';
import { calculateMaintenanceStatus } from '@/lib/maintenance-status';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Plus } from 'lucide-react';
import { formatMileage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const vehicles = await getVehiclesByAccountId(session.user.id);
  const maintenanceTypes = await getMaintenanceTypes(session.user.id);

  // Compute worst status per vehicle
  const vehicleStatuses = await Promise.all(
    vehicles.map(async (vehicle) => {
      const logs = await getMaintenanceLogsByVehicleId(vehicle.id);

      let overdue = 0;
      let dueSoon = 0;

      for (const type of maintenanceTypes) {
        const latestLog = logs
          .filter((l) => l.maintenance_type_id === type.id)
          .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0] ?? null;

        const { status } = calculateMaintenanceStatus(latestLog, type, vehicle.current_mileage);
        if (status === 'OVERDUE' || status === 'NEVER_SERVICED') overdue++;
        else if (status === 'DUE_SOON') dueSoon++;
      }

      return { vehicle, overdue, dueSoon };
    })
  );

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
          <div className="text-center py-16">
            <Car className="size-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No vehicles yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first vehicle to start tracking maintenance</p>
            <Link href="/vehicles/new">
              <Button>
                <Plus className="size-4" />
                Add Vehicle
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicleStatuses.map(({ vehicle, overdue, dueSoon }) => (
              <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
                      {formatMileage(vehicle.current_mileage, vehicle.units)}
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
