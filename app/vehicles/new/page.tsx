'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateVehicleSchema, type CreateVehicle } from '@/lib/schemas';
import { ChevronLeft } from 'lucide-react';

export default function NewVehiclePage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateVehicle>({
    resolver: zodResolver(CreateVehicleSchema) as never,
    defaultValues: { units: 'miles' },
  });

  async function onSubmit(data: CreateVehicle) {
    setError('');
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Failed to create vehicle');
        return;
      }

      const vehicle = await res.json();
      router.push(`/vehicles/${vehicle.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/vehicles">
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Add Vehicle</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Vehicle Name *</Label>
            <Input id="name" placeholder='e.g. "2019 Honda CR-V"' {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" placeholder="Honda" {...register('make')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="CR-V" {...register('model')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" placeholder="2019" {...register('year', { valueAsNumber: true })} />
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="units">Odometer Units</Label>
              <select id="units" {...register('units')} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_mileage">Current Mileage</Label>
            <Input id="current_mileage" type="number" placeholder="65000" {...register('current_mileage', { valueAsNumber: true })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="license_plate">License Plate</Label>
            <Input id="license_plate" placeholder="ABC-1234" {...register('license_plate')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN (optional)</Label>
            <Input id="vin" placeholder="17-character VIN" {...register('vin')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">QR Code PIN *</Label>
            <Input id="pin" type="text" inputMode="numeric" pattern="\d*" maxLength={8} placeholder="4-8 digit PIN for public QR page" {...register('pin')} />
            {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
            <p className="text-xs text-muted-foreground">Anyone who scans the QR code will need this PIN.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/vehicles">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create Vehicle'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
