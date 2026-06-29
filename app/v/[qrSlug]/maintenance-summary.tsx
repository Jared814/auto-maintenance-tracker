'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus, X, Fuel } from 'lucide-react';
import { statusBadgeClass, statusLabel, type MaintenanceStatus } from '@/lib/maintenance-status';
import { formatDate, formatMileage } from '@/lib/utils';
import { getToday } from '@/lib/dates';

const CATEGORY_LABELS: Record<string, string> = {
  engine: 'Engine', transmission: 'Transmission', brakes: 'Brakes',
  tires: 'Tires', fluids: 'Fluids', filters: 'Filters',
  belts: 'Belts', electrical: 'Electrical', other: 'Other',
};

interface MaintenanceType {
  id: string;
  name: string;
  category: string;
}

interface StatusItem {
  type: MaintenanceType;
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

type ActiveForm = 'service' | 'fuel' | null;

export function MaintenanceSummary({ qrSlug }: { qrSlug: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/public/vehicle/${qrSlug}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [qrSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) return null;

  const { vehicle, statusByType } = data;
  const allTypes = statusByType.map((s) => s.type);

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
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <Wrench className="size-5 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">{vehicle.name}</h1>
              {(vehicle.make || vehicle.year) && (
                <p className="text-primary-foreground/80 text-sm">
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeForm ? (
              <button
                onClick={() => setActiveForm(null)}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium px-3 py-1.5 rounded-lg"
              >
                <X className="size-4" />
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveForm('fuel')}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium px-3 py-1.5 rounded-lg"
                >
                  <Fuel className="size-4" />
                  Log Fuel
                </button>
                <button
                  onClick={() => setActiveForm('service')}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium px-3 py-1.5 rounded-lg"
                >
                  <Plus className="size-4" />
                  Log Service
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {activeForm === 'service' && (
          <LogServiceForm
            qrSlug={qrSlug}
            types={allTypes}
            onSuccess={() => { setActiveForm(null); loadData(); }}
          />
        )}
        {activeForm === 'fuel' && (
          <LogFuelForm
            qrSlug={qrSlug}
            vehicleUnits={vehicle.units}
            onSuccess={() => { setActiveForm(null); loadData(); }}
          />
        )}

        {/* Summary stats */}
        <div className="flex flex-wrap gap-2 text-sm">
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
                        {lastServiceMileage != null ? ` @ ${formatMileage(lastServiceMileage, vehicle.units)}` : ''}
                      </p>
                    )}
                    {(nextDueMileage || nextDueDate) && (
                      <p className="text-xs text-muted-foreground">
                        Next:{' '}
                        {[
                          nextDueMileage ? formatMileage(nextDueMileage, vehicle.units) : null,
                          nextDueDate ? formatDate(nextDueDate) : null,
                        ].filter(Boolean).join(' or ')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass(status)}`}>
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

// ---- Log Fuel Form ----

interface LogFuelFormProps {
  qrSlug: string;
  vehicleUnits: string;
  onSuccess: () => void;
}

function LogFuelForm({ qrSlug, vehicleUnits, onSuccess }: LogFuelFormProps) {
  const [pin, setPin] = useState('');
  const [date, setDate] = useState(getToday());
  const [mileage, setMileage] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'gallons' | 'liters'>('gallons');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || !date || !mileage || !quantity) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/public/vehicle/${qrSlug}/fuel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          filled_at: date,
          mileage: Number(mileage),
          fuel_quantity: Number(quantity),
          fuel_unit: unit,
          price_per_unit: pricePerUnit || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error === 'Invalid PIN' ? 'Incorrect PIN.' : (json.error ?? 'Failed to save'));
        return;
      }

      onSuccess();
    } catch {
      setError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30';
  const unitLabel = vehicleUnits === 'miles' ? 'MPG' : 'L/100km';

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log Fuel Fill-Up</h2>
      <p className="text-xs text-muted-foreground">Fill-ups are used to calculate {unitLabel}.</p>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">PIN *</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={8}
          placeholder="Enter vehicle PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={`${inputClass} tracking-widest text-center`}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Odometer *</label>
          <input type="number" placeholder="65000" value={mileage} onChange={(e) => setMileage(e.target.value)} className={inputClass} required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Fuel Added *</label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder={unit === 'gallons' ? '12.5' : '47.3'}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${inputClass} flex-1`}
            required
          />
          <div className="flex border border-input rounded-lg overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setUnit('gallons')}
              className={`px-3 py-1.5 text-sm transition-colors ${unit === 'gallons' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
            >
              gal
            </button>
            <button
              type="button"
              onClick={() => setUnit('liters')}
              className={`px-3 py-1.5 text-sm transition-colors ${unit === 'liters' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
            >
              L
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Price per {unit === 'gallons' ? 'gallon' : 'liter'} (optional)
        </label>
        <input
          type="text"
          placeholder="3.49"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
        <textarea
          rows={2}
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !pin || !date || !mileage || !quantity}
        className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
      >
        {submitting ? 'Saving…' : 'Save Fill-Up'}
      </button>
    </form>
  );
}

// ---- Log Service Form ----

interface LogServiceFormProps {
  qrSlug: string;
  types: MaintenanceType[];
  onSuccess: () => void;
}

function LogServiceForm({ qrSlug, types, onSuccess }: LogServiceFormProps) {
  const [pin, setPin] = useState('');
  const [typeId, setTypeId] = useState('');
  const [customName, setCustomName] = useState('');
  const [date, setDate] = useState(getToday());
  const [mileage, setMileage] = useState('');
  const [price, setPrice] = useState('');
  const [shop, setShop] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const grouped = types.reduce<Record<string, MaintenanceType[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || !typeId || !date || !mileage) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/public/vehicle/${qrSlug}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          maintenance_type_id: typeId,
          custom_service_name: typeId === 'custom' ? customName : undefined,
          serviced_at: date,
          mileage_at_service: Number(mileage),
          price_paid: price || null,
          shop: shop || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error === 'Invalid PIN' ? 'Incorrect PIN.' : (json.error ?? 'Failed to save'));
        return;
      }

      onSuccess();
    } catch {
      setError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30';

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log New Service</h2>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">PIN *</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={8}
          placeholder="Enter vehicle PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={`${inputClass} tracking-widest text-center`}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Service Type *</label>
        <select value={typeId} onChange={(e) => { setTypeId(e.target.value); setCustomName(''); }} className={inputClass} required>
          <option value="">Select type…</option>
          {Object.entries(grouped).map(([cat, catTypes]) => (
            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
              {catTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
          <option value="custom">Other (custom)…</option>
        </select>
        {typeId === 'custom' && (
          <input
            type="text"
            placeholder="e.g. Cabin air filter replacement"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className={inputClass}
            required
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Mileage *</label>
          <input type="number" placeholder="65000" value={mileage} onChange={(e) => setMileage(e.target.value)} className={inputClass} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Price</label>
          <input type="text" placeholder="49.99" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Shop</label>
          <input type="text" placeholder="Jiffy Lube" value={shop} onChange={(e) => setShop(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          rows={2}
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !pin || !typeId || !date || !mileage || (typeId === 'custom' && !customName.trim())}
        className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
      >
        {submitting ? 'Saving…' : 'Save Service Record'}
      </button>
    </form>
  );
}
