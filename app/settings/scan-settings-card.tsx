'use client';

import { useActionState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { ScanLine } from 'lucide-react';
import { saveScanSettingsAction } from '@/lib/actions/settings';
import { SCAN_MODELS } from '@/lib/scan-models';
import type { ScanModelId } from '@/lib/scan-models';

export function ScanSettingsCard({
  odometerModel,
  receiptModel,
  configuredKeys,
}: {
  odometerModel: ScanModelId;
  receiptModel: ScanModelId;
  configuredKeys: Set<string>;
}) {
  const [state, action] = useActionState(saveScanSettingsAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="size-4" />
          AI Scan Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <ModelSelect
            label="Odometer photos"
            name="odometer_model"
            defaultValue={odometerModel}
            configuredKeys={configuredKeys}
          />
          <ModelSelect
            label="Fuel receipts"
            name="receipt_model"
            defaultValue={receiptModel}
            configuredKeys={configuredKeys}
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

function ModelSelect({
  label,
  name,
  defaultValue,
  configuredKeys,
}: {
  label: string;
  name: string;
  defaultValue: string;
  configuredKeys: Set<string>;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {SCAN_MODELS.map((m) => {
          const configured = configuredKeys.has(m.envKey);
          return (
            <option key={m.id} value={m.id}>
              {m.label}{!configured ? ' (API key not set)' : ''}
            </option>
          );
        })}
      </select>
      <p className="text-xs text-muted-foreground">
        {SCAN_MODELS.find((m) => m.id === defaultValue)?.description}
      </p>
    </div>
  );
}
