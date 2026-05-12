'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Fuel, Wrench, Gauge, X } from 'lucide-react';
import type { EconomyPoint } from '@/lib/fuel-economy';
import { formatDate, formatMileage } from '@/lib/utils';

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

type MaintenanceLog = {
  id: string;
  serviced_at: string;
  mileage_at_service: number;
  maintenance_type_id: string;
  shop: string | null;
  price_paid: string | null;
  notes: string | null;
};

type MileageLog = {
  id: string;
  logged_at: string;
  mileage: number;
  notes: string | null;
};

type Vehicle = { id: string; name: string; units: string };

type FuelEvent = {
  kind: 'fuel';
  id: string;
  date: string;
  mileage: number;
  quantity: number;
  unit: string;
  pricePerUnit: string | null;
  cost: string | null;
  mpg: number | null;
  notes: string | null;
};

type MaintenanceEvent = {
  kind: 'maintenance';
  id: string;
  date: string;
  mileage: number;
  typeName: string;
  shop: string | null;
  price: string | null;
  notes: string | null;
};

type OdometerEvent = {
  kind: 'odometer';
  id: string;
  date: string;
  mileage: number;
  notes: string | null;
};

type TimelineEvent = FuelEvent | MaintenanceEvent | OdometerEvent;

function safeMoney(val: string | null): string | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : `$${n.toFixed(2)}`;
}

function DetailContent({
  event,
  vehicleId,
  units,
}: {
  event: TimelineEvent;
  vehicleId: string;
  units: string;
}) {
  const unitLabel = units === 'miles' ? 'MPG' : 'L/100km';

  if (event.kind === 'fuel') {
    return (
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Fuel className="size-4 text-amber-500 shrink-0" />
          <span className="font-semibold">Fill-up</span>
          <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
        </div>
        <p className="text-sm">
          {formatMileage(event.mileage, units)}
          {event.mpg !== null && (
            <> · <span className="font-medium">{event.mpg.toFixed(1)} {unitLabel}</span></>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {event.quantity.toFixed(2)} {event.unit}
          {safeMoney(event.pricePerUnit) && (
            <> · {safeMoney(event.pricePerUnit)}/{event.unit === 'gallons' ? 'gal' : 'L'}</>
          )}
          {safeMoney(event.cost) && <> · {safeMoney(event.cost)} total</>}
        </p>
        {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
      </div>
    );
  }

  if (event.kind === 'maintenance') {
    return (
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Wrench className="size-4 text-blue-500 shrink-0" />
          <span className="font-semibold">{event.typeName}</span>
          <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
        </div>
        <p className="text-sm">
          {formatMileage(event.mileage, units)}
          {event.shop && <> · {event.shop}</>}
          {safeMoney(event.price) && <> · {safeMoney(event.price)}</>}
        </p>
        {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
        <Link
          href={`/vehicles/${vehicleId}/maintenance/${event.id}`}
          className="text-sm text-primary hover:underline"
        >
          View full record →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Gauge className="size-4 text-slate-400 shrink-0" />
        <span className="font-semibold">Odometer Reading</span>
        <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
      </div>
      <p className="text-sm">{formatMileage(event.mileage, units)}</p>
      {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
    </div>
  );
}

export function TimelineClient({
  vehicle,
  fuelLogs,
  maintenanceLogs,
  mileageLogs,
  maintenanceTypeMap,
  economyPoints,
}: {
  vehicle: Vehicle;
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  mileageLogs: MileageLog[];
  maintenanceTypeMap: Record<string, string>;
  economyPoints: EconomyPoint[];
}) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  const mpgByDate = new Map(economyPoints.map((p) => [p.date, p.value]));

  const events: TimelineEvent[] = [
    ...fuelLogs.map((f): FuelEvent => ({
      kind: 'fuel',
      id: f.id,
      date: f.filled_at,
      mileage: f.mileage,
      quantity: f.fuel_quantity,
      unit: f.fuel_unit,
      pricePerUnit: f.price_per_unit,
      cost: f.total_cost,
      mpg: mpgByDate.get(f.filled_at) ?? null,
      notes: f.notes,
    })),
    ...maintenanceLogs.map((m): MaintenanceEvent => ({
      kind: 'maintenance',
      id: m.id,
      date: m.serviced_at,
      mileage: m.mileage_at_service,
      typeName: maintenanceTypeMap[m.maintenance_type_id] ?? 'Service',
      shop: m.shop,
      price: m.price_paid,
      notes: m.notes,
    })),
    ...mileageLogs.map((ml): OdometerEvent => ({
      kind: 'odometer',
      id: ml.id,
      date: ml.logged_at,
      mileage: ml.mileage,
      notes: ml.notes,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // SVG geometry
  const PAD_L = 44;
  const PAD_R = 20;
  const AXIS_Y = 160;
  const LABEL_Y = 178;
  const PIN_TIP_Y = 236;
  const TOTAL_H = 316;

  const totalWidth = Math.max(600, events.length * 64);
  const innerWidth = totalWidth - PAD_L - PAD_R;

  const times = events.map((e) => new Date(e.date).getTime());
  const minT = events.length > 0 ? Math.min(...times) : 0;
  const maxT = events.length > 0 ? Math.max(...times) : 0;
  const timeRange = maxT - minT || 1;

  function dateToX(dateStr: string): number {
    if (events.length <= 1) return innerWidth / 2;
    const t = new Date(dateStr).getTime();
    return ((t - minT) / timeRange) * innerWidth;
  }

  const xPositions = events.map((e) => dateToX(e.date));

  // Date tick labels: evenly spaced across the time range
  const tickCount = Math.min(5, Math.max(events.length > 0 ? 2 : 0, events.length));
  const ticks =
    events.length > 0 && tickCount > 1
      ? Array.from({ length: tickCount }, (_, i) => {
          const t = minT + (timeRange * i) / (tickCount - 1);
          const x = ((t - minT) / timeRange) * innerWidth;
          const d = new Date(t);
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          return { x, label };
        })
      : events.length === 1
        ? [{ x: innerWidth / 2, label: new Date(minT).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }]
        : [];

  // MPG chart
  const hasMpg = economyPoints.length >= 2;
  const MPG_TOP = 24;
  const MPG_BOT = 148;
  const MPG_H = MPG_BOT - MPG_TOP;

  const mpgVals = economyPoints.map((p) => p.value);
  const mpgMin = hasMpg ? Math.min(...mpgVals) : 0;
  const mpgMax = hasMpg ? Math.max(...mpgVals) : 0;
  const mpgRange = mpgMax - mpgMin || 1;

  function mpgToY(v: number): number {
    return MPG_BOT - ((v - mpgMin) / mpgRange) * MPG_H;
  }

  const mpgPoints = economyPoints.map((p) => ({
    x: PAD_L + dateToX(p.date),
    y: mpgToY(p.value),
    value: p.value,
  }));

  const mpgLineD = mpgPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const mpgAreaD =
    mpgPoints.length >= 2
      ? `${mpgLineD} L ${mpgPoints[mpgPoints.length - 1].x.toFixed(1)} ${MPG_BOT} L ${mpgPoints[0].x.toFixed(1)} ${MPG_BOT} Z`
      : '';

  const unitLabel = vehicle.units === 'miles' ? 'MPG' : 'L/100km';
  const gridVals = hasMpg ? [mpgMin, mpgMin + mpgRange / 2, mpgMax] : [];

  function pinColor(kind: TimelineEvent['kind']): string {
    if (kind === 'fuel') return '#f59e0b';
    if (kind === 'maintenance') return '#3b82f6';
    return '#94a3b8';
  }

  function pinLetter(kind: TimelineEvent['kind']): string {
    if (kind === 'fuel') return 'F';
    if (kind === 'maintenance') return 'S';
    return 'O';
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href={`/vehicles/${vehicle.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Timeline</h1>
            <p className="text-sm text-muted-foreground">{vehicle.name}</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500 inline-block" />
            Fill-up (F)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500 inline-block" />
            Service (S)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-400 inline-block" />
            Odometer (O)
          </span>
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="p-3 md:p-4">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No events yet. Log a fill-up, service, or odometer reading to see your timeline.
              </p>
            ) : (
              <div className="overflow-x-auto w-full">
                <svg
                  width={totalWidth}
                  height={TOTAL_H}
                  className="text-primary"
                  style={{ display: 'block' }}
                >
                  {/* MPG area + line */}
                  {hasMpg && (
                    <>
                      {gridVals.map((v, i) => (
                        <g key={i}>
                          <line
                            x1={PAD_L}
                            y1={mpgToY(v).toFixed(1)}
                            x2={totalWidth - PAD_R}
                            y2={mpgToY(v).toFixed(1)}
                            stroke="#e2e8f0"
                            strokeWidth={1}
                          />
                          <text
                            x={PAD_L - 5}
                            y={(mpgToY(v) + 4).toFixed(1)}
                            textAnchor="end"
                            fontSize={9}
                            fill="#94a3b8"
                          >
                            {v.toFixed(1)}
                          </text>
                        </g>
                      ))}
                      <text
                        x={PAD_L - 5}
                        y={MPG_TOP - 4}
                        textAnchor="end"
                        fontSize={8}
                        fill="#94a3b8"
                      >
                        {unitLabel}
                      </text>
                      <path d={mpgAreaD} fill="currentColor" opacity={0.07} />
                      <path
                        d={mpgLineD}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {mpgPoints.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x.toFixed(1)}
                          cy={p.y.toFixed(1)}
                          r={3}
                          fill="currentColor"
                        />
                      ))}
                    </>
                  )}

                  {/* Axis line */}
                  <line
                    x1={PAD_L}
                    y1={AXIS_Y}
                    x2={totalWidth - PAD_R}
                    y2={AXIS_Y}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />

                  {/* Date ticks */}
                  {ticks.map((tick, i) => (
                    <text
                      key={i}
                      x={(PAD_L + tick.x).toFixed(1)}
                      y={LABEL_Y}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#94a3b8"
                    >
                      {tick.label}
                    </text>
                  ))}

                  {/* Event pins */}
                  {events.map((ev, i) => {
                    const x = PAD_L + xPositions[i];
                    const isSelected = selected?.id === ev.id;
                    const color = pinColor(ev.kind);
                    const letter = pinLetter(ev.kind);
                    const r = isSelected ? 14 : 12;

                    return (
                      <g
                        key={ev.id}
                        onClick={() => setSelected(isSelected ? null : ev)}
                        style={{ cursor: 'pointer' }}
                      >
                        <line
                          x1={x.toFixed(1)}
                          y1={AXIS_Y}
                          x2={x.toFixed(1)}
                          y2={(PIN_TIP_Y - r).toFixed(1)}
                          stroke={color}
                          strokeWidth={isSelected ? 2 : 1.5}
                          strokeOpacity={isSelected ? 0.9 : 0.5}
                        />
                        <circle
                          cx={x.toFixed(1)}
                          cy={PIN_TIP_Y}
                          r={r}
                          fill={color}
                          opacity={isSelected ? 1 : 0.8}
                        />
                        {isSelected && (
                          <circle
                            cx={x.toFixed(1)}
                            cy={PIN_TIP_Y}
                            r={r + 5}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            strokeOpacity={0.35}
                          />
                        )}
                        <text
                          x={x.toFixed(1)}
                          y={(PIN_TIP_Y + 4).toFixed(1)}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="bold"
                          fill="white"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {letter}
                        </text>
                        <text
                          x={x.toFixed(1)}
                          y={(PIN_TIP_Y + 16).toFixed(1)}
                          textAnchor="start"
                          fontSize={8}
                          fill={color}
                          opacity={0.85}
                          transform={`rotate(90, ${x.toFixed(1)}, ${(PIN_TIP_Y + 16).toFixed(1)})`}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {formatMileage(ev.mileage, vehicle.units)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <DetailContent event={selected} vehicleId={vehicle.id} units={vehicle.units} />
                <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
