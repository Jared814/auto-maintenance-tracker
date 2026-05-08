# AI Fuel Receipt Scanning — Implementation

## Context
The app has a fully-built fuel log system. Users manually type gallons and price-per-gallon when logging a fill-up. When a user attaches a receipt photo, Moondream's vision API automatically reads the receipt and pre-fills `fuel_quantity`, `fuel_unit`, and `price_per_unit` in the form — saving typing and reducing errors. The user can edit before saving. This is a pure UI enhancement; no DB changes needed.

**Model:** Moondream (`https://api.moondream.ai/v1/query`) — a lightweight 1.9B-parameter VQA model. Faster and cheaper than frontier models; tradeoff is occasional character-level OCR errors on numbers. Pre-fill is non-destructive so users can correct values before saving.

## Files Changed

| Action | File |
|--------|------|
| Fix camera permissions | `next.config.ts` line 19 |
| Add env var doc | `.env.example` |
| **Created** AI route | `app/api/ai/extract-fuel-receipt/route.ts` |
| **Modified** fuel form | `app/vehicles/[id]/fuel/fuel-client.tsx` |

---

## API Route (`app/api/ai/extract-fuel-receipt/route.ts`)

**No npm package required** — plain `fetch` to Moondream REST API.

```
POST https://api.moondream.ai/v1/query
Headers: X-Moondream-Auth: <MOONDREAM_API_KEY>
         Content-Type: application/json
Body:    { "image_url": "<full data URI>", "question": "<prompt>" }
Response: { "answer": "<string>", "request_id": "..." }
```

Request body from client: `{ imageBase64: string (full data URL), mediaType: string }`
Response to client: `{ fuel_quantity: number|null, fuel_unit: 'gallons'|'liters'|null, price_per_unit: string|null, total_cost: string|null }`

Logic:
1. Auth check via `auth()` — return 401 if not logged in
2. Return 503 if `MOONDREAM_API_KEY` is not set
3. Validate mediaType against `['image/jpeg','image/png','image/gif','image/webp']`; default to `image/jpeg`
4. Pass the full data URL as `image_url` (Moondream accepts `data:<mime>;base64,...` directly)
5. Parse JSON from `data.answer` using `.match(/\{[\s\S]*\}/)` + `JSON.parse` + Zod validation
6. On parse failure → return all-null payload (form stays blank, not broken)
7. On Moondream API error → return 502

**Extraction prompt:**
```
Look at this fuel or gas station receipt image. Extract these fields and reply with ONLY a JSON object, no other text:
{"fuel_quantity": <number or null>, "fuel_unit": <"gallons" or "liters" or null>, "price_per_unit": <string like "3.499" or null>, "total_cost": <string like "43.21" or null>}

Rules:
- fuel_quantity: volume purchased as a number (e.g. 12.345)
- fuel_unit: "gallons" if receipt shows GAL/GALLONS, "liters" if L/LITRES
- price_per_unit: price per gallon/liter as a string without currency symbol
- total_cost: total fuel charge as a string without currency symbol
- Use null for any field not visible on the receipt
```

**Error handling:**

| Failure | Behavior |
|---------|----------|
| `MOONDREAM_API_KEY` not set | 503; form shows error, stays usable |
| Moondream API network error | 502; form shows error, stays usable |
| Moondream returns unparseable JSON | All-null payload returned; form fields stay blank |
| Image too large | Client compression to 1MB prevents this |

---

## Fuel Form Changes (`app/vehicles/[id]/fuel/fuel-client.tsx`)

**New state:**
- `scanning` / `scanError` — spinner and error feedback
- `fuelQuantityValue` / `pricePerUnitValue` — controlled inputs so scan results can pre-fill them

**Flow:**
1. User selects/photos a receipt via file input
2. `handleFileChange` compresses the image (existing logic)
3. After compression, `handleScanReceipt(compressed[0])` fires automatically
4. `FileReader` → base64 data URL → `POST /api/ai/extract-fuel-receipt`
5. On success, fuel_quantity and price_per_unit fields pre-fill; unit toggles if detected
6. User can edit pre-filled values, then clicks "Save Fill-Up" as normal

**UI additions:**
- Spinner ("Scanning receipt…") shown while scanning
- Amber error text if scan fails — form stays fully usable
- Submit button disabled during scan (same pattern as compression)

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
        → Moondream vision reads receipt
        → Returns { fuel_quantity, fuel_unit, price_per_unit, total_cost }
      → Form fields pre-filled; user can edit
  → User clicks "Save Fill-Up" — works exactly as before
```

---

## Verification

1. Add `MOONDREAM_API_KEY=<token>` to `.env.local`
2. `npm run dev`
3. Go to a vehicle's Fuel Log page
4. Click "Add photo" and upload a fuel receipt photo
5. Verify spinner appears, then `fuel_quantity` and `price_per_unit` pre-fill
6. Verify you can edit the pre-filled values before saving
7. Verify the form saves and receipt uploads to R2 as before
8. Test graceful failure: remove `MOONDREAM_API_KEY`, confirm form still works (shows error, stays usable)
9. `npx tsc --noEmit` — no type errors
