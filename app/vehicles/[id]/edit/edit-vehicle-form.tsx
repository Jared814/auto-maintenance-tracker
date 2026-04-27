'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { deleteVehicleAction, updateVehicleAction } from '@/lib/actions/vehicles';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save Changes'}
    </Button>
  );
}

function DeleteButton({ id }: { id: string }) {
  return (
    <Button
      type="button"
      variant="destructive"
      className="ml-auto"
      onClick={async () => {
        if (confirm('Delete this vehicle and all its maintenance history? This cannot be undone.')) {
          await deleteVehicleAction(id);
        }
      }}
    >
      <Trash2 className="size-4" />
      Delete
    </Button>
  );
}

export function EditVehicleForm({ vehicle }: { vehicle: any }) {
  const updateVehicleWithId = updateVehicleAction.bind(null, vehicle.id);
  const [state, formAction] = useActionState(updateVehicleWithId, null);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${vehicle.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Vehicle</h1>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Vehicle Name *</Label>
            <Input id="name" name="name" defaultValue={vehicle.name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" name="make" defaultValue={vehicle.make || ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" defaultValue={vehicle.model || ''} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" defaultValue={vehicle.year || ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="units">Units</Label>
              <select id="units" name="units" defaultValue={vehicle.units} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_mileage">Current Mileage</Label>
            <Input id="current_mileage" name="current_mileage" type="number" defaultValue={vehicle.current_mileage || ''} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="license_plate">License Plate</Label>
            <Input id="license_plate" name="license_plate" defaultValue={vehicle.license_plate || ''} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN</Label>
            <Input id="vin" name="vin" defaultValue={vehicle.vin || ''} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">New QR PIN (leave blank to keep current)</Label>
            <Input id="pin" name="pin" type="text" inputMode="numeric" pattern="\d*" maxLength={8} placeholder="4-8 digits" />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${vehicle.id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <SubmitButton />
            <DeleteButton id={vehicle.id} />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
