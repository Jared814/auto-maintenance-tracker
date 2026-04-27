'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/submit-button';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { deleteMaintenanceLogAction, updateMaintenanceLogAction } from '@/lib/actions/maintenance';
import type { ActionState } from '@/lib/actions/state';

function DeleteButton({ id }: { id: string }) {
  return (
    <Button
      type="button"
      variant="destructive"
      className="ml-auto"
      onClick={async () => {
        if (confirm('Delete this service record?')) {
          await deleteMaintenanceLogAction(id);
        }
      }}
    >
      <Trash2 className="size-4" />
      Delete
    </Button>
  );
}

export function EditLogForm({ vehicleId, log }: { vehicleId: string; log: any }) {
  const updateLogWithId = updateMaintenanceLogAction.bind(null, log.id);
  const [state, formAction] = useActionState<ActionState, FormData>(updateLogWithId, null);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Service Record</h1>
        </div>

        <form action={formAction} className="space-y-4">
          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="serviced_at">Service Date *</Label>
              <Input id="serviced_at" name="serviced_at" type="date" defaultValue={log.serviced_at} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage_at_service">Mileage *</Label>
              <Input id="mileage_at_service" name="mileage_at_service" type="number" defaultValue={log.mileage_at_service} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="next_due_mileage">Next Due Mileage</Label>
              <Input id="next_due_mileage" name="next_due_mileage" type="number" defaultValue={log.next_due_mileage || ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_due_date">Next Due Date</Label>
              <Input id="next_due_date" name="next_due_date" type="date" defaultValue={log.next_due_date || ''} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price_paid">Price Paid</Label>
              <Input id="price_paid" name="price_paid" defaultValue={log.price_paid || ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop">Shop</Label>
              <Input id="shop" name="shop" defaultValue={log.shop || ''} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={log.notes || ''} />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${vehicleId}/maintenance/${log.id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <SubmitButton label="Save Changes" pendingLabel="Saving…" />
            <DeleteButton id={log.id} />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
