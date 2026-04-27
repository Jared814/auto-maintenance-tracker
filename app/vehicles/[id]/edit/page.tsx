'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UpdateVehicleSchema, type UpdateVehicle } from '@/lib/schemas';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { use } from 'react';

export default function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpdateVehicle>({
    resolver: zodResolver(UpdateVehicleSchema) as never,
  });

  useEffect(() => {
    fetch(`/api/vehicles/${id}`)
      .then((r) => r.json())
      .then((v) => reset({
        name: v.name,
        make: v.make ?? '',
        model: v.model ?? '',
        year: v.year ?? undefined,
        vin: v.vin ?? '',
        license_plate: v.license_plate ?? '',
        units: v.units,
        current_mileage: v.current_mileage ?? undefined,
      }));
  }, [id, reset]);

  async function onSubmit(data: UpdateVehicle) {
    setError('');
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Failed to update vehicle');
        return;
      }

      router.push(`/vehicles/${id}`);
    } catch {
      setError('Something went wrong.');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this vehicle and all its maintenance history? This cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/vehicles');
    else setDeleting(false);
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Vehicle</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Vehicle Name *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" {...register('make')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" {...register('model')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" {...register('year', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="units">Units</Label>
              <select id="units" {...register('units')} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_mileage">Current Mileage</Label>
            <Input id="current_mileage" type="number" {...register('current_mileage', { valueAsNumber: true })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="license_plate">License Plate</Label>
            <Input id="license_plate" {...register('license_plate')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN</Label>
            <Input id="vin" {...register('vin')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">New QR PIN (leave blank to keep current)</Label>
            <Input id="pin" type="text" inputMode="numeric" pattern="\d*" maxLength={8} placeholder="4-8 digits" {...register('pin')} />
            {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
