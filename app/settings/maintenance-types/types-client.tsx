'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { Plus, Trash2 } from 'lucide-react';
import { addMaintenanceTypeAction, deleteMaintenanceTypeAction } from '@/lib/actions/types';
import type { ActionState } from '@/lib/actions/state';

interface MaintenanceType {
  id: string;
  name: string;
  category: string;
  default_interval_miles: number | null;
  default_interval_months: number | null;
  is_default: boolean;
  account_id: string | null;
}

const CATEGORIES = ['engine', 'transmission', 'brakes', 'tires', 'fluids', 'filters', 'belts', 'electrical', 'other'];

function DeleteButton({ id }: { id: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={async () => {
        if (confirm('Delete this maintenance type?')) {
          await deleteMaintenanceTypeAction(id);
        }
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function MaintenanceTypesClient({ types }: { types: MaintenanceType[] }) {
  const [adding, setAdding] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(addMaintenanceTypeAction, null);

  const customTypes = types.filter((t) => !t.is_default);
  const defaultTypes = types.filter((t) => t.is_default);

  // Automatically close form on successful submission
  if (state && 'success' in state && adding) {
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Custom types */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Custom Types</h2>
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
            <Plus className="size-4" />
            Add Type
          </Button>
        </div>

        {adding && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <form action={formAction} className="space-y-3">
                {state && 'error' in state && <p className="text-xs text-destructive">{state.error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" placeholder="e.g. Windshield Chip Repair" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category *</Label>
                    <select id="category" name="category" defaultValue="engine" className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="default_interval_miles">Interval (miles)</Label>
                    <Input id="default_interval_miles" name="default_interval_miles" type="number" placeholder="5000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="default_interval_months">Interval (months)</Label>
                    <Input id="default_interval_months" name="default_interval_months" type="number" placeholder="6" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <SubmitButton label="Add Type" pendingLabel="Saving…" />
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {customTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom types yet.</p>
        ) : (
          <div className="space-y-2">
            {customTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{type.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{type.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(type.default_interval_miles || type.default_interval_months) && (
                    <span className="text-xs text-muted-foreground">
                      {[
                        type.default_interval_miles ? `${type.default_interval_miles.toLocaleString()}mi` : null,
                        type.default_interval_months ? `${type.default_interval_months}mo` : null,
                      ].filter(Boolean).join(' / ')}
                    </span>
                  )}
                  <DeleteButton id={type.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default types (read-only) */}
      <div>
        <h2 className="text-base font-semibold mb-3">Default Types</h2>
        <div className="space-y-1">
          {defaultTypes.map((type) => (
            <div key={type.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm">
              <span className="text-muted-foreground">{type.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{type.category}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
