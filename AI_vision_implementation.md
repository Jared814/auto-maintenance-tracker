# AI Fuel Receipt Scanning — Implementation Plan

## Context
The app has a fully-built fuel log system. Users manually type gallons and price-per-gallon when logging a fill-up. The goal is: when a user attaches a receipt photo, Claude's vision API automatically reads the receipt and pre-fills `fuel_quantity`, `fuel_unit`, and `price_per_unit` in the form — saving typing and reducing errors. The user can edit before saving. This is a pure UI enhancement; no DB changes needed.

## Files to Change

| Action | File |
|--------|------|
| Fix camera permissions | `next.config.ts` line 19 |
| Add env var doc | `.env.example` |
| **Create** AI route | `app/api/ai/extract-fuel-receipt/route.ts` |
| **Modify** fuel form | `app/vehicles/[id]/fuel/fuel-client.tsx` |

---

## Step 1 — Fix Camera Permissions Policy (`next.config.ts`)

Line 19 currently reads `camera=()` which **silently blocks** mobile camera access. Change to:

```
{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
```

---

## Step 2 — Add Env Var

In `.env.example`, add:
```
ANTHROPIC_API_KEY=          # Claude vision API for receipt scanning (optional)
```

---

## Step 3 — Install SDK & Create API Route

```bash
npm install @anthropic-ai/sdk
```

**Create `app/api/ai/extract-fuel-receipt/route.ts`** — authenticated POST endpoint:

```
Request body: { imageBase64: string (full data URL), mediaType: string }
Response:     { fuel_quantity: number|null, fuel_unit: 'gallons'|'liters'|null, price_per_unit: string|null, total_cost: string|null }
```

Logic:
1. Auth check via `auth()` — return 401 if not logged in
2. Return 503 if `ANTHROPIC_API_KEY` is not set
3. Strip `data:...;base64,` prefix from imageBase64 to get raw base64
4. Validate mediaType against `['image/jpeg','image/png','image/gif','image/webp']`; default to `image/jpeg`
5. Call `client.messages.create` with model `claude-sonnet-4-6`, max_tokens 256, image block + text prompt
6. Parse JSON from response using `content.match(/\{[\s\S]*\}/)` + `JSON.parse` + Zod validation
7. On parse failure → return all-null payload (form stays blank, not broken)
8. On Claude API error → return 502

**Claude extraction prompt:**
```
You are reading a fuel/gas station receipt image.

Extract the following fields and return ONLY a JSON object with no other text:
{
  "fuel_quantity": <number or null>,
  "fuel_unit": <"gallons" or "liters" or null>,
  "price_per_unit": <string like "3.499" or null>,
  "total_cost": <string like "43.21" or null>
}

Rules:
- fuel_quantity: the volume of fuel purchased as a number (e.g. 12.345)
- fuel_unit: "gallons" if receipt shows "GAL"/"GALLONS"; "liters" if "L"/"LITRES"
- price_per_unit: price per gallon/liter as a string, no currency symbol (e.g. "3.499")
- total_cost: total fuel charge as a string, no currency symbol (e.g. "43.21")
- If a field is not visible, use null
- Return ONLY the JSON object, nothing else
```

**Error handling:**

| Failure | Behavior |
|---------|----------|
| `ANTHROPIC_API_KEY` not set | 503; form shows error, stays usable |
| Claude API network error | 502; form shows error, stays usable |
| Claude returns unparseable JSON | All-null payload returned; form fields stay blank |
| Image too large | Client compression to 1MB prevents this |
| HEIC file type | `safeMediaType` defaults to `image/jpeg`; compressed bytes are JPEG anyway |

---

## Step 4 — Modify Fuel Form (`app/vehicles/[id]/fuel/fuel-client.tsx`)

### New state (add alongside existing `useState` calls):
```typescript
const [scanning, setScanning] = useState(false);
const [scanError, setScanError] = useState<string | null>(null);
const [fuelQuantityValue, setFuelQuantityValue] = useState('');
const [pricePerUnitValue, setPricePerUnitValue] = useState('');
```

### New `handleScanReceipt` function (add after `removeFile`):
```typescript
async function handleScanReceipt(file: File) {
  setScanError(null);
  setScanning(true);
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
      body: JSON.stringify({ imageBase64: dataUrl, mediaType: file.type || 'image/jpeg' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Scan failed' }));
      setScanError(err.error ?? 'Scan failed');
      return;
    }
    const data = await res.json();
    if (data.fuel_quantity != null) setFuelQuantityValue(String(data.fuel_quantity));
    if (data.fuel_unit) setUnit(data.fuel_unit as 'gallons' | 'liters');
    if (data.price_per_unit) setPricePerUnitValue(data.price_per_unit);
  } catch {
    setScanError('Could not scan receipt. Enter values manually.');
  } finally {
    setScanning(false);
  }
}
```

### Modify `handleFileChange` — trigger scan after compression:
After the `setSelectedFiles(...)` call, add:
```typescript
if (compressed[0]) handleScanReceipt(compressed[0]);
```

### Make inputs controlled (add `value`/`onChange` to these two fields):

`fuel_quantity` input (line ~240):
```tsx
value={fuelQuantityValue}
onChange={(e) => setFuelQuantityValue(e.target.value)}
```

`price_per_unit` input (line ~277):
```tsx
value={pricePerUnitValue}
onChange={(e) => setPricePerUnitValue(e.target.value)}
```

### Add scan feedback UI in the receipt photo section (after `<input ref={fileInputRef}...>`):
```tsx
{scanning && (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <Loader2 className="size-3 animate-spin" />
    Scanning receipt…
  </div>
)}
{scanError && (
  <p className="text-xs text-amber-600">{scanError}</p>
)}
```

### Disable submit while scanning — update `SubmitButton` className (line ~310):
```tsx
className={(compressing || scanning) ? 'opacity-50 pointer-events-none' : ''}
```

### Reset controlled state on form success (in the `useEffect`):
```typescript
setFuelQuantityValue('');
setPricePerUnitValue('');
setScanError(null);
```

---

## User-Facing Flow

```
User taps "Add photo" → file picker opens
  → User selects/photographs receipt
  → handleFileChange fires
    → browser-image-compression compresses to ≤1MB JPEG
    → file attached to form for R2 upload
    → handleScanReceipt(compressedFile) fires automatically
      → FileReader → base64 data URL
      → POST /api/ai/extract-fuel-receipt
        → Claude vision reads receipt
        → Returns { fuel_quantity, fuel_unit, price_per_unit, total_cost }
      → Form fields pre-filled; user can edit
  → User clicks "Save Fill-Up" — works exactly as before
```

---

## Verification

1. `npm install @anthropic-ai/sdk`
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`
3. `npm run dev`
4. Go to a vehicle's Fuel Log page
5. Click "Attach receipt" and upload a fuel receipt photo
6. Verify spinner appears, then `fuel_quantity` and `price_per_unit` pre-fill
7. Verify you can edit the pre-filled values before saving
8. Verify the form saves and receipt uploads to R2 as before
9. Test graceful failure: remove `ANTHROPIC_API_KEY`, confirm form still works (shows error, stays usable)
10. `npx tsc --noEmit` — no type errors
