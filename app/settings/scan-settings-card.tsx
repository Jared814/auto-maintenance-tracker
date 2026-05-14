'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { ScanLine } from 'lucide-react';
import { saveScanSettingsAction } from '@/lib/actions/settings';
import { BUILTIN_MODELS } from '@/lib/scan-models';
import type { ScanEngineRow } from '@/lib/db';

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  moondream: 'Moondream',
  custom: 'Custom',
};

export function ScanSettingsCard({
  odometerModel,
  receiptModel,
  compressOdometerBeforeScan,
  compressReceiptBeforeScan,
  engines,
}: {
  odometerModel: string;
  receiptModel: string;
  compressOdometerBeforeScan: boolean;
  compressReceiptBeforeScan: boolean;
  engines: ScanEngineRow[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveScanSettingsAction, null);

  useEffect(() => {
    if (state && 'success' in state) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="size-4" />
          Model Assignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <ModelSelect
            label="Odometer photos"
            name="odometer_model"
            value={odometerModel}
            engines={engines}
            compressName="compress_odometer_before_scan"
            compress={compressOdometerBeforeScan}
          />
          <ModelSelect
            label="Fuel receipts"
            name="receipt_model"
            value={receiptModel}
            engines={engines}
            compressName="compress_receipt_before_scan"
            compress={compressReceiptBeforeScan}
          />

          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}
          {state && 'success' in state && (
            <p className="text-sm text-green-600">Saved.</p>
          )}

          <SubmitButton label="Save" pendingLabel="Saving…" />
        </form>
      </CardContent>
    </Card>
  );
}

function ModelSelect({ label, name, value, engines, compressName, compress }: {
  label: string;
  name: string;
  value: string;
  engines: ScanEngineRow[];
  compressName: string;
  compress: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <select
        key={value}
        id={name}
        name={name}
        defaultValue={value}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <optgroup label="Built-in">
          {BUILTIN_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </optgroup>
        {engines.length > 0 && (
          <optgroup label="Custom Engines">
            {engines.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({PROVIDER_LABELS[e.provider] ?? e.provider})
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          key={String(compress)}
          type="checkbox"
          name={compressName}
          defaultChecked={compress}
          className="size-3.5 rounded border-input accent-primary"
        />
        <span className="text-xs text-muted-foreground">Compress before scanning</span>
      </label>
    </div>
  );
}
