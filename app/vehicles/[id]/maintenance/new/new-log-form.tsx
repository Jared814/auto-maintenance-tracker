'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/submit-button';
import { ChevronLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { getToday } from '@/lib/dates';
import { addMaintenanceLogAction } from '@/lib/actions/maintenance';
import type { ActionState } from '@/lib/actions/state';

interface MaintenanceType {
  id: string;
  name: string;
  category: string;
}

export function NewLogForm({
  vehicleId,
  types,
  r2Configured,
  defaultMileage,
}: {
  vehicleId: string;
  types: MaintenanceType[];
  r2Configured: boolean;
  defaultMileage?: number | null;
}) {
  const addLogWithVehicleId = addMaintenanceLogAction.bind(null, vehicleId);
  const [state, formAction] = useActionState<ActionState, FormData>(addLogWithVehicleId, null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const grouped = types.reduce<Record<string, MaintenanceType[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files ?? []);
    if (raw.length === 0) return;
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        raw.map(async (file) => {
          const result = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          return new File([result], file.name, { type: result.type });
        })
      );
      setSelectedFiles((prev) => {
        const merged = [...prev, ...compressed];
        syncInput(merged);
        return merged;
      });
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

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/vehicles/${vehicleId}/maintenance`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Log Service</h1>
        </div>

        <form action={formAction} encType="multipart/form-data" className="space-y-4">
          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="maintenance_type_id">Service Type *</Label>
            <select
              id="maintenance_type_id"
              name="maintenance_type_id"
              required
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="serviced_at">Service Date *</Label>
              <Input id="serviced_at" name="serviced_at" type="date" defaultValue={getToday()} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage_at_service">Mileage *</Label>
              <Input id="mileage_at_service" name="mileage_at_service" type="number" placeholder="65000" defaultValue={defaultMileage ?? undefined} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="next_due_mileage">Next Due Mileage</Label>
              <Input id="next_due_mileage" name="next_due_mileage" type="number" placeholder="70000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_due_date">Next Due Date</Label>
              <Input id="next_due_date" name="next_due_date" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price_paid">Price Paid</Label>
              <Input id="price_paid" name="price_paid" type="text" placeholder="49.99" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop">Shop / Location</Label>
              <Input id="shop" name="shop" placeholder="Jiffy Lube" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Any additional notes…" />
          </div>

          {/* Photo upload */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label>Photos</Label>
              {r2Configured ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {compressing
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <ImagePlus className="size-3.5" />}
                  {compressing ? 'Compressing…' : 'Add photos'}
                </button>
              ) : null}
            </div>

            {r2Configured ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="photos"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFiles.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing}
                    className="w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-6 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                  >
                    {compressing
                      ? <Loader2 className="size-5 animate-spin" />
                      : <ImagePlus className="size-5" />}
                    {compressing ? 'Compressing images…' : 'Receipts, product labels, or reference images'}
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                        <span className="truncate text-muted-foreground">{file.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add more
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Photo upload requires Cloudflare R2 to be configured.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Link href={`/vehicles/${vehicleId}/maintenance`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <SubmitButton label="Save Record" pendingLabel="Saving…" className={compressing ? 'opacity-50 pointer-events-none' : ''} />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
