import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getVehicleById, getMaintenanceLogsByVehicleId, getMaintenanceTypes } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Plus } from 'lucide-react';
import { formatDate, formatMileage, formatCurrency } from '@/lib/utils';
import { DeleteLogButton } from './delete-log-button';

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

        {logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-medium">No service records yet</p>
            <p className="text-sm text-muted-foreground mb-4">Log your first service to start tracking</p>
            <Link href={`/vehicles/${id}/maintenance/new`}>
              <Button>
                <Plus className="size-4" />
                Log Service
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const type = typeMap.get(log.maintenance_type_id);
              return (
                <div key={log.id} className="flex items-center gap-2">
                  <Link href={`/vehicles/${id}/maintenance/${log.id}`} className="flex-1 min-w-0">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {log.description ?? type?.name ?? 'Unknown Service'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(log.serviced_at)} · {formatMileage(log.mileage_at_service, vehicle.units)}
                            </p>
                            {log.description && type && (
                              <p className="text-xs text-muted-foreground">{type.name}</p>
                            )}
                            {log.shop && <p className="text-xs text-muted-foreground">{log.shop}</p>}
                          </div>
                          {log.price_paid && (
                            <p className="text-sm font-medium shrink-0">{formatCurrency(log.price_paid)}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  <DeleteLogButton logId={log.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
