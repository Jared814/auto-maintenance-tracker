'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { statusBadgeClass, statusLabel, type MaintenanceStatus } from '@/lib/maintenance-status';
import { formatDate, formatMileage } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  engine: 'Engine', transmission: 'Transmission', brakes: 'Brakes',
  tires: 'Tires', fluids: 'Fluids', filters: 'Filters',
  belts: 'Belts', electrical: 'Electrical', other: 'Other',
};

interface StatusItem {
  type: { id: string; name: string; category: string };
  status: MaintenanceStatus;
  lastServiceDate?: string;
  lastServiceMileage?: number;
  nextDueMileage?: number;
  nextDueDate?: string;
}

interface VehicleData {
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  units: string;
  current_mileage?: number | null;
}

interface SummaryData {
  vehicle: VehicleData;
  statusByType: StatusItem[];
}

export function MaintenanceSummary({ qrSlug }: { qrSlug: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/vehicle/${qrSlug}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [qrSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) return null;

  const { vehicle, statusByType } = data;

  // Group by category
  const grouped = Object.entries(
    statusByType.reduce<Record<string, StatusItem[]>>((acc, item) => {
      const cat = item.type.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {})
  );

  const overdue = statusByType.filter(
    (s) => s.status === 'OVERDUE' || s.status === 'NEVER_SERVICED'
  ).length;
  const dueSoon = statusByType.filter((s) => s.status === 'DUE_SOON').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Wrench className="size-5 shrink-0" />
          <div>
            <h1 className="font-bold text-lg">{vehicle.name}</h1>
            {(vehicle.make || vehicle.year) && (
              <p className="text-primary-foreground/80 text-sm">
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Summary stats */}
        <div className="flex gap-3 text-sm">
          {vehicle.current_mileage != null && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Mileage: </span>
              <span className="font-medium">{formatMileage(vehicle.current_mileage, vehicle.units)}</span>
            </div>
          )}
          {overdue > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-800 font-medium">{overdue} overdue</span>
            </div>
          )}
          {dueSoon > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <span className="text-yellow-800 font-medium">{dueSoon} due soon</span>
            </div>
          )}
        </div>

        {/* Status by category */}
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {items.map(({ type, status, lastServiceDate, lastServiceMileage, nextDueMileage, nextDueDate }) => (
                <div key={type.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{type.name}</p>
                    {lastServiceDate && (
                      <p className="text-xs text-muted-foreground">
                        Last: {formatDate(lastServiceDate)}
                        {lastServiceMileage != null
                          ? ` @ ${formatMileage(lastServiceMileage, vehicle.units)}`
                          : ''}
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
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
