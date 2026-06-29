import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import {
  getVehicleById,
  getMaintenanceTypes,
  getMaintenanceLogsByVehicleId,
  getFuelLogsByVehicleId,
  getMileageLogsByVehicleId,
  getFuelReceiptsByVehicleId,
} from '@/lib/db';
import { computeEconomy } from '@/lib/fuel-economy';
import { calculateMaintenanceStatus, statusBadgeClass, statusLabel } from '@/lib/maintenance-status';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Pencil, QrCode, Plus, Clock } from 'lucide-react';
import { formatMileage, formatDate } from '@/lib/utils';
import { VehicleTabs } from './vehicle-tabs';
import { VehicleInfoEditor } from './vehicle-info-editor';
import { MpgPanel } from './mpg-panel';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  engine: 'Engine',
  transmission: 'Transmission',
  brakes: 'Brakes',
  tires: 'Tires',
  fluids: 'Fluids',
  filters: 'Filters',
  belts: 'Belts',
  electrical: 'Electrical',
  other: 'Other',
};

const CATEGORY_ORDER = ['engine', 'transmission', 'brakes', 'tires', 'fluids', 'filters', 'belts', 'electrical', 'other'];


export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) notFound();

  const [allTypes, logs, fuelLogs, mileageLogs, allFuelReceipts] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getMaintenanceLogsByVehicleId(id),
    getFuelLogsByVehicleId(id),
    getMileageLogsByVehicleId(id),
    getFuelReceiptsByVehicleId(id),
  ]);

  const economyPoints = computeEconomy(fuelLogs, vehicle.units);
  const unitLabel = vehicle.units === 'miles' ? 'MPG' : 'L/100km';

  const receiptsByLogId: Record<string, { id: string; r2_url: string; file_name: string | null }[]> = {};
  for (const row of allFuelReceipts) {
    if (!receiptsByLogId[row.fuelLogId]) receiptsByLogId[row.fuelLogId] = [];
    receiptsByLogId[row.fuelLogId].push({ id: row.receipt.id, r2_url: row.receipt.r2_url, file_name: row.receipt.file_name });
  }

  const effectiveMileage = Math.max(
    vehicle.current_mileage ?? 0,
    ...logs.map((l) => l.mileage_at_service),
    ...fuelLogs.map((f) => f.mileage),
    ...mileageLogs.map((m) => m.mileage),
  ) || null;

  const statusByType = allTypes.map((type) => {
    const latestLog =
      logs
        .filter((l) => l.maintenance_type_id === type.id)
        .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0] ?? null;
    const result = calculateMaintenanceStatus(latestLog, type, effectiveMileage);
    return { type, latestLog, ...result };
  });

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: statusByType.filter((s) => s.type.category === cat),
  })).filter((g) => g.items.length > 0);

  // ---- Tab content sections ----

  const mpgContent = (
    <MpgPanel
      fuelLogs={fuelLogs}
      economyPoints={economyPoints}
      receiptsByLogId={receiptsByLogId}
      vehicleId={id}
      unitLabel={unitLabel}
      vehicleUnits={vehicle.units}
    />
  );

  const maintenanceContent = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Maintenance Status</h2>
        <Link href={`/vehicles/${id}/maintenance/new`}>
          <Button size="sm">
            <Plus className="size-4" />
            Log Service
          </Button>
        </Link>
      </div>
      <div className="space-y-4">
        {grouped.map(({ category, label, items }) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border">
                {items.map(({ type, latestLog, status, nextDueMileage, nextDueDate }) => (
                  <div key={type.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{type.name}</p>
                      {latestLog && (
                        <p className="text-xs text-muted-foreground">
                          Last: {formatDate(latestLog.serviced_at)} @ {formatMileage(latestLog.mileage_at_service, vehicle.units)}
                        </p>
                      )}
                      {(nextDueMileage || nextDueDate) && (
                        <p className="text-xs text-muted-foreground">
                          Next:{' '}
                          {[
                            nextDueMileage ? formatMileage(nextDueMileage, vehicle.units) : null,
                            nextDueDate ? formatDate(nextDueDate) : null,
                          ]
                            .filter(Boolean)
                            .join(' or ')}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Link href={`/vehicles/${id}/maintenance`}>
        <Button variant="outline" className="w-full">View Full Maintenance History</Button>
      </Link>
    </>
  );

  const infoContent = (
    <>
      {/* Basic vehicle details */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Mileage: </span>
          <span className="font-medium">{formatMileage(effectiveMileage, vehicle.units)}</span>
        </div>
        {vehicle.license_plate && (
          <div>
            <span className="text-muted-foreground">Plate: </span>
            <span className="font-medium">{vehicle.license_plate}</span>
          </div>
        )}
        {vehicle.vin && (
          <div>
            <span className="text-muted-foreground">VIN: </span>
            <span className="font-medium font-mono text-xs">{vehicle.vin}</span>
          </div>
        )}
      </div>

      <VehicleInfoEditor vehicleId={id} initialBlob={vehicle.info_blob ?? null} />
    </>
  );

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header — always visible */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/vehicles">
              <Button variant="ghost" size="icon-sm">
                <ChevronLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{vehicle.name}</h1>
              {(vehicle.make || vehicle.year) && (
                <p className="text-sm text-muted-foreground">
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/vehicles/${id}/timeline`} title="View timeline">
              <Button variant="outline" size="icon-sm">
                <Clock className="size-4" />
              </Button>
            </Link>
            <Link href={`/vehicles/${id}/qr`}>
              <Button variant="outline" size="icon-sm">
                <QrCode className="size-4" />
              </Button>
            </Link>
            <Link href={`/vehicles/${id}/edit`}>
              <Button variant="outline" size="icon-sm">
                <Pencil className="size-4" />
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* Tabbed content — full-bleed below header */}
      <VehicleTabs
        mpgContent={mpgContent}
        maintenanceContent={maintenanceContent}
        infoContent={infoContent}
      />
    </AppShell>
  );
}
