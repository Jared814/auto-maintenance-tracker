'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, X } from 'lucide-react';
import { formatDate, formatMileage, formatCurrency } from '@/lib/utils';
import { DeleteLogButton } from './delete-log-button';

type Log = {
  id: string;
  maintenance_type_id: string;
  description: string | null;
  serviced_at: string;
  mileage_at_service: number;
  shop: string | null;
  notes: string | null;
  price_paid: string | null;
};

type MaintenanceType = { id: string; name: string; category: string };

export function MaintenanceList({
  vehicleId,
  vehicleName,
  vehicleUnits,
  logs,
  typeMap,
}: {
  vehicleId: string;
  vehicleName: string;
  vehicleUnits: string;
  logs: Log[];
  typeMap: Map<string, MaintenanceType>;
}) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const filtered = q
    ? logs.filter((log) => {
        const type = typeMap.get(log.maintenance_type_id);
        return [
          log.description,
          type?.name,
          formatDate(log.serviced_at),
          log.mileage_at_service.toString(),
          log.shop,
          log.notes,
          log.price_paid,
        ].some((field) => field?.toLowerCase().includes(q));
      })
    : logs;

  return (
    <div className="space-y-4">
      {logs.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-medium">No service records yet</p>
          <p className="text-sm text-muted-foreground mb-4">Log your first service to start tracking</p>
          <Link href={`/vehicles/${vehicleId}/maintenance/new`}>
            <Button>
              <Plus className="size-4" />
              Log Service
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search records…"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No records match &ldquo;{query}&rdquo;</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => {
                const type = typeMap.get(log.maintenance_type_id);
                return (
                  <div key={log.id} className="flex items-center gap-2">
                    <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="flex-1 min-w-0">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {log.description ?? type?.name ?? 'Unknown Service'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(log.serviced_at)} · {formatMileage(log.mileage_at_service, vehicleUnits)}
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

          {q && (
            <p className="text-xs text-muted-foreground text-center">
              {filtered.length} of {logs.length} records
            </p>
          )}
        </>
      )}
    </div>
  );
}
