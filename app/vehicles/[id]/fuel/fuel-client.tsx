'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { addFuelLogAction, deleteFuelLogAction } from '@/lib/actions/fuel';
import { computeEconomy, avgEconomy } from '@/lib/fuel-economy';
import { getToday } from '@/lib/dates';
import { formatDate } from '@/lib/utils';
import type { ActionState } from '@/lib/actions/state';

type FuelLog = {
  id: string;
  filled_at: string;
  mileage: number;
  fuel_quantity: number;
  fuel_unit: string;
  price_per_unit: string | null;
  notes: string | null;
};

type Vehicle = {
  id: string;
  name: string;
  units: string;
};

function LineChart({ points, unitLabel }: { points: { date: string; value: number }[]; unitLabel: string }) {
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
      {/* Y gridlines + labels */}
      {gridLevels.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={toY(v).toFixed(1)}
            x2={W - PAD.r} y2={toY(v).toFixed(1)}
            stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
          />
          <text
            x={PAD.l - 5} y={(toY(v) + 4).toFixed(1)}
            textAnchor="end" fontSize={9}
            fill="currentColor" opacity={0.55}
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Unit label */}
      <text x={PAD.l - 5} y={PAD.t - 2} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.4}>
        {unitLabel}
      </text>

      {/* X labels */}
      {[...xIndices].map((idx) => (
        <text
          key={idx}
          x={toX(idx).toFixed(1)} y={H - 6}
          textAnchor="middle" fontSize={9}
          fill="currentColor" opacity={0.5}
        >
          {points[idx].date.slice(5).replace('-', '/')}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="currentColor" opacity={0.08} />

      {/* Line */}
      <path d={lineD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={toX(i).toFixed(1)} cy={toY(p.value).toFixed(1)} r={3} fill="currentColor" />
      ))}
    </svg>
  );
}

export function FuelClient({
  vehicle,
  initialLogs,
}: {
  vehicle: Vehicle;
  initialLogs: FuelLog[];
}) {
  const [unit, setUnit] = useState<'gallons' | 'liters'>('gallons');
  const formRef = useRef<HTMLFormElement>(null);

  const addWithVehicleId = addFuelLogAction.bind(null, vehicle.id);
  const [state, formAction] = useActionState<ActionState, FormData>(addWithVehicleId, null);

  useEffect(() => {
    if (state && 'success' in state) {
      formRef.current?.reset();
      setUnit('gallons');
    }
  }, [state]);

  const unitLabel = vehicle.units === 'miles' ? 'MPG' : 'L/100km';
  const economyPoints = computeEconomy(initialLogs, vehicle.units);
  const avgValue = avgEconomy(economyPoints);
  const lastValue = economyPoints.length > 0 ? economyPoints[economyPoints.length - 1].value : null;

  const sortedLogs = [...initialLogs].sort((a, b) => b.filled_at.localeCompare(a.filled_at));

  // Map each log id to its economy point (by matching log date after first fill)
  const economyByDate = new Map(economyPoints.map((p) => [p.date, p.value]));

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href={`/vehicles/${vehicle.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Fuel Log</h1>
        </div>

        {/* Log form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log a Fill-Up</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={formAction} className="space-y-3">
              {state && 'error' in state && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
              )}

              <input type="hidden" name="fuel_unit" value={unit} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filled_at">Date *</Label>
                  <Input id="filled_at" name="filled_at" type="date" defaultValue={getToday()} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mileage">Odometer *</Label>
                  <Input id="mileage" name="mileage" type="number" placeholder="65000" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fuel Added *</Label>
                <div className="flex gap-2">
                  <Input
                    name="fuel_quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={unit === 'gallons' ? '12.5' : '47.3'}
                    required
                    className="flex-1"
                  />
                  <div className="flex border border-input rounded-lg overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setUnit('gallons')}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        unit === 'gallons'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent hover:bg-muted'
                      }`}
                    >
                      gal
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit('liters')}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        unit === 'liters'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent hover:bg-muted'
                      }`}
                    >
                      L
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price_per_unit">
                  Price per {unit === 'gallons' ? 'Gallon' : 'Liter'}{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="price_per_unit" name="price_per_unit" type="text" placeholder="3.49" />
              </div>

              <SubmitButton label="Save Fill-Up" pendingLabel="Saving…" />
            </form>
          </CardContent>
        </Card>

        {/* Economy summary + chart */}
        {economyPoints.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fuel Economy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 mb-4">
                {lastValue !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Last Fill</p>
                    <p className="text-2xl font-bold tabular-nums">{lastValue.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{unitLabel}</p>
                  </div>
                )}
                {avgValue !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="text-2xl font-bold tabular-nums">{avgValue.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{unitLabel}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Fills</p>
                  <p className="text-2xl font-bold tabular-nums">{initialLogs.length}</p>
                  <p className="text-xs text-muted-foreground">logged</p>
                </div>
              </div>

              <LineChart points={economyPoints} unitLabel={unitLabel} />
            </CardContent>
          </Card>
        )}

        {/* Fill history */}
        {sortedLogs.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Fill History</h2>
            <div className="space-y-2">
              {sortedLogs.map((log) => {
                const econ = economyByDate.get(log.filled_at);
                const totalCost =
                  log.price_per_unit
                    ? (parseFloat(log.price_per_unit) * log.fuel_quantity).toFixed(2)
                    : null;

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5"
                  >
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
                        {log.mileage.toLocaleString()} {vehicle.units}
                        {totalCost && ` · $${totalCost}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={async () => {
                        if (confirm('Delete this fill-up record?')) {
                          await deleteFuelLogAction(log.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sortedLogs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No fill-ups logged yet. Add your first one above to start tracking fuel economy.
          </p>
        )}
      </div>
    </AppShell>
  );
}
