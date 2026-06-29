'use client';

import { useActionState, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/submit-button';
import { updateVehicleInfoAction } from '@/lib/actions/vehicles';
import type { ActionState } from '@/lib/actions/state';
import { CheckCircle, AlertCircle, Pencil, X } from 'lucide-react';

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function VehicleInfoEditor({
  vehicleId,
  initialBlob,
}: {
  vehicleId: string;
  initialBlob: string | null;
}) {
  const updateAction = updateVehicleInfoAction.bind(null, vehicleId);
  const [state, formAction] = useActionState<ActionState, FormData>(updateAction, null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBlob ?? '');

  // Close edit mode on successful save
  useEffect(() => {
    if (state && 'success' in state && state.success) {
      setEditing(false);
    }
  }, [state]);

  const parsed = !editing ? tryParseJson(draft) : null;
  const isEmpty = !draft.trim();

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Vehicle Info</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </div>

      {/* Hint text when empty */}
      {isEmpty && !editing && (
        <p className="text-sm text-muted-foreground">
          No info saved yet. Tap Edit to add notes — paste JSON or plain text with details like
          VIN, filter part numbers, wiper blade sizes, tire size, etc.
        </p>
      )}

      {/* Pretty-printed JSON view */}
      {!editing && !isEmpty && parsed && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {Object.entries(parsed).map(([key, value]) => (
            <div key={key} className="flex gap-3 px-3 py-2.5 text-sm">
              <span className="font-medium text-muted-foreground min-w-[120px] shrink-0 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
              <span className="text-foreground break-all">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Raw text view (non-JSON or plain text) */}
      {!editing && !isEmpty && !parsed && (
        <pre className="rounded-lg border border-border p-3 text-sm font-mono whitespace-pre-wrap break-all bg-muted/30">
          {draft}
        </pre>
      )}

      {/* Edit form */}
      {editing && (
        <form
          action={formAction}
          onSubmit={() => setDraft((document.getElementById('info_blob') as HTMLTextAreaElement)?.value ?? draft)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Paste JSON for a structured view, or plain text — whatever works for you.
            </p>
            <Textarea
              id="info_blob"
              name="info_blob"
              defaultValue={draft}
              rows={12}
              className="font-mono text-sm resize-y"
              placeholder={`{\n  "vin": "1HGCM82633A004352",\n  "oil_filter": "Fram PH6607",\n  "air_filter": "K&N 33-2129",\n  "wiper_driver": "22 inch",\n  "wiper_passenger": "18 inch",\n  "tire_size": "215/55R17"\n}`}
            />
          </div>

          {state && 'error' in state && state.error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {state.error}
            </p>
          )}
          {state && 'success' in state && state.success && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="size-4 shrink-0" />
              Saved
            </p>
          )}

          <div className="flex gap-2">
            <SubmitButton label="Save" pendingLabel="Saving…" className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(initialBlob ?? '');
                setEditing(false);
              }}
            >
              <X className="size-4" />
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
