'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { bulkImportMaintenanceAction, type ImportRow } from '@/lib/actions/maintenance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MaintenanceType = { id: string; name: string; category: string };

type PreviewRow = {
  key: string;
  skip: boolean;
  mileage: number;
  date: string;        // ISO YYYY-MM-DD
  dateDisplay: string; // original string for display
  description: string;
  typeId: string | null;      // existing type id, or null
  cost: string | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Fuzzy type matcher
// ---------------------------------------------------------------------------

const KEYWORD_RULES: Array<{ words: string[]; fragment: string }> = [
  { words: ['oil', 'lube', 'lubrication'], fragment: 'oil' },
  { words: ['spark plug', 'sparkplug', 'plugs'], fragment: 'spark plug' },
  { words: ['air filter', 'engine air'], fragment: 'engine air filter' },
  { words: ['cabin filter', 'cabin air'], fragment: 'cabin air filter' },
  { words: ['fuel filter'], fragment: 'fuel filter' },
  { words: ['coolant', 'antifreeze'], fragment: 'coolant' },
  { words: ['brake fluid'], fragment: 'brake fluid' },
  { words: ['brake pad', 'brake pads', 'pads front', 'front pad', 'front brake'], fragment: 'brake pads (front)' },
  { words: ['rear brake', 'rear pad', 'pads rear'], fragment: 'brake pads (rear)' },
  { words: ['rotor', 'rotors', 'disc'], fragment: 'rotor' },
  { words: ['tire rotation', 'rotate tires', 'tire rotate'], fragment: 'tire rotation' },
  { words: ['wheel align', 'alignment'], fragment: 'wheel alignment' },
  { words: ['wheel balance', 'balancing', 'balance tires'], fragment: 'wheel balancing' },
  { words: ['transmission fluid', 'trans fluid'], fragment: 'transmission fluid' },
  { words: ['transfer case'], fragment: 'transfer case' },
  { words: ['differential', 'diff fluid'], fragment: 'differential fluid' },
  { words: ['power steering'], fragment: 'power steering' },
  { words: ['serpentine belt', 'drive belt'], fragment: 'serpentine belt' },
  { words: ['timing belt'], fragment: 'timing belt' },
  { words: ['pcv', 'pcv valve'], fragment: 'pcv valve' },
  { words: ['battery'], fragment: 'battery' },
  { words: ['wiper', 'wipers', 'wiper blade'], fragment: 'wiper' },
  { words: ['washer fluid', 'windshield fluid'], fragment: 'windshield washer' },
];

function suggestTypeId(description: string, types: MaintenanceType[]): string | null {
  const d = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.words.some((w) => d.includes(w))) {
      const match = types.find((t) => t.name.toLowerCase().includes(rule.fragment));
      if (match) return match.id;
    }
  }
  // Word-overlap fallback: score each type by shared tokens
  const dTokens = new Set(d.split(/\W+/).filter((t) => t.length > 2));
  let best: { id: string; score: number } | null = null;
  for (const type of types) {
    const tTokens = type.name.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const score = tTokens.filter((t) => dTokens.has(t)).length;
    if (score > 0 && (!best || score > best.score)) best = { id: type.id, score };
  }
  if (best && best.score >= 1) return best.id;
  // Fall back to the "Other" type if one exists
  return types.find((t) => t.category === 'other')?.id ?? null;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseDate(raw: string): { iso: string; display: string } {
  const s = raw.trim();
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, mo, d, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return {
      iso: `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`,
      display: s,
    };
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s, display: s };
  return { iso: s, display: s };
}

function parseCost(raw: string): string | null {
  const stripped = raw.trim().replace(/[$,]/g, '');
  if (!stripped || isNaN(Number(stripped))) return null;
  return stripped;
}

function splitLine(line: string): string[] {
  // Prefer tab-separated (copied from spreadsheet)
  if (line.includes('\t')) return line.split('\t');
  // Fall back: 2+ spaces as delimiter
  return line.split(/[ ]{2,}/);
}

function isHeaderLine(cols: string[]): boolean {
  const joined = cols.join(' ').toLowerCase();
  return joined.includes('mileage') || joined.includes('description') || joined.includes('date');
}

function parseText(raw: string, types: MaintenanceType[]): PreviewRow[] {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim());
  const rows: PreviewRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = splitLine(lines[i]).map((c) => c.trim());
    if (cols.length < 3) continue;
    if (i === 0 && isHeaderLine(cols)) continue;

    const [mileageRaw, description, dateRaw, costRaw, notesRaw] = cols;
    const mileage = parseInt((mileageRaw ?? '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(mileage) || !description?.trim()) continue;

    const { iso, display } = parseDate(dateRaw ?? '');
    const cost = parseCost(costRaw ?? '');
    const notes = notesRaw?.trim() || null;
    const typeId = suggestTypeId(description, types);

    rows.push({
      key: `${i}-${mileage}`,
      skip: false,
      mileage,
      date: iso,
      dateDisplay: display,
      description: description.trim(),
      typeId,
      cost,
      notes,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SKIP_SENTINEL = '__skip__';

export function ImportClient({
  vehicle,
  maintenanceTypes,
  otherTypeId,
}: {
  vehicle: { id: string; name: string; units: string };
  maintenanceTypes: MaintenanceType[];
  otherTypeId: string | null;
}) {
  const router = useRouter();

  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicates: number } | { error: string } | null>(null);

  function handleParse() {
    setResult(null);
    setRows(parseText(raw, maintenanceTypes));
  }

  function updateRow(key: string, patch: Partial<PreviewRow>) {
    setRows((prev) => prev?.map((r) => r.key === key ? { ...r, ...patch } : r) ?? null);
  }

  function handleTypeChange(key: string, value: string) {
    if (value === SKIP_SENTINEL) {
      updateRow(key, { skip: true, typeId: null });
    } else {
      updateRow(key, { skip: false, typeId: value });
    }
  }

  function dropdownValue(row: PreviewRow): string {
    if (row.skip) return SKIP_SENTINEL;
    return row.typeId ?? SKIP_SENTINEL;
  }

  async function handleSubmit() {
    if (!rows) return;
    const toImport: ImportRow[] = rows
      .filter((r) => !r.skip)
      .map((r) => ({
        serviced_at: r.date,
        mileage_at_service: r.mileage,
        description: r.description,
        typeId: r.typeId,
        price_paid: r.cost,
        notes: r.notes,
      }));

    if (toImport.length === 0) {
      setResult({ error: 'No rows selected to import.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await bulkImportMaintenanceAction(vehicle.id, toImport);
      setResult(res);
      if ('imported' in res && res.imported > 0) {
        setTimeout(() => router.push(`/vehicles/${vehicle.id}`), 1800);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const activeRows = rows?.filter((r) => !r.skip) ?? [];
  const typeById = new Map(maintenanceTypes.map((t) => [t.id, t]));

  // Group types by category for the <select> optgroups
  const grouped = maintenanceTypes.reduce<Record<string, MaintenanceType[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href={`/vehicles/${vehicle.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Import Maintenance History</h1>
            <p className="text-sm text-muted-foreground">{vehicle.name}</p>
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardContent className="p-4 space-y-2 text-sm text-muted-foreground">
            <p>Copy rows directly from your spreadsheet and paste below. Expected columns (tab-separated):</p>
            <code className="block bg-muted rounded px-3 py-2 text-xs font-mono">
              Mileage · Description · Date · Cost · Notes/Comments
            </code>
            <p>Dates should be MM/DD/YYYY. Mileage and cost can include commas and $ signs — they&apos;ll be stripped automatically.</p>
          </CardContent>
        </Card>

        {/* Paste area */}
        {!rows && (
          <div className="space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={12}
              className="font-mono text-xs resize-y"
              placeholder={`Mileage\tDescription\tDate\tCost\tComments\n110,000\tOil & filter change\t9/1/2015\t$35.00\tMobil 1 5W30\n114,000\tReplaced front brake pads\t6/1/2015\t$60.00\tDuralast Gold`}
            />
            <Button onClick={handleParse} disabled={!raw.trim()}>
              Parse &amp; Preview
            </Button>
          </div>
        )}

        {/* Preview table */}
        {rows && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} rows parsed · {activeRows.length} selected for import
              </p>
              <Button variant="outline" size="sm" onClick={() => { setRows(null); setResult(null); }}>
                ← Edit paste
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">Import</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mileage</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[180px]">Maintenance Type</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cost</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      className={row.skip ? 'opacity-40 bg-muted/20' : undefined}
                    >
                      {/* Skip toggle */}
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!row.skip}
                          onChange={(e) => updateRow(row.key, { skip: !e.target.checked })}
                          className="rounded"
                        />
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {row.dateDisplay}
                      </td>

                      {/* Mileage */}
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                        {row.mileage.toLocaleString()}
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2 max-w-[200px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">{row.description}</span>
                      </td>

                      {/* Type dropdown */}
                      <td className="px-3 py-2">
                        <select
                          value={dropdownValue(row)}
                          onChange={(e) => handleTypeChange(row.key, e.target.value)}
                          disabled={row.skip}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value={SKIP_SENTINEL}>— Skip row —</option>
                          {otherTypeId && (
                            <option value={otherTypeId}>Other / Unclassified</option>
                          )}
                          {Object.entries(grouped).map(([cat, types]) => (
                            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {/* Show resolved type name */}
                        {!row.skip && row.typeId && (
                          <p className="mt-0.5 text-xs text-primary truncate">
                            {typeById.get(row.typeId)?.name}
                          </p>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                        {row.cost ? `$${parseFloat(row.cost).toFixed(2)}` : '—'}
                      </td>

                      {/* Notes */}
                      <td className="px-3 py-2 max-w-[160px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">{row.notes ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Result banner */}
            {result && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                'error' in result
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-700 dark:text-green-400'
              }`}>
                {'error' in result
                  ? <><AlertCircle className="size-4 shrink-0" />{result.error}</>
                  : <><CheckCircle className="size-4 shrink-0" />Imported {result.imported} record{result.imported !== 1 ? 's' : ''}{'duplicates' in result && result.duplicates > 0 ? ` · ${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped` : ''}{'skipped' in result && result.skipped > 0 ? ` · ${result.skipped} failed` : ''}. Redirecting…</>
                }
              </div>
            )}

            {/* Submit */}
            {!result && (
              <div className="flex gap-3 items-center">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || activeRows.length === 0}
                >
                  <Upload className="size-4" />
                  {submitting ? 'Importing…' : `Import ${activeRows.length} record${activeRows.length !== 1 ? 's' : ''}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Uncheck any rows you want to skip. Type matches are auto-suggested but editable.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
