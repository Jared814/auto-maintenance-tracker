'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CreateMaintenanceTypeSchema, type CreateMaintenanceType } from '@/lib/schemas';
import { Plus, Trash2 } from 'lucide-react';

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

export function MaintenanceTypesClient({ initialTypes }: { initialTypes: MaintenanceType[] }) {
  const [types, setTypes] = useState<MaintenanceType[]>(initialTypes);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateMaintenanceType>({
    resolver: zodResolver(CreateMaintenanceTypeSchema) as never,
    defaultValues: { category: 'engine' },
  });

  async function onSubmit(data: CreateMaintenanceType) {
    setError('');
    try {
      const res = await fetch('/api/maintenance-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Failed to create type');
        return;
      }

      const type = await res.json();
      setTypes((prev) => [...prev, type]);
      reset({ category: 'engine' });
      setAdding(false);
    } catch {
      setError('Something went wrong.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this maintenance type?')) return;
    const res = await fetch(`/api/maintenance-types/${id}`, { method: 'DELETE' });
    if (res.ok) setTypes((prev) => prev.filter((t) => t.id !== id));
  }

  const customTypes = types.filter((t) => !t.is_default);
  const defaultTypes = types.filter((t) => t.is_default);

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
              <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-3">
                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" placeholder="e.g. Windshield Chip Repair" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category *</Label>
                    <select id="category" {...register('category')} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="default_interval_miles">Interval (miles)</Label>
                    <Input id="default_interval_miles" type="number" placeholder="5000" {...register('default_interval_miles', { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="default_interval_months">Interval (months)</Label>
                    <Input id="default_interval_months" type="number" placeholder="6" {...register('default_interval_months', { valueAsNumber: true })} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Add Type'}
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(type.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
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
