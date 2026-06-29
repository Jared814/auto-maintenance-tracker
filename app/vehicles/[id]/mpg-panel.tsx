'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Fuel, Gauge, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { deleteFuelLogAction, deleteFuelReceiptAction } from '@/lib/actions/fuel';
import type { EconomyPoint } from '@/lib/fuel-economy';
import { formatDate } from '@/lib/utils';

type FuelLog = {
  id: string;
  filled_at: string;
  mileage: number;
  fuel_quantity: number;
  fuel_unit: string;
  price_per_unit: string | null;
  total_cost: string | null;
  notes: string | null;
};

type FuelReceipt = { id: string; r2_url: string; file_name: string | null };

function LineChart({ points, unitLabel }: { points: EconomyPoint[]; unitLabel: string }) {
  if (points.length < 2) return null;

  const W = 320, H = 160;
  const PAD = { t: 12, r: 12, b: 28, l: 44 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const vals = points.map((p) => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const toX = (i: number) => PAD.l + (i / Math.max(points.length - 1, 1)) * iW;
  const toY = (v: number) => PAD.t + (1 - (v - minV) / range) * iH;

  const lineD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  const areaD = `${lineD} L ${toX(points.length - 1).toFixed(1)} ${(PAD.t + iH).toFixed(1)} L ${PAD.l.toFixed(1)} ${(PAD.t + iH).toFixed(1)} Z`;

  const gridLevels = [minV, minV + range / 2, maxV];
  const xIndices = new Set([0, points.length - 1]);
  if (points.length >= 6) xIndices.add(Math.round((points.length - 1) / 2));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-primary">
      {gridLevels.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={toY(v).toFixed(1)}
            x2={W - PAD.r} y2={toY(v).toFixed(1)}
            stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
          />
          <text x={PAD.l - 5} y={(toY(v) + 4).toFixed(1)} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.55}>
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={PAD.l - 5} y={PAD.t - 2} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.4}>
        {unitLabel}
      </text>
      {[...xIndices].map((idx) => (
        <text key={idx} x={toX(idx).toFixed(1)} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>
          {points[idx].date.slice(5).replace('-', '/')}
        </text>
      ))}
      <path d={areaD} fill="currentColor" opacity={0.08} />
      <path d={lineD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i).toFixed(1)} cy={toY(p.value).toFixed(1)} r={3} fill="currentColor" />
      ))}
    </svg>
  );
}

export function MpgPanel({
  fuelLogs,
  economyPoints,
  receiptsByLogId,
  vehicleId,
  unitLabel,
  vehicleUnits,
}: {
  fuelLogs: FuelLog[];
  economyPoints: EconomyPoint[];
  receiptsByLogId: Record<string, FuelReceipt[]>;
  vehicleId: string;
  unitLabel: string;
  vehicleUnits: string;
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const [localLogs, setLocalLogs] = useState(fuelLogs);
  const [localReceipts, setLocalReceipts] = useState(receiptsByLogId);

  // Recompute economy from current local logs in the same order the server would
  const economyByDate = new Map(economyPoints.map((p) => [p.date, p.value]));
  const lastMpg = economyPoints.length > 0 ? economyPoints[economyPoints.length - 1].value : null;
  const avgMpg = economyPoints.length > 0
    ? economyPoints.reduce((s, p) => s + p.value, 0) / economyPoints.length
    : null;

  const sortedLogs = [...localLogs].sort((a, b) => b.filled_at.localeCompare(a.filled_at));

  async function handleDeleteLog(id: string) {
    if (!confirm('Delete this fill-up record?')) return;
    await deleteFuelLogAction(id);
    setLocalLogs((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleDeleteReceipt(logId: string, receiptId: string) {
    await deleteFuelReceiptAction(receiptId);
    setLocalReceipts((prev) => ({
      ...prev,
      [logId]: (prev[logId] ?? []).filter((r) => r.id !== receiptId),
    }));
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fuel Economy</h2>
        <div className="flex gap-2">
          <Link href={`/vehicles/${vehicleId}/mileage`}>
            <Button size="sm" variant="outline">
              <Gauge className="size-4" />
              Log Mileage
            </Button>
          </Link>
          <Link href={`/vehicles/${vehicleId}/fuel`}>
            <Button size="sm">
              <Fuel className="size-4" />
              Log Fill
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats banner — tap to expand/collapse chart */}
      {lastMpg !== null ? (
        <Card
          className="cursor-pointer select-none active:opacity-80 transition-opacity"
          onClick={() => setChartOpen((o) => !o)}
        >
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
              <div>
                <p className="text-xs text-muted-foreground">Fills</p>
                <p className="text-2xl font-bold tabular-nums">{localLogs.length}</p>
                <p className="text-xs text-muted-foreground">logged</p>
              </div>
              <div className="ml-auto text-muted-foreground">
                {chartOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </div>

            {/* Collapsible chart */}
            {chartOpen && economyPoints.length >= 2 && (
              <div className="mt-4 pt-4 border-t border-border">
                <LineChart points={economyPoints} unitLabel={unitLabel} />
              </div>
            )}
            {chartOpen && economyPoints.length < 2 && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Log one more fill-up to see the chart.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {localLogs.length === 0
            ? 'Log your first fill-up to start tracking fuel economy.'
            : 'Log one more fill-up to calculate economy.'}
        </p>
      )}

      {/* Fill history */}
      {sortedLogs.length > 0 && (
        <>
          <h2 className="text-base font-semibold">Fill History</h2>
          <div className="space-y-2">
            {sortedLogs.map((log) => {
              const econ = economyByDate.get(log.filled_at);
              const totalCost =
                log.total_cost
                  ? parseFloat(log.total_cost).toFixed(2)
                  : log.price_per_unit
                    ? (parseFloat(log.price_per_unit) * log.fuel_quantity).toFixed(2)
                    : null;
              const receipts = localReceipts[log.id] ?? [];

              return (
                <div key={log.id} className="bg-card border border-border rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{formatDate(log.filled_at)}</p>
                        {econ !== undefined && (
                          <span className="text-xs font-semibold text-primary">
                            {econ.toFixed(1)} {unitLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.fuel_quantity} {log.fuel_unit} &middot;{' '}
                        {log.mileage.toLocaleString()} {vehicleUnits}
                        {totalCost && ` · $${totalCost}`}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">{log.notes}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteLog(log.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {receipts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="relative group w-16 h-16 rounded-md overflow-hidden border border-border"
                        >
                          <a href={receipt.r2_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={receipt.r2_url}
                              alt={receipt.file_name ?? 'Receipt'}
                              className="w-full h-full object-cover"
                            />
                          </a>
                          <button
                            onClick={() => handleDeleteReceipt(log.id, receipt.id)}
                            className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {sortedLogs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No fill-ups logged yet.
        </p>
      )}
    </div>
  );
}
