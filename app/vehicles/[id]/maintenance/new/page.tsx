'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreateMaintenanceLogSchema, type CreateMaintenanceLog } from '@/lib/schemas';
import { ChevronLeft } from 'lucide-react';
import { use } from 'react';
import { getToday } from '@/lib/dates';

interface MaintenanceType {
  id: string;
  name: string;
  category: string;
}

export default function NewMaintenanceLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');
  const [types, setTypes] = useState<MaintenanceType[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateMaintenanceLog>({
    resolver: zodResolver(CreateMaintenanceLogSchema) as never,
    defaultValues: {
      vehicle_id: id,
      serviced_at: getToday(),
    },
  });

  useEffect(() => {
    fetch('/api/maintenance-types')
      .then((r) => r.json())
      .then(setTypes);
  }, []);

  async function onSubmit(data: CreateMaintenanceLog) {
    setError('');
    try {
      const res = await fetch('/api/maintenance-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Failed to save');
        return;
      }

      const log = await res.json();
      router.push(`/vehicles/${id}/maintenance/${log.id}`);
    } catch {
      setError('Something went wrong.');
    }
  }

  // Group types by category
  const grouped = types.reduce<Record<string, MaintenanceType[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${id}/maintenance`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Log Service</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <input type="hidden" {...register('vehicle_id')} />

          <div className="space-y-1.5">
            <Label htmlFor="maintenance_type_id">Service Type *</Label>
            <select
              id="maintenance_type_id"
              {...register('maintenance_type_id')}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select service type…</option>
              {Object.entries(grouped).map(([cat, catTypes]) => (
                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                  {catTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.maintenance_type_id && (
              <p className="text-xs text-destructive">{errors.maintenance_type_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="serviced_at">Service Date *</Label>
              <Input id="serviced_at" type="date" {...register('serviced_at')} />
              {errors.serviced_at && <p className="text-xs text-destructive">{errors.serviced_at.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage_at_service">Mileage *</Label>
              <Input id="mileage_at_service" type="number" placeholder="65000" {...register('mileage_at_service', { valueAsNumber: true })} />
              {errors.mileage_at_service && <p className="text-xs text-destructive">{errors.mileage_at_service.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="next_due_mileage">Next Due Mileage</Label>
              <Input id="next_due_mileage" type="number" placeholder="70000" {...register('next_due_mileage', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_due_date">Next Due Date</Label>
              <Input id="next_due_date" type="date" {...register('next_due_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price_paid">Price Paid</Label>
              <Input id="price_paid" type="text" placeholder="49.99" {...register('price_paid')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop">Shop / Location</Label>
              <Input id="shop" placeholder="Jiffy Lube" {...register('shop')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} placeholder="Any additional notes…" {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${id}/maintenance`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Record'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
