import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

async function callGeminiReceipt(apiKey: string, imageBase64: string, mediaType: string): Promise<string | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const result = await model.generateContent([
      RECEIPT_PROMPT,
      { inlineData: { data: base64Data, mimeType: mediaType } },
    ]);

    return result.response.text();
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { imageBase64, mediaType, scanType = 'receipt' } = await request.json();
  const safeMediaType = VALID_MEDIA_TYPES.includes(mediaType) ? mediaType : 'image/jpeg';

  if (scanType === 'odometer') {
    const moondreamKey = process.env.MOONDREAM_API_KEY;
    if (!moondreamKey) {
      return NextResponse.json({ error: 'Odometer scanning not configured' }, { status: 503 });
    }
    let imageUrl: string = imageBase64;
    if (!imageBase64.startsWith('data:')) {
      imageUrl = `data:${safeMediaType};base64,${imageBase64}`;
    }
    const answer = await callMoondream(moondreamKey, imageUrl, ODOMETER_PROMPT);
    if (!answer) return NextResponse.json({ error: 'Scan failed' }, { status: 502 });
    const match = answer.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json(NULL_ODOMETER);
    try {
      return NextResponse.json(OdometerSchema.parse(JSON.parse(match[0])));
    } catch {
      return NextResponse.json(NULL_ODOMETER);
    }
  }

  // receipt — Gemini 2.0 Flash
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Receipt scanning not configured' }, { status: 503 });
  }
  const answer = await callGeminiReceipt(geminiKey, imageBase64, safeMediaType);
  if (!answer) return NextResponse.json({ error: 'Scan failed' }, { status: 502 });
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json(NULL_RECEIPT);
  try {
    return NextResponse.json(ReceiptSchema.parse(JSON.parse(match[0])));
  } catch {
    return NextResponse.json(NULL_RECEIPT);
  }
}
