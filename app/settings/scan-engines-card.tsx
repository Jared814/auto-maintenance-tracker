'use client';

import { useActionState, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { Cpu, Plus, Pencil, Trash2, X } from 'lucide-react';
import { createScanEngineAction, updateScanEngineAction, deleteScanEngineAction } from '@/lib/actions/settings';
import { PROVIDERS } from '@/lib/scan-models';
import type { ScanEngineRow } from '@/lib/db';

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  moondream: 'Moondream',
  custom: 'Custom',
};

export function ScanEnginesCard({ initialEngines }: { initialEngines: ScanEngineRow[] }) {
  const [engines, setEngines] = useState<ScanEngineRow[]>(initialEngines);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  function handleCreated(engine: ScanEngineRow) {
    setEngines((prev) => [...prev, engine]);
    setEditingId(null);
  }

  function handleUpdated(engine: ScanEngineRow) {
    setEngines((prev) => prev.map((e) => (e.id === engine.id ? engine : e)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this scan engine?')) return;
    await deleteScanEngineAction(id);
    setEngines((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="size-4" />
          Scan Engines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {engines.length === 0 && editingId === null && (
          <p className="text-sm text-muted-foreground">No custom engines yet. Add one to use a different model.</p>
        )}

        {engines.map((engine) =>
          editingId === engine.id ? (
            <EngineForm
              key={engine.id}
              engine={engine}
              onSaved={handleUpdated}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={engine.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{engine.name}</p>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_LABELS[engine.provider] ?? engine.provider}
                  {engine.model_id ? ` · ${engine.model_id}` : ''}
                  {engine.api_key ? ' · own key' : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingId(engine.id)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(engine.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )
        )}

        {editingId === 'new' ? (
          <EngineForm onSaved={handleCreated} onCancel={() => setEditingId(null)} />
        ) : (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingId('new')}>
            <Plus className="size-3.5" />
            Add Engine
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EngineForm({
  engine,
  onSaved,
  onCancel,
}: {
  engine?: ScanEngineRow;
  onSaved: (engine: ScanEngineRow) => void;
  onCancel: () => void;
}) {
  const isEdit = !!engine;
  const action = isEdit ? updateScanEngineAction : createScanEngineAction;
  const [state, formAction] = useActionState(action, null);
  const [provider, setProvider] = useState(engine?.provider ?? 'openrouter');

  const showModelId = provider !== 'moondream';
  const showBaseUrl = provider === 'custom';

  // When the action succeeds, bubble up the result
  // We need to read the returned engine from state — but server actions don't return the row directly.
  // So we use optimistic data: if success, close and signal the parent to refresh.
  // For simplicity, trigger a page reload on success.
  if (state && 'success' in state) {
    // Force a full page reload so the parent re-fetches engines with their real IDs.
    if (typeof window !== 'undefined') window.location.reload();
    return null;
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{isEdit ? 'Edit Engine' : 'New Engine'}</p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
      </div>

      <form action={formAction} className="space-y-3">
        {isEdit && <input type="hidden" name="id" value={engine.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" defaultValue={engine?.name} placeholder="e.g. Qianfan OCR Fast" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider *</Label>
          <select
            id="provider"
            name="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {showModelId && (
          <div className="space-y-1.5">
            <Label htmlFor="model_id">Model ID *</Label>
            <Input
              id="model_id"
              name="model_id"
              defaultValue={engine?.model_id ?? ''}
              placeholder={provider === 'openrouter' ? 'baidu/qianfan-ocr-fast' : provider === 'gemini' ? 'gemini-2.5-flash' : 'model-name'}
            />
          </div>
        )}

        {showBaseUrl && (
          <div className="space-y-1.5">
            <Label htmlFor="base_url">Base URL *</Label>
            <Input
              id="base_url"
              name="base_url"
              defaultValue={engine?.base_url ?? ''}
              placeholder="https://api.example.com/v1"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="api_key">
            API Key <span className="text-muted-foreground font-normal">(optional — uses account key if blank)</span>
          </Label>
          <Input
            id="api_key"
            name="api_key"
            type="password"
            defaultValue=""
            placeholder={engine?.api_key ? '••••••••  (leave blank to keep)' : 'Override key for this engine…'}
            autoComplete="off"
          />
        </div>

        {state && 'error' in state && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
        )}

        <div className="flex gap-2">
          <SubmitButton label={isEdit ? 'Update' : 'Add Engine'} pendingLabel="Saving…" />
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
