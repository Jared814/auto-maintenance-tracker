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
import { Textarea } from '@/components/ui/textarea';
import { UpdateMaintenanceLogSchema, type UpdateMaintenanceLog } from '@/lib/schemas';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { use } from 'react';

export default function EditMaintenanceLogPage({
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
}) {
  const { id, logId } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<UpdateMaintenanceLog>({
    resolver: zodResolver(UpdateMaintenanceLogSchema) as never,
  });

  useEffect(() => {
    fetch(`/api/maintenance-logs/${logId}`)
      .then((r) => r.json())
      .then((log) =>
        reset({
          serviced_at: log.serviced_at,
          mileage_at_service: log.mileage_at_service,
          next_due_mileage: log.next_due_mileage ?? undefined,
          next_due_date: log.next_due_date ?? undefined,
          price_paid: log.price_paid ?? '',
          shop: log.shop ?? '',
          notes: log.notes ?? '',
        })
      );
  }, [logId, reset]);

  async function onSubmit(data: UpdateMaintenanceLog) {
    setError('');
    try {
      const res = await fetch(`/api/maintenance-logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Failed to update');
        return;
      }

      router.push(`/vehicles/${id}/maintenance/${logId}`);
    } catch {
      setError('Something went wrong.');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this service record?')) return;
    setDeleting(true);
    const res = await fetch(`/api/maintenance-logs/${logId}`, { method: 'DELETE' });
    if (res.ok) router.push(`/vehicles/${id}/maintenance`);
    else setDeleting(false);
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${id}/maintenance/${logId}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Service Record</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="serviced_at">Service Date *</Label>
              <Input id="serviced_at" type="date" {...register('serviced_at')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage_at_service">Mileage *</Label>
              <Input id="mileage_at_service" type="number" {...register('mileage_at_service', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="next_due_mileage">Next Due Mileage</Label>
              <Input id="next_due_mileage" type="number" {...register('next_due_mileage', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_due_date">Next Due Date</Label>
              <Input id="next_due_date" type="date" {...register('next_due_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price_paid">Price Paid</Label>
              <Input id="price_paid" {...register('price_paid')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop">Shop</Label>
              <Input id="shop" {...register('shop')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${id}/maintenance/${logId}`}>
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
