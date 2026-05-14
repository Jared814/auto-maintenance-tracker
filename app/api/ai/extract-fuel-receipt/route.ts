import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getAccountScanSettings, getScanEngineById } from '@/lib/db';
import { BUILTIN_MODEL_IDS, DEFAULT_ODOMETER_MODEL, DEFAULT_RECEIPT_MODEL } from '@/lib/scan-models';

const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

const ReceiptSchema = z.object({
  fuel_quantity: z.union([z.number(), z.string()])
    .nullable().catch(null)
    .transform(val => {
      if (val === null) return null;
      const n = typeof val === 'number' ? val : parseFloat(val as string);
      return isNaN(n) ? null : n;
    }),
  fuel_unit: z.string().nullable().catch(null).transform(val => {
    if (!val) return null;
    const lower = val.toLowerCase();
    if (lower.includes('gal')) return 'gallons' as const;
    if (lower.includes('lit') || lower === 'l') return 'liters' as const;
    return null;
  }),
  price_per_unit: z.string().nullable().catch(null),
  total_cost: z.string().nullable().catch(null),
  filled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  store: z.string().nullable().catch(null),
});

const OdometerSchema = z.object({
  mileage: z.union([z.number(), z.string()])
    .nullable().catch(null)
    .transform(val => {
      if (val === null) return null;
      const n = typeof val === 'number' ? Math.round(val) : parseInt(val as string, 10);
      return isNaN(n) ? null : n;
    }),
});

const NULL_RECEIPT = { fuel_quantity: null, fuel_unit: null, price_per_unit: null, total_cost: null, filled_at: null, store: null };
const NULL_ODOMETER = { mileage: null };

const RECEIPT_PROMPT = `Look at this gas station receipt or fuel pump display. Read the text carefully and return ONLY a JSON object — no explanation, no markdown.

{"fuel_quantity": <number or null>, "fuel_unit": <"gallons" or "liters" or null>, "price_per_unit": <string or null>, "total_cost": <string or null>, "filled_at": <string or null>, "store": <string or null>}

What to look for on the receipt:
- fuel_quantity: a number near the word GAL, GALLONS, or LITERS — e.g. "12.345 GAL" → 12.345
- fuel_unit: "gallons" if you see GAL or GALLONS; "liters" if you see L, LITER, or LITRE
- price_per_unit: price per gallon or liter — often labeled PPG, PRICE/GAL, or $/GAL — digits only, no $ (e.g. "3.499")
- total_cost: the fuel sale total — often labeled TOTAL, FUEL TOTAL, or SALE — digits only, no $ (e.g. "43.21")
- filled_at: the transaction date in YYYY-MM-DD format (e.g. "2026-05-08"); null if not visible
- store: full gas station name and complete address as printed — include street, city, state, and zip if visible (e.g. "Shell - 123 Main St, Springfield, IL 62701"); null if not visible
- Use null for any value you cannot clearly read`;

const ODOMETER_PROMPT = `Look at this vehicle odometer or instrument cluster. Read the mileage and reply with ONLY a JSON object, no other text:
{"mileage": <integer or null>}

Rules:
- mileage: the odometer reading as a whole number (e.g. 65432)
- Use null if the mileage is not clearly visible`;

async function callGemini(apiKey: string, imageBase64: string, mediaType: string, prompt: string): Promise<string | null> {
  try {
    const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: mediaType, data: base64Data } },
          ]}],
        }),
      }
    );
    if (!res.ok) { console.error('[callGemini] HTTP error:', res.status, await res.text()); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) { console.error('[callGemini]', err); return null; }
}

async function callMoondream(apiKey: string, imageUrl: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.moondream.ai/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Moondream-Auth': apiKey },
      body: JSON.stringify({ image_url: imageUrl, question: prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.answer ?? null;
  } catch { return null; }
}

async function callOpenAICompatible(apiKey: string, baseUrl: string, model: string, imageBase64: string, mediaType: string, prompt: string): Promise<string | null> {
  try {
    const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mediaType};base64,${imageBase64}`;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ]}],
      }),
    });
    if (!res.ok) { console.error('[callOpenAICompatible] HTTP error:', res.status, await res.text()); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) { console.error('[callOpenAICompatible]', err); return null; }
}

type AccountKeys = {
  moondream_api_key?: string | null;
  gemini_api_key?: string | null;
  openrouter_api_key?: string | null;
};

async function runBuiltinScan(modelId: string, keys: AccountKeys, imageBase64: string, mediaType: string, prompt: string): Promise<string | null> {
  const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mediaType};base64,${imageBase64}`;

  if (modelId === 'moondream') {
    const key = keys.moondream_api_key || process.env.MOONDREAM_API_KEY;
    if (!key) { console.error('[scan] No Moondream API key'); return null; }
    return callMoondream(key, imageUrl, prompt);
  }

  if (modelId === 'gemini-2.5-flash') {
    const key = keys.gemini_api_key || process.env.GOOGLE_AI_API_KEY;
    if (!key) { console.error('[scan] No Gemini API key'); return null; }
    return callGemini(key, imageBase64, mediaType, prompt);
  }

  return null;
}

async function runEngineScan(accountId: string, engineId: string, keys: AccountKeys, imageBase64: string, mediaType: string, prompt: string): Promise<string | null> {
  const engine = await getScanEngineById(engineId, accountId);
  if (!engine) { console.error('[scan] Engine not found:', engineId); return null; }

  const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mediaType};base64,${imageBase64}`;

  if (engine.provider === 'moondream') {
    const key = engine.api_key || keys.moondream_api_key || process.env.MOONDREAM_API_KEY;
    if (!key) { console.error('[scan] No Moondream API key for engine', engine.name); return null; }
    return callMoondream(key, imageUrl, prompt);
  }

  if (engine.provider === 'gemini') {
    const key = engine.api_key || keys.gemini_api_key || process.env.GOOGLE_AI_API_KEY;
    if (!key) { console.error('[scan] No Gemini API key for engine', engine.name); return null; }
    return callGemini(key, imageBase64, mediaType, prompt);
  }

  if (engine.provider === 'openrouter') {
    const key = engine.api_key || keys.openrouter_api_key || process.env.OPENROUTER_API_KEY;
    if (!key) { console.error('[scan] No OpenRouter API key for engine', engine.name); return null; }
    if (!engine.model_id) { console.error('[scan] No model_id for engine', engine.name); return null; }
    return callOpenAICompatible(key, 'https://openrouter.ai/api/v1', engine.model_id, imageBase64, mediaType, prompt);
  }

  if (engine.provider === 'custom') {
    const key = engine.api_key || '';
    if (!engine.base_url) { console.error('[scan] No base_url for custom engine', engine.name); return null; }
    if (!engine.model_id) { console.error('[scan] No model_id for custom engine', engine.name); return null; }
    return callOpenAICompatible(key, engine.base_url, engine.model_id, imageBase64, mediaType, prompt);
  }

  console.error('[scan] Unknown provider:', engine.provider);
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { imageBase64, mediaType, scanType = 'receipt' } = await request.json();
  const safeMediaType = VALID_MEDIA_TYPES.includes(mediaType) ? mediaType : 'image/jpeg';

  const settings = await getAccountScanSettings(session.user.id);
  const odometerModel = settings.odometer_model ?? DEFAULT_ODOMETER_MODEL;
  const receiptModel = settings.receipt_model ?? DEFAULT_RECEIPT_MODEL;
  const accountKeys: AccountKeys = {
    moondream_api_key: 'moondream_api_key' in settings ? (settings as AccountKeys).moondream_api_key : null,
    gemini_api_key: 'gemini_api_key' in settings ? (settings as AccountKeys).gemini_api_key : null,
    openrouter_api_key: 'openrouter_api_key' in settings ? (settings as AccountKeys).openrouter_api_key : null,
  };

  const prompt = scanType === 'odometer' ? ODOMETER_PROMPT : RECEIPT_PROMPT;
  const modelId = scanType === 'odometer' ? odometerModel : receiptModel;

  const answer = BUILTIN_MODEL_IDS.has(modelId)
    ? await runBuiltinScan(modelId, accountKeys, imageBase64, safeMediaType, prompt)
    : await runEngineScan(session.user.id, modelId, accountKeys, imageBase64, safeMediaType, prompt);

  if (!answer) return NextResponse.json({ error: 'Scan failed' }, { status: 502 });

  if (scanType === 'odometer') {
    const match = answer.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json(NULL_ODOMETER);
    try { return NextResponse.json(OdometerSchema.parse(JSON.parse(match[0]))); }
    catch { return NextResponse.json(NULL_ODOMETER); }
  }

  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json(NULL_RECEIPT);
  try { return NextResponse.json(ReceiptSchema.parse(JSON.parse(match[0]))); }
  catch { return NextResponse.json(NULL_RECEIPT); }
}
