import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehiclesByAccountId, getMaxLogMileageByVehicleIds, getFuelLogsByVehicleIds } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, Plus, QrCode } from 'lucide-react';
import { formatMileage } from '@/lib/utils';
import { computeEconomy, avgEconomy } from '@/lib/fuel-economy';

export const dynamic = 'force-dynamic';

export default async function VehiclesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const vehicles = await getVehiclesByAccountId(session.user.id);
  const vehicleIds = vehicles.map((v) => v.id);
  const [maxLogMileage, allFuelLogs] = await Promise.all([
    getMaxLogMileageByVehicleIds(vehicleIds),
    getFuelLogsByVehicleIds(vehicleIds),
  ]);

  // Group fuel logs by vehicle id
  const fuelByVehicle = new Map<string, typeof allFuelLogs>();
  for (const log of allFuelLogs) {
    if (!fuelByVehicle.has(log.vehicle_id)) fuelByVehicle.set(log.vehicle_id, []);
    fuelByVehicle.get(log.vehicle_id)!.push(log);
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Vehicles</h1>

        {vehicles.length === 0 ? (
          <div className="text-center py-16">
            <Car className="size-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No vehicles yet</p>
            <Link href="/vehicles/new">
              <Button className="mt-4">
                <Plus className="size-4" />
                Add Vehicle
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => {
              const logMax = maxLogMileage.get(vehicle.id) ?? null;
              const effectiveMileage = Math.max(vehicle.current_mileage ?? 0, logMax ?? 0) || null;
              const logs = fuelByVehicle.get(vehicle.id) ?? [];
              const avgMpg = avgEconomy(computeEconomy(logs, vehicle.units));
              return (
                <Card key={vehicle.id}>
                  <CardHeader>
                    <CardTitle>{vehicle.name}</CardTitle>
                    {(vehicle.make || vehicle.year) && (
                      <p className="text-xs text-muted-foreground">
                        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatMileage(effectiveMileage, vehicle.units)}</span>
                      {avgMpg !== null && (
                        <span className="font-medium text-foreground">
                          {vehicle.units === 'km'
                            ? `${avgMpg.toFixed(1)} L/100km`
                            : `${avgMpg.toFixed(1)} MPG`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/vehicles/${vehicle.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">View</Button>
                      </Link>
                      <Link href={`/vehicles/${vehicle.id}/qr`}>
                        <Button variant="outline" size="icon-sm">
                          <QrCode className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
