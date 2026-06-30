'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, X } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
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
    <div className="space-y-3">
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
          {/* Search */}
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
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Notes</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Cost</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((log) => {
                    const type = typeMap.get(log.maintenance_type_id);
                    return (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors group">
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="block">
                            <span className="text-xs text-muted-foreground">{type?.name ?? '—'}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 max-w-[240px]">
                          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="block truncate">
                            {log.description ?? <span className="text-muted-foreground">—</span>}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 max-w-[200px]">
                          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="block truncate text-xs text-muted-foreground">
                            {log.notes ?? ''}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="block">
                            <span className="text-xs text-muted-foreground">{formatDate(log.serviced_at)}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`} className="block">
                            <span className="text-xs">{log.price_paid ? formatCurrency(log.price_paid) : ''}</span>
                          </Link>
                        </td>
                        <td className="px-1 py-1 text-right">
                          <DeleteLogButton logId={log.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
