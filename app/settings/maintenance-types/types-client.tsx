'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SubmitButton } from '@/components/submit-button';
import { Plus, Trash2 } from 'lucide-react';
import { addMaintenanceTypeAction, deleteMaintenanceTypeAction, toggleMaintenanceTypeAction } from '@/lib/actions/types';
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

const CATEGORY_LABELS: Record<string, string> = {
  engine: 'Engine', transmission: 'Transmission', brakes: 'Brakes',
  tires: 'Tires', fluids: 'Fluids', filters: 'Filters',
  belts: 'Belts', electrical: 'Electrical', other: 'Other',
};

const CATEGORY_ORDER = ['engine', 'transmission', 'brakes', 'tires', 'fluids', 'filters', 'belts', 'electrical', 'other'];

function Toggle({ id, enabled, onToggle }: { id: string; enabled: boolean; onToggle: (id: string, enabled: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onToggle(id, !enabled)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        enabled ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

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

export function MaintenanceTypesClient({
  types,
  disabledIds,
}: {
  types: MaintenanceType[];
  disabledIds: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(addMaintenanceTypeAction, null);
  const [localDisabled, setLocalDisabled] = useState<Set<string>>(new Set(disabledIds));
  const [, startTransition] = useTransition();

  function handleToggle(typeId: string, enabled: boolean) {
    setLocalDisabled((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
    startTransition(() => {
      toggleMaintenanceTypeAction(typeId, enabled);
    });
  }

  if (state && 'success' in state && adding) {
    setAdding(false);
  }

  const customTypes = types.filter((t) => !t.is_default);
  const defaultTypes = types.filter((t) => t.is_default);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: defaultTypes.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  const enabledCount = defaultTypes.filter((t) => !localDisabled.has(t.id)).length;

  return (
    <div className="space-y-6">
      {/* Default types with toggles */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold">Default Types</h2>
          <span className="text-xs text-muted-foreground">{enabledCount} / {defaultTypes.length} active</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Toggle off types you don&apos;t want tracked on your vehicles.</p>

        <div className="space-y-4">
          {grouped.map(({ cat, label, items }) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
              <div className="space-y-1">
                {items.map((type) => {
                  const enabled = !localDisabled.has(type.id);
                  return (
                    <div
                      key={type.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                        enabled ? 'bg-card border-border' : 'bg-muted/40 border-transparent'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${!enabled ? 'text-muted-foreground' : ''}`}>{type.name}</p>
                        {(type.default_interval_miles || type.default_interval_months) && (
                          <p className="text-xs text-muted-foreground">
                            {[
                              type.default_interval_miles ? `${type.default_interval_miles.toLocaleString()}mi` : null,
                              type.default_interval_months ? `${type.default_interval_months}mo` : null,
                            ].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </div>
                      <Toggle id={type.id} enabled={enabled} onToggle={handleToggle} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            {customTypes.map((type) => {
              const enabled = !localDisabled.has(type.id);
              return (
                <div key={type.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors ${
                  enabled ? 'bg-card border-border' : 'bg-muted/40 border-transparent'
                }`}>
                  <div>
                    <p className={`text-sm font-medium ${!enabled ? 'text-muted-foreground' : ''}`}>{type.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{type.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(type.default_interval_miles || type.default_interval_months) && (
                      <span className="text-xs text-muted-foreground">
                        {[
                          type.default_interval_miles ? `${type.default_interval_miles.toLocaleString()}mi` : null,
                          type.default_interval_months ? `${type.default_interval_months}mo` : null,
                        ].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    <Toggle id={type.id} enabled={enabled} onToggle={handleToggle} />
                    <DeleteButton id={type.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
