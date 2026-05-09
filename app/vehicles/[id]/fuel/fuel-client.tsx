'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { ChevronLeft, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { addFuelLogAction, deleteFuelLogAction, deleteFuelReceiptAction } from '@/lib/actions/fuel';
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
  total_cost: string | null;
  notes: string | null;
};

type FuelReceipt = { id: string; r2_url: string; file_name: string | null };

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
  receiptsByLogId,
  r2Configured,
  effectiveMileage,
}: {
  vehicle: Vehicle;
  initialLogs: FuelLog[];
  receiptsByLogId: Record<string, FuelReceipt[]>;
  r2Configured: boolean;
  effectiveMileage?: number | null;
}) {
  const [unit, setUnit] = useState<'gallons' | 'liters'>('gallons');
  const [filledAtValue, setFilledAtValue] = useState(getToday());
  const [mileageValue, setMileageValue] = useState('');
  const [fuelQuantityValue, setFuelQuantityValue] = useState('');
  const [pricePerUnitValue, setPricePerUnitValue] = useState('');
  const [totalCostValue, setTotalCostValue] = useState('');

  const [selectedOdoFiles, setSelectedOdoFiles] = useState<File[]>([]);
  const [compressingOdo, setCompressingOdo] = useState(false);
  const [scanningOdo, setScanningOdo] = useState(false);
  const [odoScanError, setOdoScanError] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const odoFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localReceipts, setLocalReceipts] = useState(receiptsByLogId);

  const addWithVehicleId = addFuelLogAction.bind(null, vehicle.id);
  const [state, formAction] = useActionState<ActionState, FormData>(addWithVehicleId, null);

  useEffect(() => {
    if (state && 'success' in state) {
      formRef.current?.reset();
      setUnit('gallons');
      setFilledAtValue(getToday());
      setMileageValue('');
      setFuelQuantityValue('');
      setPricePerUnitValue('');
      setTotalCostValue('');
      setSelectedOdoFiles([]);
      setSelectedFiles([]);
      setOdoScanError(null);
      setScanError(null);
    }
  }, [state]);

  async function handleOdoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files ?? []);
    if (raw.length === 0) return;
    setCompressingOdo(true);
    try {
      const compressed = await Promise.all(
        raw.map(async (file) => {
          const result = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
          return new File([result], file.name, { type: result.type });
        })
      );
      setSelectedOdoFiles((prev) => {
        const merged = [...prev, ...compressed];
        syncOdoInput(merged);
        return merged;
      });
      if (compressed[0]) handleScanOdometer(compressed[0]);
    } finally {
      setCompressingOdo(false);
    }
  }

  function syncOdoInput(files: File[]) {
    if (!odoFileInputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    odoFileInputRef.current.files = dt.files;
  }

  function removeOdoFile(index: number) {
    const updated = selectedOdoFiles.filter((_, i) => i !== index);
    setSelectedOdoFiles(updated);
    syncOdoInput(updated);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files ?? []);
    if (raw.length === 0) return;
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        raw.map(async (file) => {
          const result = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
          return new File([result], file.name, { type: result.type });
        })
      );
      setSelectedFiles((prev) => {
        const merged = [...prev, ...compressed];
        syncInput(merged);
        return merged;
      });
      if (compressed[0]) handleScanReceipt(compressed[0]);
    } finally {
      setCompressing(false);
    }
  }

  function syncInput(files: File[]) {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInputRef.current.files = dt.files;
  }

  function removeFile(index: number) {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    syncInput(updated);
  }

  async function handleScanOdometer(file: File) {
    setOdoScanError(null);
    setScanningOdo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/ai/extract-fuel-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, mediaType: file.type || 'image/jpeg', scanType: 'odometer' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        setOdoScanError(err.error ?? 'Scan failed');
        return;
      }
      const data = await res.json();
      if (data.mileage != null) setMileageValue(String(data.mileage));
    } catch {
      setOdoScanError('Could not read odometer. Enter mileage manually.');
    } finally {
      setScanningOdo(false);
    }
  }

  async function handleScanReceipt(file: File) {
    setScanError(null);
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/ai/extract-fuel-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, mediaType: file.type || 'image/jpeg', scanType: 'receipt' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        setScanError(err.error ?? 'Scan failed');
        return;
      }
      const data = await res.json();
      if (data.fuel_quantity != null) setFuelQuantityValue(String(data.fuel_quantity));
      if (data.fuel_unit) setUnit(data.fuel_unit as 'gallons' | 'liters');
      if (data.price_per_unit) setPricePerUnitValue(data.price_per_unit);
      if (data.total_cost) setTotalCostValue(data.total_cost);
      if (data.filled_at) setFilledAtValue(data.filled_at);
    } catch {
      setScanError('Could not scan receipt. Enter values manually.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDeleteReceipt(logId: string, receiptId: string) {
    await deleteFuelReceiptAction(receiptId);
    setLocalReceipts((prev) => ({
      ...prev,
      [logId]: (prev[logId] ?? []).filter((r) => r.id !== receiptId),
    }));
  }

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
            <form ref={formRef} action={formAction} encType="multipart/form-data" className="space-y-3">
              {state && 'error' in state && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
              )}

              <input type="hidden" name="fuel_unit" value={unit} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filled_at">Date *</Label>
                  <Input id="filled_at" name="filled_at" type="date" value={filledAtValue} onChange={(e) => setFilledAtValue(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mileage">Odometer *</Label>
                  <Input id="mileage" name="mileage" type="number" placeholder={effectiveMileage != null ? String(effectiveMileage) : '65000'} required value={mileageValue} onChange={(e) => setMileageValue(e.target.value)} />
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
                    value={fuelQuantityValue}
                    onChange={(e) => setFuelQuantityValue(e.target.value)}
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
                <Input id="price_per_unit" name="price_per_unit" type="text" placeholder="3.49" value={pricePerUnitValue} onChange={(e) => setPricePerUnitValue(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="total_cost">
                  Total Cost <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="total_cost" name="total_cost" type="text" placeholder="43.21" value={totalCostValue} onChange={(e) => setTotalCostValue(e.target.value)} className="pl-6" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Trip, purpose, location…"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              {r2Configured && (
                <div className="space-y-3">
                  {/* Odometer photo */}
                  <div className="space-y-1.5">
                    <Label>Odometer Photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <input ref={odoFileInputRef} type="file" name="photos" accept="image/*" className="hidden" onChange={handleOdoFileChange} />
                    {selectedOdoFiles.length === 0 ? (
                      <button type="button" onClick={() => odoFileInputRef.current?.click()} disabled={compressingOdo}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-3 text-xs text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                        {compressingOdo ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                        {compressingOdo ? 'Compressing…' : 'Attach odometer'}
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {selectedOdoFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-xs">
                            <span className="truncate text-muted-foreground">{f.name}</span>
                            <button type="button" onClick={() => removeOdoFile(i)} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {scanningOdo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Reading odometer…
                      </div>
                    )}
                    {odoScanError && <p className="text-xs text-amber-600">{odoScanError}</p>}
                  </div>

                  {/* Receipt / fuel pump photo */}
                  <div className="space-y-1.5">
                    <Label>Receipt or Pump Photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <input ref={fileInputRef} type="file" name="photos" accept="image/*" className="hidden" onChange={handleFileChange} />
                    {selectedFiles.length === 0 ? (
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={compressing}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-3 text-xs text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                        {compressing ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                        {compressing ? 'Compressing…' : 'Attach receipt / fuel pump'}
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-xs">
                            <span className="truncate text-muted-foreground">{f.name}</span>
                            <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {scanning && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Scanning receipt…
                      </div>
                    )}
                    {scanError && <p className="text-xs text-amber-600">{scanError}</p>}
                  </div>
                </div>
              )}

              <SubmitButton label="Save Fill-Up" pendingLabel="Saving…" className={(compressing || compressingOdo || scanning || scanningOdo) ? 'opacity-50 pointer-events-none' : ''} />
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
                  log.total_cost
                    ? parseFloat(log.total_cost).toFixed(2)
                    : log.price_per_unit
                      ? (parseFloat(log.price_per_unit) * log.fuel_quantity).toFixed(2)
                      : null;

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
                          {log.mileage.toLocaleString()} {vehicle.units}
                          {totalCost && ` · $${totalCost}`}
                        </p>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">{log.notes}</p>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm"
                        onClick={async () => { if (confirm('Delete this fill-up record?')) await deleteFuelLogAction(log.id); }}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {(localReceipts[log.id] ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(localReceipts[log.id] ?? []).map((receipt) => (
                          <div key={receipt.id} className="relative group w-16 h-16 rounded-md overflow-hidden border border-border">
                            <a href={receipt.r2_url} target="_blank" rel="noopener noreferrer">
                              <img src={receipt.r2_url} alt={receipt.file_name ?? 'Receipt'} className="w-full h-full object-cover" />
                            </a>
                            <button onClick={() => handleDeleteReceipt(log.id, receipt.id)}
                              className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
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
