import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import {
  getVehicleById,
  getMaintenanceLogById,
  getMaintenanceTypes,
  getReceiptsByLogId,
} from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Pencil } from 'lucide-react';
import { formatDate, formatMileage, formatCurrency } from '@/lib/utils';
import { ReceiptSection } from './receipt-section';

export const dynamic = 'force-dynamic';

export default async function MaintenanceLogDetailPage({
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id, logId } = await params;
  const vehicle = await getVehicleById(id, session.user.id);
  if (!vehicle) notFound();

  const log = await getMaintenanceLogById(logId);
  if (!log || log.vehicle_id !== id) notFound();

  const [allTypes, receipts] = await Promise.all([
    getMaintenanceTypes(session.user.id),
    getReceiptsByLogId(logId),
  ]);

  const type = allTypes.find((t) => t.id === log.maintenance_type_id);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/vehicles/${id}/maintenance`}>
              <Button variant="ghost" size="icon-sm">
                <ChevronLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">
                {log.description ?? type?.name ?? 'Service Record'}
              </h1>
              {log.description && type && (
                <p className="text-xs text-muted-foreground">{type.name}</p>
              )}
              <p className="text-sm text-muted-foreground">{vehicle.name}</p>
            </div>
          </div>
          <Link href={`/vehicles/${id}/maintenance/${logId}/edit`}>
            <Button variant="outline" size="icon-sm">
              <Pencil className="size-4" />
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <Row label="Date" value={formatDate(log.serviced_at)} />
            <Row label="Mileage" value={formatMileage(log.mileage_at_service, vehicle.units)} />
            {log.shop && <Row label="Shop" value={log.shop} />}
            {log.price_paid && <Row label="Price" value={formatCurrency(log.price_paid)} />}
            {log.next_due_mileage && (
              <Row label="Next Due (miles)" value={formatMileage(log.next_due_mileage, vehicle.units)} />
            )}
            {log.next_due_date && (
              <Row label="Next Due (date)" value={formatDate(log.next_due_date)} />
            )}
            {log.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{log.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <ReceiptSection logId={logId} initialReceipts={receipts} />
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
