'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { ChevronLeft } from 'lucide-react';
import { addVehicleAction } from '@/lib/actions/vehicles';
import type { ActionState } from '@/lib/actions/state';

export function NewVehicleForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(addVehicleAction, null);

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

        <form action={formAction} className="space-y-4">
          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Vehicle Name *</Label>
            <Input id="name" name="name" placeholder='e.g. "2019 Honda CR-V"' required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" name="make" placeholder="Honda" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" placeholder="CR-V" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" placeholder="2019" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="units">Odometer Units</Label>
              <select id="units" name="units" className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_mileage">Current Mileage</Label>
            <Input id="current_mileage" name="current_mileage" type="number" placeholder="65000" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="license_plate">License Plate</Label>
            <Input id="license_plate" name="license_plate" placeholder="ABC-1234" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN (optional)</Label>
            <Input id="vin" name="vin" placeholder="17-character VIN" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">QR Code PIN *</Label>
            <Input id="pin" name="pin" type="text" inputMode="numeric" pattern="\d*" maxLength={8} placeholder="4-8 digit PIN for public QR page" required />
            <p className="text-xs text-muted-foreground">Anyone who scans the QR code will need this PIN.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/vehicles">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <SubmitButton label="Create Vehicle" pendingLabel="Creating…" />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
