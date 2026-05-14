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
import { addMileageLogAction, deleteMileageLogAction } from '@/lib/actions/mileage';
import { getToday } from '@/lib/dates';
import { formatDate, formatMileage } from '@/lib/utils';
import type { ActionState } from '@/lib/actions/state';

const MOONDREAM_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function toMoondreamCompatible(file: File): Promise<File> {
  if (MOONDREAM_SUPPORTED_TYPES.includes(file.type)) return file;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas conversion failed')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}

type MileageLog = {
  id: string;
  logged_at: string;
  mileage: number;
  notes: string | null;
};

type Vehicle = {
  id: string;
  name: string;
  units: string;
};

export function MileageClient({
  vehicle,
  initialLogs,
  effectiveMileage,
  compressOdometerBeforeScan,
}: {
  vehicle: Vehicle;
  initialLogs: MileageLog[];
  effectiveMileage?: number | null;
  compressOdometerBeforeScan?: boolean;
}) {
  const [loggedAtValue, setLoggedAtValue] = useState(getToday());
  const [mileageValue, setMileageValue] = useState('');
  const [notesValue, setNotesValue] = useState('');

  const [selectedOdoFile, setSelectedOdoFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addWithVehicleId = addMileageLogAction.bind(null, vehicle.id);
  const [state, formAction] = useActionState<ActionState, FormData>(addWithVehicleId, null);

  useEffect(() => {
    if (state && 'success' in state) {
      formRef.current?.reset();
      setLoggedAtValue(getToday());
      setMileageValue('');
      setNotesValue('');
      setSelectedOdoFile(null);
      setScanError(null);
    }
  }, [state]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compatible = await toMoondreamCompatible(file);
    if (compressOdometerBeforeScan) {
      const result = await imageCompression(compatible, { maxSizeMB: 1.5, maxWidthOrHeight: 1920, initialQuality: 0.9, useWebWorker: true });
      const compressed = new File([result], compatible.name, { type: result.type });
      setSelectedOdoFile(compressed);
      await handleScanOdometer(compressed);
    } else {
      setSelectedOdoFile(compatible);
      await handleScanOdometer(compatible);
    }
  }

  async function handleScanOdometer(file: File) {
    setScanError(null);
    setScanning(true);
    setMileageValue('');
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
        setScanError(err.error ?? 'Scan failed');
        return;
      }
      const data = await res.json();
      if (data.mileage != null) setMileageValue(String(data.mileage));
      else setScanError('Could not read odometer. Enter mileage manually.');
    } catch {
      setScanError('Could not read odometer. Enter mileage manually.');
    } finally {
      setScanning(false);
    }
  }

  function resetForm() {
    formRef.current?.reset();
    setLoggedAtValue(getToday());
    setMileageValue('');
    setNotesValue('');
    setSelectedOdoFile(null);
    setScanError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const sortedLogs = [...initialLogs].sort((a, b) => b.logged_at.localeCompare(a.logged_at));

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
          <h1 className="text-2xl font-bold">Mileage Log</h1>
        </div>

        {/* Log form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log Current Mileage</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={formAction} className="space-y-3">
              {state && 'error' in state && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="logged_at">Date *</Label>
                  <Input
                    id="logged_at"
                    name="logged_at"
                    type="date"
                    value={loggedAtValue}
                    onChange={(e) => setLoggedAtValue(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mileage">Odometer *</Label>
                  <Input
                    id="mileage"
                    name="mileage"
                    type="number"
                    placeholder={effectiveMileage != null ? String(effectiveMileage) : '65000'}
                    required
                    value={mileageValue}
                    onChange={(e) => setMileageValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Odometer photo scan */}
              <div className="space-y-1.5">
                <Label>
                  Odometer Photo{' '}
                  <span className="text-muted-foreground font-normal">(optional — scanned by AI, not saved)</span>
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {!selectedOdoFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-3 text-xs text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <ImagePlus className="size-3.5" />
                    Take or attach odometer photo
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-xs">
                    <button
                      type="button"
                      onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }}
                      className="flex items-center gap-1.5 min-w-0 text-muted-foreground hover:text-foreground"
                    >
                      <ImagePlus className="size-3 shrink-0" />
                      <span className="truncate">{selectedOdoFile.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedOdoFile(null); setScanError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
                {scanning && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Reading odometer…
                  </div>
                )}
                {scanError && <p className="text-xs text-amber-600">{scanError}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Trip, purpose…"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <SubmitButton label="Save Mileage" pendingLabel="Saving…" className={scanning ? 'opacity-50 pointer-events-none' : ''} />
                <Button type="button" variant="outline" onClick={resetForm}>Reset</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        {sortedLogs.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Mileage History</h2>
            <div className="space-y-2">
              {sortedLogs.map((log) => (
                <div key={log.id} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatDate(log.logged_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMileage(log.mileage, vehicle.units)}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">{log.notes}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={async () => {
                      if (confirm('Delete this mileage entry?')) await deleteMileageLogAction(log.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedLogs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No mileage entries yet. Log your first one above.
          </p>
        )}
      </div>
    </AppShell>
  );
}
