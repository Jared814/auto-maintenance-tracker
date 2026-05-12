import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import {
  getVehicleById,
  getMaintenanceTypes,
  getMaintenanceLogsByVehicleId,
  getFuelLogsByVehicleId,
  getMileageLogsByVehicleId,
} from '@/lib/db';
import { computeEconomy, avgEconomy } from '@/lib/fuel-economy';
import { calculateMaintenanceStatus, statusBadgeClass, statusLabel } from '@/lib/maintenance-status';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Pencil, QrCode, Plus, Fuel, Gauge, Clock } from 'lucide-react';
import { formatMileage, formatDate } from '@/lib/utils';

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

  const [allTypes, logs, fuelLogs, mileageLogs] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getMaintenanceLogsByVehicleId(id),
    getFuelLogsByVehicleId(id),
    getMileageLogsByVehicleId(id),
  ]);

  const economyPoints = computeEconomy(fuelLogs, vehicle.units);
  const avgMpg = avgEconomy(economyPoints);
  const lastMpg = economyPoints.length > 0 ? economyPoints[economyPoints.length - 1].value : null;
  const unitLabel = vehicle.units === 'miles' ? 'MPG' : 'L/100km';

  const effectiveMileage = Math.max(
    vehicle.current_mileage ?? 0,
    ...logs.map((l) => l.mileage_at_service),
    ...fuelLogs.map((f) => f.mileage),
    ...mileageLogs.map((m) => m.mileage),
  ) || null;

  // Build status for each type
  const statusByType = allTypes.map((type) => {
    const latestLog =
      logs
        .filter((l) => l.maintenance_type_id === type.id)
        .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at))[0] ?? null;

    const result = calculateMaintenanceStatus(latestLog, type, effectiveMileage);
    return { type, latestLog, ...result };
  });

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: statusByType.filter((s) => s.type.category === cat),
  })).filter((g) => g.items.length > 0);

  function Sparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const W = 80, H = 24;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - min) / range) * (H * 0.8) - H * 0.1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-16 h-5 text-primary shrink-0">
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
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

        {/* Vehicle info */}
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
        </div>

        {/* Fuel Economy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Fuel Economy</h2>
            <div className="flex gap-2">
              <Link href={`/vehicles/${id}/mileage`}>
                <Button size="sm" variant="outline">
                  <Gauge className="size-4" />
                  Log Mileage
                </Button>
              </Link>
              <Link href={`/vehicles/${id}/fuel`}>
                <Button size="sm">
                  <Fuel className="size-4" />
                  Log Fill
                </Button>
              </Link>
            </div>
          </div>
          {lastMpg !== null ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Last Fill</p>
                    <p className="text-2xl font-bold tabular-nums">{lastMpg.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{unitLabel}</p>
                  </div>
                  {avgMpg !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-2xl font-bold tabular-nums">{avgMpg.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{unitLabel}</p>
                    </div>
                  )}
                  <div className="ml-auto">
                    <Sparkline values={economyPoints.map((p) => p.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              {fuelLogs.length === 0
                ? 'Log your first fill-up to start tracking fuel economy.'
                : 'Log one more fill-up to calculate economy.'}
            </p>
          )}
        </div>

        {/* Add log button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Maintenance Status</h2>
          <Link href={`/vehicles/${id}/maintenance/new`}>
            <Button size="sm">
              <Plus className="size-4" />
              Log Service
            </Button>
          </Link>
        </div>

        {/* Status by category */}
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

        {/* Full log link */}
        <div className="pt-2">
          <Link href={`/vehicles/${id}/maintenance`}>
            <Button variant="outline" className="w-full">View Full Maintenance History</Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
